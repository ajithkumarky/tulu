import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';

const ASCENSION_STAGES = [
  {
    title: 'The Trials Are Complete',
    subtitle: 'You have proven your worth through wisdom and courage...',
    duration: 3000,
  },
  {
    title: 'The Gods Take Notice',
    subtitle: 'Lightning splits the sky as Olympus opens its gates...',
    duration: 3500,
  },
  {
    title: 'Ascension Begins',
    subtitle: 'Golden light engulfs you as you rise above the mortal realm...',
    duration: 3500,
  },
  {
    title: 'You Have Become a God',
    subtitle: 'A new deity joins the Pantheon of Olympus. Your knowledge of Tulu is now divine.',
    duration: 0,
  },
];

const AscensionScreen = () => {
  const [stage, setStage] = useState(0);
  const [showFinal, setShowFinal] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; size: number }>>([]);
  const [bolts, setBolts] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const navigate = useNavigate();

  // Generate particles and lightning bolts
  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      size: Math.random() * 6 + 2,
    }));
    setParticles(newParticles);

    const newBolts = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 6,
    }));
    setBolts(newBolts);
  }, []);

  // Progress through stages
  useEffect(() => {
    if (stage < ASCENSION_STAGES.length - 1) {
      const timer = setTimeout(() => {
        setStage(prev => prev + 1);
      }, ASCENSION_STAGES[stage].duration);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShowFinal(true), 500);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const currentStage = ASCENSION_STAGES[stage];
  const isFinal = stage === ASCENSION_STAGES.length - 1;

  return (
    <AscensionContainer $stage={stage}>
      {/* Floating golden particles */}
      {particles.map(p => (
        <GoldenParticle
          key={p.id}
          $left={p.left}
          $delay={p.delay}
          $size={p.size}
        />
      ))}

      {/* Lightning bolts (stage 1+) */}
      {stage >= 1 && bolts.map(b => (
        <LightningBolt key={b.id} $left={b.left} $delay={b.delay} />
      ))}

      {/* Central radiance (stage 2+) */}
      {stage >= 2 && <Radiance />}

      {/* Laurel wreath (final stage) */}
      {isFinal && <LaurelWreath $visible={showFinal}>&#127811;</LaurelWreath>}

      <StageContent key={stage}>
        <StageTitle $isFinal={isFinal}>{currentStage.title}</StageTitle>
        <StageSubtitle>{currentStage.subtitle}</StageSubtitle>
      </StageContent>

      {/* Final stats and navigation */}
      {isFinal && showFinal && (
        <FinalContent>
          <DivineTitleText>God of Tulu Wisdom</DivineTitleText>
          <StatsRow>
            <FinalStat>Mastered 5 Levels</FinalStat>
            <FinalStat>Conquered All Trials</FinalStat>
            <FinalStat>Achieved Divinity</FinalStat>
          </StatsRow>
          <ReturnButton onClick={() => navigate('/')}>
            Return to Olympus
          </ReturnButton>
          <ContinueText>
            Your legend is written in the stars. You may continue to quest and grow even stronger.
          </ContinueText>
        </FinalContent>
      )}

      {/* Stage indicator dots */}
      <StageIndicator>
        {ASCENSION_STAGES.map((_, i) => (
          <StageDot key={i} $active={i <= stage} />
        ))}
      </StageIndicator>
    </AscensionContainer>
  );
};

// --- Animations ---

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const floatUp = keyframes`
  0% {
    transform: translateY(100vh) scale(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
    transform: translateY(90vh) scale(1);
  }
  90% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-10vh) scale(0.5);
    opacity: 0;
  }
`;

const lightningFlash = keyframes`
  0%, 100% { opacity: 0; }
  5% { opacity: 1; }
  10% { opacity: 0; }
  12% { opacity: 0.8; }
  15% { opacity: 0; }
`;

const pulse = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.3;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 0.6;
  }
`;

const crownDrop = keyframes`
  0% {
    transform: translateY(-100px) scale(0.3);
    opacity: 0;
  }
  60% {
    transform: translateY(10px) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const growFromCenter = keyframes`
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

// --- Styled Components ---

const AscensionContainer = styled.div<{ $stage: number }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 1000;
  transition: background 2s ease;
  background: ${({ $stage }) => {
    switch ($stage) {
      case 0: return 'linear-gradient(180deg, #0a0a2e 0%, #1a1a4e 50%, #2d1b69 100%)';
      case 1: return 'linear-gradient(180deg, #1a0a3e 0%, #2d1b69 40%, #4a2080 100%)';
      case 2: return 'linear-gradient(180deg, #2d1b69 0%, #6b3fa0 30%, #ffd700 100%)';
      case 3: return 'linear-gradient(180deg, #1a0535 0%, #2d0b5a 20%, #ffd700 60%, #fff8dc 100%)';
      default: return '#0a0a2e';
    }
  }};
`;

const GoldenParticle = styled.div<{ $left: number; $delay: number; $size: number }>`
  position: absolute;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  background: radial-gradient(circle, #ffd700, #ffed4e);
  border-radius: 50%;
  left: ${({ $left }) => $left}%;
  bottom: -10px;
  animation: ${floatUp} ${() => 5 + Math.random() * 4}s linear infinite;
  animation-delay: ${({ $delay }) => $delay}s;
  box-shadow: 0 0 6px 2px rgba(255, 215, 0, 0.6);
`;

const LightningBolt = styled.div<{ $left: number; $delay: number }>`
  position: absolute;
  top: 0;
  left: ${({ $left }) => $left}%;
  width: 3px;
  height: 40%;
  background: linear-gradient(180deg, #fff, #87ceeb, transparent);
  animation: ${lightningFlash} 3s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}s;
  filter: blur(1px);
  box-shadow: 0 0 15px 5px rgba(135, 206, 235, 0.4);

  &::after {
    content: '';
    position: absolute;
    top: 30%;
    left: -8px;
    width: 20px;
    height: 60%;
    background: linear-gradient(180deg, rgba(255,255,255,0.3), transparent);
    transform: skewX(-15deg);
    filter: blur(3px);
  }
`;

const Radiance = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.1) 40%, transparent 70%);
  animation: ${pulse} 3s ease-in-out infinite, ${growFromCenter} 2s ease-out;
  pointer-events: none;
