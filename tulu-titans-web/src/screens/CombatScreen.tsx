// tulu-titans-web/src/screens/CombatScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
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
const HEAVY_ATTACK_CHARGE_THRESHOLD = 3;
const MAX_LEVEL = 5;
const DODGE_TIME_LIMIT = 10; // seconds to answer for dodge chance
const CRIT_CHANCE = 0.2;
const CRIT_MULTIPLIER = 1.5; // 50 * 1.5 = 75 on crit

const getLevelMultiplier = (level: number): number => {
  return 1 + (Math.min(level, MAX_LEVEL) - 1) * 0.35 + (Math.max(0, Math.min(level, MAX_LEVEL) - 3) * 0.15);
};

const LEVEL_TITLES: Record<number, string> = {
  1: 'Mortal Acolyte',
  2: 'Blessed Initiate',
  3: 'Demigod Aspirant',
  4: 'Titan Challenger',
  5: 'Olympian Ascendant',
};

// --- Keyframe animations ---
const shake = keyframes`
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
`;

const heavyShake = keyframes`
  0% { transform: translate3d(0, 0, 0); filter: brightness(3); }
  10% { transform: translate3d(-8px, -4px, 0); filter: brightness(2); }
  20% { transform: translate3d(8px, 2px, 0); filter: brightness(1.5); }
  30% { transform: translate3d(-6px, -2px, 0); }
  40% { transform: translate3d(6px, 4px, 0); }
  50% { transform: translate3d(-4px, -2px, 0); }
  60% { transform: translate3d(4px, 2px, 0); }
  80% { transform: translate3d(-2px, 0, 0); }
  100% { transform: translate3d(0, 0, 0); filter: brightness(1); }
`;

const lunge = keyframes`
  0% { transform: translateX(0); }
  30% { transform: translateX(40px) scale(1.1); }
  60% { transform: translateX(40px) scale(1.1); }
  100% { transform: translateX(0) scale(1); }
`;

const monsterDeath = keyframes`
  0% { transform: scale(1); opacity: 1; filter: brightness(1); }
  20% { transform: scale(1.1); filter: brightness(2); }
  40% { transform: scale(1.05); opacity: 0.8; filter: brightness(3) saturate(0); }
  100% { transform: scale(0); opacity: 0; filter: brightness(5) saturate(0); }
`;

const critFlash = keyframes`
  0% { opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.3); }
  60% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.5); }
`;

const comboPopIn = keyframes`
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
`;

const timerShrink = keyframes`
  from { width: 100%; }
  to { width: 0%; }
`;

