// tulu-titans-web/src/screens/CombatScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { enemies, Enemy } from '../data/enemies';
import { useNavigate } from 'react-router-dom';


interface Question {
  id: number;
  type: string;
  question_text: string;
  options: string[];
  image_name?: string;
  tulu_sentence_roman?: string;
  sentence_english_translation?: string;
}

interface UserStats {
  level: number;
  experience: number;
  currency: number;
}

const INITIAL_HEALTH = 100;
const POWER_UP_CHARGE_THRESHOLD = 3;
const MAX_LEVEL = 5;

// Level scaling: enemies hit harder and have more HP at higher levels
const getLevelMultiplier = (level: number): number => {
  // Level 1: 1.0x, Level 2: 1.3x, Level 3: 1.6x, Level 4: 2.0x, Level 5: 2.5x
  return 1 + (Math.min(level, MAX_LEVEL) - 1) * 0.35 + (Math.max(0, Math.min(level, MAX_LEVEL) - 3) * 0.15);
};

const LEVEL_TITLES: Record<number, string> = {
  1: 'Mortal Acolyte',
  2: 'Blessed Initiate',
  3: 'Demigod Aspirant',
  4: 'Titan Challenger',
  5: 'Olympian Ascendant',
};

const shake = keyframes`
  10%, 90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%, 80% {
    transform: translate3d(2px, 0, 0);
  }
  30%, 50%, 70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%, 60% {
    transform: translate3d(4px, 0, 0);
  }
`;

