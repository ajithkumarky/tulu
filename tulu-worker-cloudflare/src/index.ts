// tulu-worker-cloudflare/src/index.ts

interface Env {
	DB: D1Database;
	ASSETS: Fetcher;
	AUTH_SECRET: string;
}

// --- Rate limiting (in-memory, resets on worker restart) ---
const failedLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// --- Column migration flag ---
let columnsEnsured = false;

// --- Allowed CORS origins ---
const ALLOWED_ORIGINS = [
	'https://tulu.kidiyoor.com',
	'https://tulu-worker-cloudflare.ajithkumarky.workers.dev',
	'http://localhost:3000',
	'http://localhost:5173',
];

function getCorsOrigin(request: Request): string {
	const origin = request.headers.get('Origin');
	if (origin && ALLOWED_ORIGINS.includes(origin)) {
		return origin;
	}
	return ALLOWED_ORIGINS[0]; // default fallback
}

function makeApiHeaders(request: Request): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': getCorsOrigin(request),
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}

// Helper function to calculate level based on experience
const calculateLevel = (experience: number): number => {
	if (experience < 100) return 1;
	if (experience < 250) return 2;
	if (experience < 500) return 3;
	if (experience < 800) return 4;
	if (experience < 1200) return 5;
	return 6; // Ascension
};

// --- HMAC Token functions ---
async function createToken(username: string, secret: string): Promise<string> {
	const timestamp = Date.now().toString();
	const data = `${username}:${timestamp}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
	const hmacHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
	return `${username}:${timestamp}:${hmacHex}`;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
	const parts = token.split(':');
	if (parts.length < 3) return null;

	// Username could contain colons? No — we validate alphanumeric+underscore.
	// But to be safe, rejoin: the format is username:timestamp:hmac
	const hmacHex = parts[parts.length - 1];
	const timestamp = parts[parts.length - 2];
	const username = parts.slice(0, parts.length - 2).join(':');

	if (!username || !timestamp || !hmacHex) return null;

	// Check expiry (7 days)
	const tokenAge = Date.now() - parseInt(timestamp, 10);
	if (isNaN(tokenAge) || tokenAge > 7 * 24 * 60 * 60 * 1000 || tokenAge < 0) return null;

	const data = `${username}:${timestamp}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify']
	);

	// Convert hex back to bytes
	const sigBytes = new Uint8Array(hmacHex.length / 2);
	for (let i = 0; i < sigBytes.length; i++) {
		sigBytes[i] = parseInt(hmacHex.substring(i * 2, i * 2 + 2), 16);
	}

	const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
	return valid ? username : null;
}

// Extract and verify username from Authorization header
async function getUsernameFromRequest(request: Request, secret: string): Promise<string | null> {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.slice(7).trim();
	if (!token) return null;
	return verifyToken(token, secret);
}