const dodgeFlash = keyframes`
  0% { opacity: 0; transform: translateY(0); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-30px); }
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
  const [heavyAttackCharge, setHeavyAttackCharge] = useState(0);
  const [damageDealt, setDamageDealt] = useState<number | null>(null);
  const [healthLost, setHealthLost] = useState<number | null>(null);
  const [attackPending, setAttackPending] = useState(false);
  // Combo streak
  const [comboStreak, setComboStreak] = useState(0);
  const [showComboPopup, setShowComboPopup] = useState(false);
  // Monster defeat
  const [monsterDying, setMonsterDying] = useState(false);
  const [showVictoryText, setShowVictoryText] = useState(false);
  // Dodge timer
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timerActive, setTimerActive] = useState(false);
  const [showDodgeText, setShowDodgeText] = useState(false);
  // Critical hit
  const [showCritText, setShowCritText] = useState(false);
  const [imageRevealed, setImageRevealed] = useState(false);

  const monsterHealthRef = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    setMonsterDying(false);
    setShowVictoryText(false);
  }, []);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setShowAnswerImage(false);
    setFeedback(null);
    setSelectedAnswer(null);
    setFiftyFiftyUsed(false);
    setShowDodgeText(false);
    setShowCritText(false);
    setImageRevealed(false);
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/game/question', { headers });
      if (response.ok) {
        const data: { question: Question, userStats: UserStats } = await response.json();
        setQuestion(data.question);
        setUserStats(data.userStats);
        setQuestionStartTime(Date.now());
        setTimerActive(true);
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
  }, [navigate]);

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
        setQuestionStartTime(Date.now());
        setTimerActive(true);
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
    if (!token) { navigate('/login'); return; }
    initGame();
  }, [navigate, initGame]);

  useEffect(() => {
    if (question) setDisplayOptions(question.options);
  }, [question]);

  const getComboMultiplier = (streak: number): number => {
    if (streak < 2) return 1;
    if (streak < 4) return 1.5;
    if (streak < 6) return 2;
    if (streak < 10) return 2.5;
    return 3;
  };

  const useFiftyFifty = async () => {
    if (fiftyFiftyUsed || !question || powerUpCharger < POWER_UP_CHARGE_THRESHOLD) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/game/fifty-fifty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } as HeadersInit,
        body: JSON.stringify({ questionId: question.id, currentOptions: displayOptions }),
      });
      if (response.ok) {
        const data: { options: string[] } = await response.json();
        setDisplayOptions(data.options);
        setSelectedAnswer(null);
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

    let damage: number;
    let isCrit = false;

    if (attackType === 'heavy') {
      damage = 50;
      // Critical hit check
      if (Math.random() < CRIT_CHANCE) {
        damage = Math.round(50 * CRIT_MULTIPLIER);
        isCrit = true;
      }
      setHeavyAttackCharge(0);
    } else {
      damage = 15;
    }

    const expectedHealth = Math.max(0, monsterHealthRef.current - damage);

    setMonsterHealth(expectedHealth);
    monsterHealthRef.current = expectedHealth;
    setHeroAnimation('lunge');
    setDamageDealt(damage);
    setAnsweredCorrectly(false);

    if (isCrit) {
      setShowCritText(true);
      setMonsterAnimation('heavyShake');
    } else {
      setMonsterAnimation(attackType === 'heavy' ? 'heavyShake' : 'shake');
    }

    setTimeout(() => {
      setHeroAnimation('');
      setDamageDealt(null);
      setShowCritText(false);

      if (expectedHealth <= 0) {
        // Monster defeat animation
        setMonsterAnimation('dying');
        setMonsterDying(true);
        setShowVictoryText(true);
        setFeedback(null);

        setTimeout(() => {
          setShowVictoryText(false);
          spawnScaledEnemy(userStats.level);
          fetchQuestion();
          setAttackPending(false);
        }, 2500);
      } else {
        setMonsterAnimation('');
        fetchQuestion();
        setAttackPending(false);
      }
    }, 1000);
  };

  const handleAnswerSubmit = async () => {
    if (!question || !selectedAnswer || !currentEnemy) return;

    setTimerActive(false);
    const answerTime = (Date.now() - questionStartTime) / 1000;
    const answeredFast = answerTime <= DODGE_TIME_LIMIT;

    try {
      const token = localStorage.getItem('token');
      const combo = comboStreak + 1; // optimistic for correct
      const multiplier = getComboMultiplier(combo);

      const response = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } as HeadersInit,
        body: JSON.stringify({
          questionId: question.id,
          selectedAnswer,
          questionType: question.type,
          comboMultiplier: multiplier,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isCorrect) {
          const newStreak = comboStreak + 1;
          setComboStreak(newStreak);
          if (newStreak >= 2) {
            setShowComboPopup(true);
            setTimeout(() => setShowComboPopup(false), 1500);
          }
          const mult = getComboMultiplier(newStreak);
          const xpText = mult > 1
            ? `+${result.experienceGain} XP (x${mult}), +${result.currencyGain} Coins`
            : `+${result.experienceGain} XP, +${result.currencyGain} Coins`;
          setFeedback(`Correct! ${xpText}`);
          setAnsweredCorrectly(true);
          setPowerUpCharger(prev => prev + 1);
          setHeavyAttackCharge(prev => prev + 1);
          setShowAnswerImage(true);
          setTimeout(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } else {
          // Reset combo on wrong answer
          setComboStreak(0);

          setFeedback(`Incorrect. The correct answer was: ${result.correctAnswer}`);
          setShowAnswerImage(true);
          setTimeout(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

          // Dodge mechanic
          let damage = currentEnemy.attack;
          if (answeredFast) {
            damage = Math.round(damage * 0.5);
            setShowDodgeText(true);
            setTimeout(() => setShowDodgeText(false), 1500);
          }

          const newHealth = Math.max(0, heroHealth - damage);
          setHeroHealth(newHealth);
          setHeroAnimation('shake');
          setHealthLost(damage);

          if (newHealth <= 0) {
            // Reset stats on server
            const resetToken = localStorage.getItem('token');
            fetch('/api/game/reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resetToken}` } as HeadersInit,
            }).catch(() => {});

            setTimeout(() => {
              setHealthLost(null);
              setHeroAnimation('');
              alert("Game Over! You were defeated. Your rank has been reset.");
              setHeroHealth(INITIAL_HEALTH);
              setComboStreak(0);
              setHeavyAttackCharge(0);
              setPowerUpCharger(0);
              setUserStats({ level: 1, experience: 0, currency: 0 });
              spawnScaledEnemy(1);
              fetchQuestion();
            }, 2000);
            return;
          }

          setTimeout(() => {
            fetchQuestion();
            setHealthLost(null);
            setHeroAnimation('');
          }, 2000);
        }
        setUserStats(result.userStats);
        if (result.userStats.level > MAX_LEVEL) {
          setTimeout(() => navigate('/ascension'), 1500);
          return;
        }
      } else if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        const errorData = await response.json();
        setFeedback(`Error: ${errorData.error || errorData.message}`);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      setFeedback('Error connecting to server.');
    }

    setTimeout(() => setHeroAnimation(''), 500);
  };

  if (loading || !currentEnemy) {
    return <CombatContainer>Summoning Challenge...</CombatContainer>;
  }

  if (!question) {
    return <CombatContainer>{feedback || 'No challenge available.'}</CombatContainer>;
  }

  const fiftyFiftyReady = !fiftyFiftyUsed && !answeredCorrectly && powerUpCharger >= POWER_UP_CHARGE_THRESHOLD;

  return (
    <CombatContainer>
      <Header>Clash of Titans</Header>
      <UserStatsContainer>
        <StatItem>Lvl {userStats.level} — {LEVEL_TITLES[Math.min(userStats.level, MAX_LEVEL)] || 'Divine Being'}</StatItem>
        <StatItem>XP: {userStats.experience}</StatItem>
        <StatItem>Coins: {userStats.currency}</StatItem>
        {!answeredCorrectly && (
          <FiftyFiftyPill onClick={useFiftyFifty} disabled={!fiftyFiftyReady}>
            50/50 {fiftyFiftyUsed ? '(used)' : `(${powerUpCharger}/${POWER_UP_CHARGE_THRESHOLD})`}
          </FiftyFiftyPill>
        )}
      </UserStatsContainer>

      {/* Combo streak display */}
      {comboStreak >= 2 && (
        <ComboDisplay $show={showComboPopup}>
          x{getComboMultiplier(comboStreak)} Combo! ({comboStreak} streak)
        </ComboDisplay>
      )}

      {/* Dodge timer bar */}
      {timerActive && !answeredCorrectly && (
        <TimerBarContainer>
          <TimerBar $duration={DODGE_TIME_LIMIT} />
          <TimerLabel>Dodge window</TimerLabel>
        </TimerBarContainer>
      )}

      <CombatArea>
        <CharacterContainer>
          <Character src="/images/hero.jpeg" alt="Mythical Hero" className={heroAnimation} />
          {healthLost && <DamageText>{`-${healthLost}`}</DamageText>}
          {showDodgeText && <DodgeText>DODGED!</DodgeText>}
          <HealthBar value={heroHealth} max={INITIAL_HEALTH}>Hero's Might</HealthBar>
        </CharacterContainer>
        <VsText>VS</VsText>
        <CharacterContainer>
          {!monsterDying ? (
            <Character src={currentEnemy.image} alt={currentEnemy.name} className={monsterAnimation} />
          ) : (
            <CharacterDying src={currentEnemy.image} alt={currentEnemy.name} />
          )}
          {damageDealt && <DamageText $crit={showCritText}>{showCritText ? `CRIT! -${damageDealt}` : `-${damageDealt}`}</DamageText>}
          {showCritText && <CritFlashOverlay />}
          {showVictoryText && <VictoryText>DEFEATED!</VictoryText>}
          {!monsterDying && <HealthBar value={monsterHealth} max={currentEnemy.health}>{currentEnemy.name}'s Fury</HealthBar>}
        </CharacterContainer>
      </CombatArea>

      <QuestionCard>
        <QuestionText>{question.question_text}</QuestionText>
        <OptionsList>
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
        {!answeredCorrectly && (
          <SubmitButton onClick={handleAnswerSubmit} disabled={!selectedAnswer}>
            <ButtonIcon>&#9876;</ButtonIcon> Unleash Answer
          </SubmitButton>
        )}
        {answeredCorrectly && (
          <AttackOptions>
            <AttackButton onClick={() => handleAttack('quick')} disabled={attackPending}>
              <ButtonIcon>&#9889;</ButtonIcon> Quick Strike
              <DamageLabel>15 dmg</DamageLabel>
            </AttackButton>
            <HeavyAttackButton
              onClick={() => handleAttack('heavy')}
              disabled={attackPending || heavyAttackCharge < HEAVY_ATTACK_CHARGE_THRESHOLD}
            >
              <ButtonIcon>{heavyAttackCharge >= HEAVY_ATTACK_CHARGE_THRESHOLD ? '\u{1F525}' : '\u{1F5E1}'}</ButtonIcon>
              {' '}Titan Smash
              {heavyAttackCharge >= HEAVY_ATTACK_CHARGE_THRESHOLD
                ? <DamageLabel>50 dmg</DamageLabel>
                : <ChargeBar><ChargeFill $progress={heavyAttackCharge / HEAVY_ATTACK_CHARGE_THRESHOLD} /><ChargeText>{heavyAttackCharge}/{HEAVY_ATTACK_CHARGE_THRESHOLD}</ChargeText></ChargeBar>
              }
            </HeavyAttackButton>
          </AttackOptions>
        )}
        <div ref={feedbackRef}>
        {feedback && <FeedbackText>{feedback}</FeedbackText>}
        {showAnswerImage && question?.image_name && (
          <ImagePane>
            <ImageToggle onClick={() => setImageRevealed(prev => !prev)}>
              {imageRevealed ? 'Hide Image' : 'View Image'} 🖼
            </ImageToggle>
            {imageRevealed && (
              <QuestionImage
                src={`/images/${question.image_name}`}
                alt="Question visual aid"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </ImagePane>
        )}
        </div>
      </QuestionCard>
    </CombatContainer>
  );
};

// ========== STYLED COMPONENTS ==========

const CombatContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px;
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
  margin-bottom: 8px;
  font-size: 2.2em;
  text-transform: uppercase;
  letter-spacing: 3px;
`;

const UserStatsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  width: 85%;
  margin-bottom: 10px;
  padding: 12px 20px;
  background: linear-gradient(180deg, rgba(20, 10, 5, 0.85), rgba(40, 20, 10, 0.8));
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 215, 0, 0.3);
`;

const StatItem = styled.span`
  font-family: 'Verdana', sans-serif;
  font-size: 1.1em;
  font-weight: bold;
  color: #ffd700;
`;

const FiftyFiftyPill = styled.button`
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
  border: 1px solid #b8860b;
  border-radius: 20px;
  padding: 6px 16px;
  font-family: 'Verdana', sans-serif;
  font-size: 0.85em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #ffec80, #ffa500);
    transform: scale(1.05);
    box-shadow: 0 2px 10px rgba(255, 215, 0, 0.5);
  }

  &:disabled {
    background: #555;
    color: #888;
    border-color: #444;
    cursor: default;
  }
`;

// --- Combo display ---
const ComboDisplay = styled.div<{ $show: boolean }>`
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.4em;
  font-weight: bold;
  color: #ff6600;
  text-shadow: 0 0 10px rgba(255, 100, 0, 0.8), 0 0 20px rgba(255, 50, 0, 0.5);
  margin-bottom: 5px;
  ${props => props.$show && css`animation: ${comboPopIn} 0.5s ease-out both;`}
`;

// --- Dodge timer ---
const TimerBarContainer = styled.div`
  width: 60%;
  max-width: 500px;
  height: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
`;

const TimerBar = styled.div<{ $duration: number }>`
  height: 100%;
  background: linear-gradient(90deg, #3cb371, #ffd700, #ff4500);
  border-radius: 4px;
  animation: ${timerShrink} ${props => props.$duration}s linear forwards;
`;

const TimerLabel = styled.span`
  position: absolute;
  right: -80px;
  top: -3px;
  font-size: 0.7em;
  color: #aaa;
  white-space: nowrap;
`;

const CombatArea = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 90%;
  margin-bottom: 15px;
  min-height: 170px;
`;

const CharacterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: radial-gradient(ellipse at center, rgba(255, 215, 0, 0.08), rgba(0, 0, 0, 0.4));
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.15);
  position: relative;
`;

const Character = styled.img`
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 10px;
  border: 4px solid #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.7);

  &.shake {
    animation: ${shake} 0.82s cubic-bezier(.36,.07,.19,.97) both;
  }
  &.heavyShake {
    animation: ${heavyShake} 0.9s cubic-bezier(.36,.07,.19,.97) both;
  }
  &.lunge {
    animation: ${lunge} 0.7s ease-in-out both;
  }
`;

const CharacterDying = styled.img`
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 10px;
  border: 4px solid #ffd700;
  animation: ${monsterDeath} 1.5s ease-in forwards;
`;

const DamageText = styled.p<{ $crit?: boolean }>`
  position: absolute;
  top: 20px;
  font-size: ${props => props.$crit ? '2.5em' : '2em'};
  color: ${props => props.$crit ? '#ffd700' : 'red'};
  font-weight: bold;
  text-shadow: ${props => props.$crit ? '0 0 15px rgba(255, 215, 0, 0.8)' : 'none'};
  animation: ${keyframes`
    0% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-50px); }
  `} 1s forwards;
  z-index: 10;
`;