const CombatScreen = () => {
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userStats, setUserStats] = useState<UserStats>({ level: 1, experience: 0, currency: 0 });
  const [heroHealth, setHeroHealth] = useState<number>(INITIAL_HEALTH);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [monsterHealth, setMonsterHealth] = useState<number>(0);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<string[]>([]);
  const [heroAnimation, setHeroAnimation] = useState('');
  const [monsterAnimation, setMonsterAnimation] = useState('');
  const [answeredCorrectly, setAnsweredCorrectly] = useState(false);
  const [showAnswerImage, setShowAnswerImage] = useState(false);
  const [powerUpCharger, setPowerUpCharger] = useState(0);
  const [heavyAttackCooldown, setHeavyAttackCooldown] = useState(0);
  const [damageDealt, setDamageDealt] = useState<number | null>(null);
  const [healthLost, setHealthLost] = useState<number | null>(null);
  const [showSentence, setShowSentence] = useState(false);
  const [attackPending, setAttackPending] = useState(false);
  const monsterHealthRef = useRef(0);
  const navigate = useNavigate();

  // Keep ref in sync with state
  useEffect(() => {
    monsterHealthRef.current = monsterHealth;
  }, [monsterHealth]);

  const spawnScaledEnemy = useCallback((level: number) => {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const mult = getLevelMultiplier(level);
    const scaled: Enemy = {
      ...enemy,
      health: Math.round(enemy.health * mult),
      attack: Math.round(enemy.attack * mult),
    };
    setCurrentEnemy(scaled);
    setMonsterHealth(scaled.health);
    monsterHealthRef.current = scaled.health;
  }, []);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setShowAnswerImage(false);
    setShowSentence(false);
    setFeedback(null);
    setSelectedAnswer(null);
    setFiftyFiftyUsed(false);
    if (heavyAttackCooldown > 0) {
      setHeavyAttackCooldown(prev => prev - 1);
    }
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/game/question', { headers });
      if (response.ok) {
        const data: { question: Question, userStats: UserStats } = await response.json();
        setQuestion(data.question);
        setUserStats(data.userStats);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setFeedback('Failed to fetch question.');
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      setFeedback('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  }, [heavyAttackCooldown, navigate]);

  // Fetch question first, then spawn enemy at the correct level
  const initGame = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/api/game/question', { headers });
      if (response.ok) {
        const data: { question: Question, userStats: UserStats } = await response.json();
        setQuestion(data.question);
        setUserStats(data.userStats);
        spawnScaledEnemy(data.userStats.level);
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setFeedback('Failed to fetch question.');
      }
    } catch (error) {
      console.error('Error fetching question:', error);
      setFeedback('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  }, [navigate, spawnScaledEnemy]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
        navigate('/login');
        return;
    }
    initGame();
  }, [navigate, initGame]);

  useEffect(() => {
    if (question) {
      setDisplayOptions(question.options);
    }
  }, [question]);

  const useFiftyFifty = async () => {
    if (fiftyFiftyUsed || !question || powerUpCharger < POWER_UP_CHARGE_THRESHOLD) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/game/fifty-fifty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        } as HeadersInit,
        body: JSON.stringify({ questionId: question.id }),
      });

      if (response.ok) {
        const data: { options: string[] } = await response.json();
        setDisplayOptions(data.options);
        setFiftyFiftyUsed(true);
        setPowerUpCharger(0);
      }
    } catch (error) {
      console.error('Error using fifty-fifty:', error);
    }
  };

  const handleAttack = (attackType: 'quick' | 'heavy') => {
    if (!currentEnemy || attackPending) return;
    setAttackPending(true);

    let damage = 0;
    if (attackType === 'quick') {
      damage = 15;
    } else {
      const hit = Math.random() < 0.7;
      if (hit) {
        damage = 30;
        setHeavyAttackCooldown(2);
      } else {
        setFeedback('Heavy attack missed!');
      }
    }

    // Compute expected health synchronously to avoid stale closure
    const expectedHealth = Math.max(0, monsterHealthRef.current - damage);

    if (damage > 0) {
      setMonsterHealth(expectedHealth);
      monsterHealthRef.current = expectedHealth;
      setMonsterAnimation('shake');
      setDamageDealt(damage);
    } else {
      setDamageDealt(null);
    }

    setAnsweredCorrectly(false);

    setTimeout(() => {
      setMonsterAnimation('');
      setDamageDealt(null);
      if (expectedHealth <= 0 && damage > 0) {
        setFeedback(prev => prev ? prev + " Monster defeated!" : "Monster defeated!");
        setTimeout(() => {
            spawnScaledEnemy(userStats.level);
            fetchQuestion();
            setAttackPending(false);
        }, 2000);
      } else {
        fetchQuestion();
        setAttackPending(false);
      }
    }, 1000);
  };


  const handleAnswerSubmit = async () => {
    if (!question || !selectedAnswer || !currentEnemy) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        } as HeadersInit,
        body: JSON.stringify({ questionId: question.id, selectedAnswer, questionType: question.type }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isCorrect) {
          setFeedback(`Correct! +${result.experienceGain} XP, +${result.currencyGain} Coins`);
          setAnsweredCorrectly(true);
          setPowerUpCharger(prev => prev + 1);
          setShowAnswerImage(true);
        } else {
          setFeedback(`Incorrect. The correct answer was: ${result.correctAnswer}`);
          setShowAnswerImage(true);
          const damage = currentEnemy.attack;
          const newHealth = Math.max(0, heroHealth - damage);
          setHeroHealth(newHealth);
          setHeroAnimation('shake');
          setHealthLost(damage);

          if (newHealth <= 0) {
            setTimeout(() => {
              setHealthLost(null);
              setHeroAnimation('');
              alert("Game Over! You were defeated by the monster.");
              setHeroHealth(INITIAL_HEALTH);
              spawnScaledEnemy(result.userStats.level);
              navigate('/');
            }, 2000);
            setUserStats(result.userStats);
            return;
          }

          setTimeout(() => {
            fetchQuestion();
            setHealthLost(null);
          }, 2000);
        }
        setUserStats(result.userStats);
        // Check for ascension — player has surpassed level 5
        if (result.userStats.level > MAX_LEVEL) {
          setTimeout(() => navigate('/ascension'), 1500);
          return;
        }
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        const errorData = await response.json();
        setFeedback(`Error submitting answer: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setFeedback('Error connecting to server.');
    }

    setTimeout(() => {
      setHeroAnimation('');
    }, 500);
  };


  if (loading || !currentEnemy) {
    return <CombatContainer>Summoning Challenge...</CombatContainer>;
  }

  if (!question) {
    return <CombatContainer>{feedback || 'No challenge available.'}</CombatContainer>;
  }

  return (
    <CombatContainer>
      <Header>Clash of Titans</Header>
      <UserStatsContainer>
        <StatItem>Level: {userStats.level} — {LEVEL_TITLES[Math.min(userStats.level, MAX_LEVEL)] || 'Divine Being'}</StatItem>
        <StatItem>XP: {userStats.experience}</StatItem>
        <StatItem>Coins: {userStats.currency}</StatItem>
      </UserStatsContainer>
      <CombatArea>
        <CharacterContainer>
          <Character src="/images/hero.jpeg" alt="Mythical Hero" className={heroAnimation} />
          {healthLost && <DamageText>{`-${healthLost}`}</DamageText>}
          <HealthBar value={heroHealth} max={INITIAL_HEALTH}>Hero's Might</HealthBar>
        </CharacterContainer>
        <VsText>VS</VsText>
        <CharacterContainer>
          <Character src={currentEnemy.image} alt={currentEnemy.name} className={monsterAnimation} />
          {damageDealt && <DamageText>{`-${damageDealt}`}</DamageText>}
          <HealthBar value={monsterHealth} max={currentEnemy.health}>{currentEnemy.name}'s Fury</HealthBar>
        </CharacterContainer>
      </CombatArea>

              <QuestionCard>
                <QuestionText>{question.question_text}</QuestionText>        <OptionsList>
          {displayOptions.map((option, index) => (
            <OptionButton
              key={index}
              onClick={() => setSelectedAnswer(option)}
              selected={selectedAnswer === option}
              disabled={answeredCorrectly}
            >
              {option}
            </OptionButton>
          ))}
        </OptionsList>
        <PowerUpButton onClick={useFiftyFifty} disabled={fiftyFiftyUsed || answeredCorrectly || powerUpCharger < POWER_UP_CHARGE_THRESHOLD}>50/50 ({powerUpCharger}/{POWER_UP_CHARGE_THRESHOLD})</PowerUpButton>
        {!answeredCorrectly && <SubmitButton onClick={handleAnswerSubmit} disabled={!selectedAnswer}>
          Unleash Answer
        </SubmitButton>}
        {answeredCorrectly && (
          <AttackOptions>
            <AttackButton onClick={() => handleAttack('quick')} disabled={attackPending}>Quick Attack</AttackButton>
            {heavyAttackCooldown <= 0 && (
              <AttackButton onClick={() => handleAttack('heavy')} disabled={attackPending}>Heavy Attack</AttackButton>
            )}
          </AttackOptions>
        )}
        {feedback && <FeedbackText>{feedback}</FeedbackText>}
        {showAnswerImage && question?.image_name && (
          <QuestionImage
            src={`/images/${question.image_name}`}
            alt="Question visual aid"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {/* Sentence display hidden until data is cleaned up
        {question?.tulu_sentence_roman && !showSentence && (
          <ShowExampleButton onClick={() => setShowSentence(true)}>Show Example Sentence</ShowExampleButton>
        )}
        {showSentence && question?.tulu_sentence_roman && (
          <SentenceContainer>
            <SentenceText>{question.tulu_sentence_roman}</SentenceText>
            {question.sentence_english_translation && (
              <SentenceTranslation>{question.sentence_english_translation}</SentenceTranslation>
            )}
            <DisclaimerText>Auto-generated — may contain errors</DisclaimerText>
          </SentenceContainer>
        )}
        */}
      </QuestionCard>
    </CombatContainer>
  );
};

const CombatContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-image: url('/images/background.jpeg');
  background-size: cover;
  background-position: center;
  min-height: 100vh;
  color: #fff;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
`;

const Header = styled.h1`
  font-family: 'Cinzel Decorative', cursive;
  color: #ffd700;
  margin-bottom: 30px;
  font-size: 3em;
  text-transform: uppercase;
  letter-spacing: 3px;
`;

const UserStatsContainer = styled.div`
  display: flex;
  justify-content: space-around;
  width: 80%;
  margin-bottom: 20px;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  border: 1px solid #c0c0c0;
`;

const StatItem = styled.p`
  font-family: 'Verdana', sans-serif;
  font-size: 1.2em;
  font-weight: bold;
  color: #f0f8ff;
`;

const CombatArea = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 90%;
  margin-bottom: 40px;
  min-height: 200px;
`;

const CharacterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 10px;
`;

const Character = styled.img`
  width: 180px;
  height: 180px;
  object-fit: cover;
  border-radius: 10px;
  border: 5px solid #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.7);

  &.shake {
    animation: ${shake} 0.82s cubic-bezier(.36,.07,.19,.97) both;
  }
`;

const DamageText = styled.p`
  position: absolute;
  font-size: 2em;
  color: red;
  font-weight: bold;
  animation: ${keyframes`
    0% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 0;
      transform: translateY(-50px);
    }
  `} 1s forwards;
`;