`;

const LaurelWreath = styled.div<{ $visible: boolean }>`
  font-size: 5em;
  animation: ${crownDrop} 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  margin-bottom: 10px;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8));
`;

const StageContent = styled.div`
  text-align: center;
  z-index: 10;
  animation: ${fadeInUp} 1.2s ease-out;
  max-width: 700px;
  padding: 0 20px;
`;

const StageTitle = styled.h1<{ $isFinal: boolean }>`
  font-family: 'Cinzel Decorative', 'Georgia', serif;
  font-size: ${({ $isFinal }) => ($isFinal ? '3.5em' : '2.8em')};
  color: #ffd700;
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.8);
  margin-bottom: 15px;
  letter-spacing: 3px;
  text-transform: uppercase;

  ${({ $isFinal }) => $isFinal && css`
    background: linear-gradient(90deg, #ffd700, #fff, #ffd700);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ${shimmer} 3s linear infinite;
  `}
`;

const StageSubtitle = styled.p`
  font-family: 'Georgia', serif;
  font-size: 1.4em;
  color: #e0d0ff;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  font-style: italic;
`;

const FinalContent = styled.div`
  animation: ${fadeIn} 1.5s ease-out;
  text-align: center;
  z-index: 10;
  margin-top: 30px;
`;

const DivineTitleText = styled.h2`
  font-family: 'Cinzel Decorative', 'Georgia', serif;
  font-size: 1.8em;
  color: #fff8dc;
  text-shadow: 0 0 20px rgba(255, 248, 220, 0.5);
  margin-bottom: 25px;
  letter-spacing: 5px;
  text-transform: uppercase;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 30px;
  justify-content: center;
  margin-bottom: 35px;
  flex-wrap: wrap;
`;

const FinalStat = styled.div`
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 10px;
  padding: 12px 24px;
  color: #ffd700;
  font-family: 'Verdana', sans-serif;
  font-size: 1em;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
`;

const ReturnButton = styled.button`
  background: linear-gradient(135deg, #ffd700, #daa520);
  color: #1a0535;
  border: none;
  border-radius: 12px;
  padding: 18px 50px;
  font-family: 'Cinzel Decorative', 'Georgia', serif;
  font-size: 1.4em;
  font-weight: bold;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
  text-transform: uppercase;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(255, 215, 0, 0.6);
    background: linear-gradient(135deg, #ffed4e, #ffd700);
  }
`;

const ContinueText = styled.p`
  color: #b8a0d0;
  font-family: 'Georgia', serif;
  font-size: 0.95em;
  margin-top: 20px;
  font-style: italic;
  max-width: 500px;
`;

const StageIndicator = styled.div`
  position: absolute;
  bottom: 30px;
  display: flex;
  gap: 12px;
  z-index: 10;
`;

const StageDot = styled.div<{ $active: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $active }) => ($active ? '#ffd700' : 'rgba(255, 255, 255, 0.3)')};
  transition: all 0.5s ease;
  box-shadow: ${({ $active }) => ($active ? '0 0 8px rgba(255, 215, 0, 0.6)' : 'none')};
`;

export default AscensionScreen;