const DodgeText = styled.p`
  position: absolute;
  top: -10px;
  font-size: 1.2em;
  color: #3cb371;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(60, 179, 113, 0.8);
  animation: ${dodgeFlash} 1.5s ease-out forwards;
  z-index: 10;
`;

const CritFlashOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 10px;
  background: radial-gradient(circle, rgba(255,215,0,0.4), transparent 70%);
  animation: ${critFlash} 0.8s ease-out forwards;
  pointer-events: none;
  z-index: 5;
`;

const VictoryText = styled.p`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Cinzel Decorative', cursive;
  font-size: 2em;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.9), 2px 2px 4px rgba(0, 0, 0, 0.9);
  z-index: 10;
  animation: ${comboPopIn} 0.5s ease-out both;
`;

const VsText = styled.span`
  font-family: 'Cinzel Decorative', cursive;
  font-size: 3em;
  font-weight: bold;
  color: #ffd700;
  margin: 0 20px;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.5), 3px 3px 5px rgba(0, 0, 0, 0.9);
`;

const HealthBar = styled.progress`
  width: 140px;
  height: 20px;
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  &::-webkit-progress-bar { background-color: rgba(0, 0, 0, 0.6); border-radius: 10px; }
  &::-webkit-progress-value { background: linear-gradient(90deg, #3cb371, #2ecc71); border-radius: 10px; }
`;

const QuestionCard = styled.div`
  background: linear-gradient(180deg, rgba(15, 10, 5, 0.9), rgba(30, 15, 8, 0.88));
  border-radius: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 215, 0, 0.1);
  padding: 20px 25px;
  width: 70%;
  max-width: 700px;
  text-align: center;
  color: #e8d5b5;
  border: 2px solid rgba(255, 215, 0, 0.3);
`;

const QuestionText = styled.h2`
  font-family: 'Georgia', serif;
  color: #ffd700;
  margin-bottom: 12px;
  font-size: 1.5em;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3), 1px 1px 3px rgba(0, 0, 0, 0.8);