// --- Salted password hashing ---
function generateSalt(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(salt + password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Legacy unsalted hash for migration
async function hashPasswordLegacy(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Ensure users table has level/experience/currency/salt columns (idempotent, runs once per worker lifetime)
async function ensureUserColumns(db: D1Database): Promise<void> {
	if (columnsEnsured) return;

	const columns = [
		"ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1",
		"ALTER TABLE users ADD COLUMN experience INTEGER DEFAULT 0",
		"ALTER TABLE users ADD COLUMN currency INTEGER DEFAULT 0",
		"ALTER TABLE users ADD COLUMN salt TEXT DEFAULT NULL",
	];

	for (const sql of columns) {
		try {
			await db.exec(sql);
		} catch (e: any) {
			if (e.message && e.message.includes('duplicate column')) {
				// Column already exists, safe to ignore
			} else {
				throw e;
			}
		}
	}

	columnsEnsured = true;
}

// --- Input validation ---
function validateUsername(username: string): string | null {
	if (!username || username.length < 1 || username.length > 30) {
		return 'Username must be 1-30 characters';
	}
	if (!/^[a-zA-Z0-9_]+$/.test(username)) {
		return 'Username must be alphanumeric (underscores allowed)';
	}
	return null;
}

function validatePassword(password: string): string | null {
	if (!password || password.length < 4) {
		return 'Password must be at least 4 characters';
	}
	return null;
}

// --- Rate limiting helpers ---
function isRateLimited(username: string): boolean {
	const entry = failedLoginAttempts.get(username);
	if (!entry) return false;
	if (Date.now() - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
		failedLoginAttempts.delete(username);
		return false;
	}
	return entry.count >= RATE_LIMIT_MAX;
}

function recordFailedLogin(username: string): void {
	const entry = failedLoginAttempts.get(username);
	if (!entry || Date.now() - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
		failedLoginAttempts.set(username, { count: 1, lastAttempt: Date.now() });
	} else {
		entry.count++;
		entry.lastAttempt = Date.now();
	}
}

function clearFailedLogins(username: string): void {
	failedLoginAttempts.delete(username);
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const apiHeaders = makeApiHeaders(request);

		// Handle CORS preflight requests for API routes
		if (request.method === 'OPTIONS' && url.pathname.startsWith('/api')) {
			return new Response(null, { status: 204, headers: apiHeaders });
		}

		// --- API ROUTES ---
		if (url.pathname.startsWith('/api')) {

			// --- Auth: Register ---
			if (url.pathname === '/api/auth/register' && request.method === 'POST') {
				try {
					const { username, password } = await request.json() as { username: string; password: string };

					const usernameError = validateUsername(username);
					if (usernameError) {
						return new Response(JSON.stringify({ error: usernameError }), { status: 400, headers: apiHeaders });
					}
					const passwordError = validatePassword(password);
					if (passwordError) {
						return new Response(JSON.stringify({ error: passwordError }), { status: 400, headers: apiHeaders });
					}

					await ensureUserColumns(env.DB);

					const existingUser = await env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
					if (existingUser) {
						return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: apiHeaders });
					}

					const salt = generateSalt();
					const hashedPassword = await hashPasswordWithSalt(password, salt);

					await env.DB.prepare("INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)").bind(username, hashedPassword, salt).run();
					return new Response(JSON.stringify({ message: "User registered successfully" }), { status: 201, headers: apiHeaders });
				} catch (error) {
					console.error("Error during registration:", error);
					return new Response(JSON.stringify({ error: "Internal server error during registration" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- Auth: Login ---
			if (url.pathname === '/api/auth/login' && request.method === 'POST') {
				try {
					const { username, password } = await request.json() as { username: string; password: string };
					if (!username || !password) {
						return new Response(JSON.stringify({ error: "Username and password are required" }), { status: 400, headers: apiHeaders });
					}

					// Rate limiting
					if (isRateLimited(username)) {
						return new Response(JSON.stringify({ error: "Too many failed attempts. Try again in a few minutes." }), { status: 429, headers: apiHeaders });
					}

					await ensureUserColumns(env.DB);

					const user = await env.DB.prepare("SELECT username, password_hash, salt FROM users WHERE username = ?").bind(username).first<{ username: string; password_hash: string; salt: string | null }>();

					if (!user) {
						await delay(1000);
						recordFailedLogin(username);
						return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: apiHeaders });
					}

					let isPasswordValid = false;

					if (user.salt) {
						// New salted hash
						const hash = await hashPasswordWithSalt(password, user.salt);
						isPasswordValid = hash === user.password_hash;
					} else {
						// Legacy unsalted hash — migrate on successful login
						const legacyHash = await hashPasswordLegacy(password);
						isPasswordValid = legacyHash === user.password_hash;

						if (isPasswordValid) {
							// Migrate to salted hash
							const newSalt = generateSalt();
							const newHash = await hashPasswordWithSalt(password, newSalt);
							await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE username = ?").bind(newHash, newSalt, username).run();
						}
					}

					if (!isPasswordValid) {
						await delay(1000);
						recordFailedLogin(username);
						return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: apiHeaders });
					}

					clearFailedLogins(username);
					const token = await createToken(user.username, env.AUTH_SECRET);
					return new Response(JSON.stringify({ message: "Login successful", token, user: { username: user.username } }), { status: 200, headers: apiHeaders });
				} catch (error) {
					console.error("Error during login:", error);
					return new Response(JSON.stringify({ error: "Internal server error during login" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- User /me route ---
			if (url.pathname === '/api/game/me' && request.method === 'GET') {
				try {
					const username = await getUsernameFromRequest(request, env.AUTH_SECRET);
					if (!username) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: apiHeaders });
					}
					await ensureUserColumns(env.DB);
					const user = await env.DB.prepare("SELECT username, level, experience, currency FROM users WHERE username = ?").bind(username).first<{ username: string; level: number; experience: number; currency: number }>();
					if (!user) {
						return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: apiHeaders });
					}
					return Response.json({ username: user.username, level: user.level ?? 1, experience: user.experience ?? 0, currency: user.currency ?? 0 }, { headers: apiHeaders });
				} catch (error) {
					console.error("Error fetching user stats:", error);
					return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- Vocabulary ---
			if (url.pathname === '/api/vocabulary' && request.method === 'GET') {
				try {
					const { results } = await env.DB.prepare(
						"SELECT tulu_word, english_translation, image_name FROM vocabulary"
					).all();
					return Response.json(results, { headers: apiHeaders });
				} catch (error) {
					console.error("Error fetching vocabulary:", error);
					return new Response(JSON.stringify({ error: "Error fetching vocabulary" }), { status: 500, headers: apiHeaders });
				}
			}

			if (url.pathname === '/api/vocabulary/with-images' && request.method === 'GET') {
				try {
					const { results } = await env.DB.prepare(
						"SELECT tulu_word, english_translation, image_name FROM vocabulary WHERE image_name IS NOT NULL AND image_name != ''"
					).all();
					return Response.json(results, { headers: apiHeaders });
				} catch (error) {
					console.error("Error fetching vocabulary with images:", error);
					return new Response(JSON.stringify({ error: "Error fetching vocabulary with images" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- Game: Question ---
			if (url.pathname === '/api/game/question' && request.method === 'GET') {
				try {
					const username = await getUsernameFromRequest(request, env.AUTH_SECRET);
					let userStats = { level: 1, experience: 0, currency: 0 };
					if (username) {
						await ensureUserColumns(env.DB);
						const user = await env.DB.prepare("SELECT level, experience, currency FROM users WHERE username = ?").bind(username).first<{ level: number; experience: number; currency: number }>();
						if (user) {
							userStats = { level: user.level ?? 1, experience: user.experience ?? 0, currency: user.currency ?? 0 };
						}
					}

					const countResult = await env.DB.prepare("SELECT COUNT(*) as count FROM vocabulary").first<{ count: number }>();
					const totalVocabulary = countResult ? countResult.count : 0;

					if (totalVocabulary === 0) {
						return new Response(JSON.stringify({ question: null, userStats }), { status: 200, headers: apiHeaders });
					}

					const randomOffset = Math.floor(Math.random() * totalVocabulary);
					const randomVocab = await env.DB.prepare(
						"SELECT id, tulu_word, english_translation, image_name, tulu_sentence_roman, sentence_english_translation FROM vocabulary LIMIT 1 OFFSET ?"
					).bind(randomOffset).all().then(res => res.results as { id: number; tulu_word: string; english_translation: string; image_name: string; tulu_sentence_roman: string; sentence_english_translation: string }[]);

					if (!randomVocab || randomVocab.length === 0) {
						return new Response(JSON.stringify({ question: null, userStats }), { status: 200, headers: apiHeaders });
					}

					const correctVocab = randomVocab[0];

					const incorrectOptions: string[] = [];
					while (incorrectOptions.length < 3) {
						const randomIncorrectOffset = Math.floor(Math.random() * totalVocabulary);
						const incorrectVocab = await env.DB.prepare(
							"SELECT english_translation FROM vocabulary LIMIT 1 OFFSET ?"
						).bind(randomIncorrectOffset).all().then(res => res.results as { english_translation: string }[]);

						if (incorrectVocab.length > 0 && incorrectVocab[0].english_translation !== correctVocab.english_translation && !incorrectOptions.includes(incorrectVocab[0].english_translation)) {
							incorrectOptions.push(incorrectVocab[0].english_translation);
						}
					}

					const options = [correctVocab.english_translation, ...incorrectOptions].sort(() => Math.random() - 0.5);

					const question = {
						id: correctVocab.id,
						type: 'translation',
						question_text: `What is the English translation of "${correctVocab.tulu_word}"?`,
						options,
						image_name: correctVocab.image_name || null,
						tulu_sentence_roman: correctVocab.tulu_sentence_roman || null,
						sentence_english_translation: correctVocab.sentence_english_translation || null,
					};

					return Response.json({ question, userStats }, { headers: apiHeaders });

				} catch (error) {
					console.error("Error generating question:", error);
					return new Response(JSON.stringify({ error: "Error generating question" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- Game: Answer ---
			if (url.pathname === '/api/game/answer' && request.method === 'POST') {
				try {
					const { questionId, selectedAnswer, questionType } = await request.json() as { questionId: number; selectedAnswer: string; questionType: string };

					const correctVocab = await env.DB.prepare(
						"SELECT english_translation FROM vocabulary WHERE id = ?"
					).bind(questionId).first<{ english_translation: string }>();

					if (!correctVocab) {
						return new Response(JSON.stringify({ error: "Invalid question ID" }), { status: 400, headers: apiHeaders });
					}

					const isCorrect = correctVocab.english_translation === selectedAnswer;

					let experienceGain = 0;
					let currencyGain = 0;
					if (isCorrect) {
						experienceGain = 10;
						currencyGain = 5;
					}

					let userStats = { level: 1, experience: 0, currency: 0 };
					const username = await getUsernameFromRequest(request, env.AUTH_SECRET);
					if (username) {
						await ensureUserColumns(env.DB);
						const user = await env.DB.prepare("SELECT level, experience, currency FROM users WHERE username = ?").bind(username).first<{ level: number; experience: number; currency: number }>();
						if (user) {
							const newExperience = (user.experience ?? 0) + experienceGain;
							const newCurrency = (user.currency ?? 0) + currencyGain;
							const newLevel = calculateLevel(newExperience);
							await env.DB.prepare("UPDATE users SET experience = ?, level = ?, currency = ? WHERE username = ?").bind(newExperience, newLevel, newCurrency, username).run();
							userStats = { level: newLevel, experience: newExperience, currency: newCurrency };
						}
					}

					return Response.json({
						isCorrect,
						correctAnswer: correctVocab.english_translation,
						experienceGain,
						currencyGain,
						userStats,
					}, { headers: apiHeaders });

				} catch (error) {
					console.error("Error processing answer:", error);
					return new Response(JSON.stringify({ error: "Error processing answer" }), { status: 500, headers: apiHeaders });
				}
			}

			// --- Game: Fifty-Fifty ---
			if (url.pathname === '/api/game/fifty-fifty' && request.method === 'POST') {
				try {
					const { questionId } = await request.json() as { questionId: number };

					const correctVocab = await env.DB.prepare(
						"SELECT english_translation FROM vocabulary WHERE id = ?"
					).bind(questionId).first<{ english_translation: string }>();

					if (!correctVocab) {
						return new Response(JSON.stringify({ error: "Invalid question ID" }), { status: 400, headers: apiHeaders });
					}

					// Get one random incorrect option
					const countResult = await env.DB.prepare("SELECT COUNT(*) as count FROM vocabulary").first<{ count: number }>();
					const totalVocabulary = countResult ? countResult.count : 0;

					let incorrectOption: string | null = null;
					while (!incorrectOption) {
						const randomOffset = Math.floor(Math.random() * totalVocabulary);
						const vocab = await env.DB.prepare(
							"SELECT english_translation FROM vocabulary LIMIT 1 OFFSET ?"
						).bind(randomOffset).first<{ english_translation: string }>();

						if (vocab && vocab.english_translation !== correctVocab.english_translation) {
							incorrectOption = vocab.english_translation;
						}
					}

					const options = [correctVocab.english_translation, incorrectOption].sort(() => Math.random() - 0.5);

					return Response.json({ options }, { headers: apiHeaders });

				} catch (error) {
					console.error("Error processing fifty-fifty:", error);
					return new Response(JSON.stringify({ error: "Error processing fifty-fifty" }), { status: 500, headers: apiHeaders });
				}
			}

			return new Response(JSON.stringify({ error: 'API Not Found' }), { status: 404, headers: apiHeaders });
		}

		// --- STATIC ASSET SERVING ---
		return env.ASSETS.fetch(request);
	},
};