const VsText = styled.span`
  font-family: 'Cinzel Decorative', cursive;
  font-size: 4em;
  font-weight: bold;
  color: #8b0000;
  margin: 0 30px;
  text-shadow: 3px 3px 5px rgba(0, 0, 0, 0.9);
`;

const HealthBar = styled.progress`
  width: 120px;
  height: 25px;
  margin-top: 15px;
  border-radius: 5px;
  border: 1px solid #333;
  &::-webkit-progress-bar {
    background-color: #555;
    border-radius: 5px;
  }
  &::-webkit-progress-value {
    background-color: #3cb371;
    border-radius: 5px;
  }
`;

const QuestionCard = styled.div`
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  padding: 35px;
  width: 70%;
  max-width: 700px;
  text-align: center;
  color: #333;
  border: 3px solid #a0522d;
`;

const QuestionText = styled.h2`
  font-family: 'Georgia', serif;
  color: #2f4f4f;
  margin-bottom: 25px;
  font-size: 1.8em;
`;

const OptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 25px;
`;

const PowerUpButton = styled.button`
  background-color: #ffd700;
  color: #000;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-family: 'Verdana', sans-serif;
  font-size: 1em;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 10px;

  &:hover {
    background-color: #ffc400;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const AttackOptions = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
`;

const AttackButton = styled.button`
  background-color: #dc143c;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-family: 'Verdana', sans-serif;
  font-size: 1em;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #b22222;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

interface OptionButtonProps {
  selected: boolean;
}

const OptionButton = styled.button<OptionButtonProps>`
  background-color: ${(props) => (props.selected ? '#6a5acd' : '#dcdcdc')};
  color: ${(props) => (props.selected ? '#f0f8ff' : '#333')};
  border: 2px solid ${(props) => (props.selected ? '#483d8b' : '#a0522d')};
  border-radius: 10px;
  padding: 15px 25px;
  font-family: 'Verdana', sans-serif;
  font-size: 1.2em;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background-color: ${(props) => (props.selected ? '#483d8b' : '#b0c4de')};
    color: ${(props) => (props.selected ? '#f0f8ff' : '#333')};
    transform: translateY(-2px);
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const SubmitButton = styled.button`
  background-color: #8b4513;
  color: #f5f5dc;
  border: none;
  border-radius: 10px;
  padding: 18px 35px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.4em;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
  &:hover {
    background-color: #a0522d;
    transform: translateY(-3px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.5);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const FeedbackText = styled.p`
  margin-top: 25px;
  font-family: 'Georgia', serif;
  font-size: 1.4em;
  font-weight: bold;
  color: #ff4500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
`;

const QuestionImage = styled.img`
  max-width: 80%;
  max-height: 200px;
  object-fit: contain;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
`;

const ShowExampleButton = styled.button`
  background-color: #4682b4;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-family: 'Verdana', sans-serif;
  font-size: 0.95em;
  cursor: pointer;
  margin-top: 15px;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #36648b;
  }
`;

const SentenceContainer = styled.div`
  margin-top: 15px;
  padding: 15px;
  background-color: rgba(70, 130, 180, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(70, 130, 180, 0.3);
`;

const SentenceText = styled.p`
  font-family: 'Georgia', serif;
  font-size: 1.2em;
  font-weight: bold;
  color: #2f4f4f;
  margin-bottom: 8px;
`;

const SentenceTranslation = styled.p`
  font-family: 'Georgia', serif;
  font-size: 1.05em;
  color: #555;
  font-style: italic;
  margin-bottom: 8px;
`;

const DisclaimerText = styled.p`
  font-size: 0.8em;
  color: #999;
  font-style: italic;
`;

export default CombatScreen;