`;

const OptionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(255, 215, 0, 0.3); }
  50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), 0 0 50px rgba(255, 100, 0, 0.3); }
`;

const readyPulse = keyframes`
  0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.1); border-color: #ffd700; }
  50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.9), 0 0 60px rgba(255, 100, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.2); border-color: #fff; }
`;

const AttackOptions = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-top: 10px;
`;

const AttackButton = styled.button`
  background: linear-gradient(135deg, #dc143c 0%, #ff4444 50%, #dc143c 100%);
  background-size: 200% 100%;
  color: #fff;
  border: 2px solid #8b0000;
  border-radius: 12px;
  padding: 14px 28px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 170px;
  position: relative;
  overflow: hidden;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  box-shadow: 0 4px 15px rgba(220, 20, 60, 0.4);

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: ${shimmer} 3s ease-in-out infinite;
  }

  &:hover:not(:disabled) {
    background-position: 100% center;
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 6px 20px rgba(220, 20, 60, 0.6);
    border-color: #ff4444;
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 2px 8px rgba(220, 20, 60, 0.4);
  }

  &:disabled { cursor: not-allowed; opacity: 0.5; filter: grayscale(0.5); }
`;

const HeavyAttackButton = styled.button<{ disabled: boolean }>`
  background: linear-gradient(135deg, #8b0000, #cc0000, #8b0000);
  background-size: 200% 100%;
  color: #ffd700;
  border: 3px solid #ffd700;
  border-radius: 12px;
  padding: 14px 28px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 170px;
  position: relative;
  overflow: hidden;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8);

  ${props => !props.disabled && css`
    animation: ${readyPulse} 2s ease-in-out infinite;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent);
      animation: ${shimmer} 2s ease-in-out infinite;
    }
  `}

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #aa0000, #ee0000, #aa0000);
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 6px 30px rgba(255, 215, 0, 0.7), 0 0 40px rgba(255, 100, 0, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }

  &:disabled {
    background: #333;
    color: #666;
    border-color: #555;
    cursor: not-allowed;
    text-shadow: none;
    box-shadow: none;
  }
