import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WordTiles from '../WordTiles.jsx';

const TURNS = [
  { word: 'apple', tier: null, caption: 'Anchor word' },
  { word: 'galaxy', tier: 'good', caption: 'Safe jump +0.88' },
  { word: 'orange', tier: 'bad', caption: 'Too close — strike' },
];

const STEP_MS = 2200;

// Auto-playing loop: anchor -> safe jump -> strike -> repeat.
// No video file needed — reuses WordTiles reveal animation. Respects prefers-reduced-motion.
export default function GameplayDemo() {
  const [step, setStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setStep(s => (s + 1) % TURNS.length), STEP_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const activeIndex = reducedMotion ? 1 : step;
  const turn = TURNS[activeIndex];
  const captionColor = turn.tier === 'good' ? 'var(--good)' : turn.tier === 'bad' ? 'var(--bad)' : 'var(--text-muted)';

  return (
    <div className="demo-frame">
      <div className="demo-frame-header">
        <span className="game-subtitle">Live demo</span>
        <span className="demo-frame-dots" aria-hidden>
          {TURNS.map((_, i) => (
            <span key={i} className={`demo-dot${i === activeIndex ? ' active' : ''}`} />
          ))}
        </span>
      </div>
      <div className="demo-frame-body">
        <AnimatePresence mode="wait">
          <motion.div key={turn.word}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}>
            <WordTiles word={turn.word} tier={turn.tier} size="sm" animateReveal={!reducedMotion} minSlots={turn.word.length} />
            <p className="demo-caption" style={{ color: captionColor }}>{turn.caption}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