`;

const ButtonIcon = styled.span`
  font-size: 1.2em;
  margin-right: 4px;
  vertical-align: middle;
`;

const DamageLabel = styled.span`
  display: block;
  font-size: 0.7em;
  opacity: 0.8;
  margin-top: 4px;
  letter-spacing: 2px;
  text-transform: uppercase;
`;

const ChargeBar = styled.div`
  display: block;
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  margin-top: 6px;
  position: relative;
  overflow: hidden;
`;

const ChargeFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${props => Math.min(props.$progress * 100, 100)}%;
  background: linear-gradient(90deg, #ffd700, #ff8c00);
  border-radius: 3px;
  transition: width 0.5s ease;
`;

const ChargeText = styled.span`
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55em;
  color: #ddd;
  text-shadow: 0 0 3px rgba(0,0,0,0.8);
`;

interface OptionButtonProps {
  selected: boolean;
}

const OptionButton = styled.button<OptionButtonProps>`
  background: ${(props) => (props.selected
    ? 'linear-gradient(135deg, rgba(139, 0, 0, 0.8), rgba(180, 30, 30, 0.7))'
    : 'linear-gradient(135deg, rgba(40, 25, 15, 0.8), rgba(60, 35, 20, 0.7))')};
  color: ${(props) => (props.selected ? '#ffd700' : '#e8d5b5')};
  border: 2px solid ${(props) => (props.selected ? '#ffd700' : 'rgba(255, 215, 0, 0.2)')};
  border-radius: 10px;
  padding: 12px 20px;
  font-family: 'Verdana', sans-serif;
  font-size: 1.15em;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
  &:hover:not(:disabled) {
    background: ${(props) => (props.selected
      ? 'linear-gradient(135deg, rgba(160, 10, 10, 0.9), rgba(200, 40, 40, 0.8))'
      : 'linear-gradient(135deg, rgba(60, 35, 20, 0.9), rgba(80, 45, 25, 0.8))')};
    border-color: rgba(255, 215, 0, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4), 0 0 8px rgba(255, 215, 0, 0.2);
  }
  &:disabled { cursor: not-allowed; opacity: 0.6; }
`;

const SubmitButton = styled.button`
  background: linear-gradient(135deg, #8b4513, #c0701f, #8b4513);
  background-size: 200% 100%;
  color: #f5f5dc;
  border: 2px solid #ffd700;
  border-radius: 12px;
  padding: 16px 45px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.3em;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6);
  animation: ${pulseGlow} 3s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.15), transparent);
    animation: ${shimmer} 4s ease-in-out infinite;
  }

  &:hover:not(:disabled) {
    background-position: 100% center;
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 6px 25px rgba(255, 215, 0, 0.5), 0 0 15px rgba(139, 69, 19, 0.3);
    border-color: #fff;
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 2px 8px rgba(139, 69, 19, 0.4);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    filter: grayscale(0.4);
    animation: none;
    box-shadow: none;
  }
`;

const FeedbackText = styled.p`
  margin-top: 20px;
  font-family: 'Georgia', serif;
  font-size: 1.3em;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4), 1px 1px 2px rgba(0, 0, 0, 0.7);
`;

const ImagePane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 15px;
  gap: 10px;
`;

const ImageToggle = styled.button`
  background: linear-gradient(135deg, rgba(40, 25, 15, 0.8), rgba(60, 35, 20, 0.7));
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  padding: 8px 20px;
  font-family: 'Verdana', sans-serif;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, rgba(60, 35, 20, 0.9), rgba(80, 45, 25, 0.8));
    border-color: rgba(255, 215, 0, 0.5);
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
  }
`;

const QuestionImage = styled.img`
  max-width: 80%;
  max-height: 200px;
  object-fit: contain;
  margin-top: 15px;
  border-radius: 8px;
  border: 2px solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
`;

export default CombatScreen;
