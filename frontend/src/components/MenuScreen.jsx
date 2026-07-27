import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModeCard from './ui/ModeCard.jsx';
import BeatAiBanner from './ui/BeatAiBanner.jsx';
import { WordPairDemo } from './WordTiles.jsx';
import { MODES } from '../constants/modes.js';
import { MENU_TAGLINE } from '../constants/copy.js';

export default function MenuScreen({ onBack, onHowToPlay, onStartPvc, onStartPvp, onStartOnline }) {
  const [showPvpSetup, setShowPvpSetup] = useState(false);
  const [pvpName1, setPvpName1] = useState('');
  const [pvpName2, setPvpName2] = useState('');

  const handleModeClick = (id) => {
    if (id === 'pvp') { setShowPvpSetup(s => !s); return; }
    setShowPvpSetup(false);
    if (id === 'pvc') onStartPvc();
    else if (id === 'online') onStartOnline();
  };

  return (
    <div className="h-full flex items-center justify-center px-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] text-center glass rounded-2xl p-6 sm:p-8"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px var(--border-soft)' }}>

        {/* Top bar: back + balancing logo mark */}
        <div className="flex items-center justify-between mb-5">
          <button type="button" onClick={onBack}
            className="text-xs btn-ghost rounded-lg px-3 h-8"
            style={{ letterSpacing: '0.04em' }}>← Back</button>
          <span className="game-title" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ELSEWHERE</span>
        </div>

        {/* Logo / hero */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}>
          <div className="inline-flex items-center justify-center w-10 h-10 rounded mb-4 word-tile tile-good"
            style={{ fontSize: '1.1rem', width: 40, height: 40 }}>
            E
          </div>
          <h1 className="leading-none tracking-[0.1em] game-title"
            style={{
              color: 'var(--text-strong)',
              fontSize: 'clamp(2rem, 11vw, 3rem)',
            }}>
            ELSEWHERE
          </h1>
          <p className="game-subtitle mt-3">{MENU_TAGLINE.line1}</p>
          <p className="game-subtitle mt-1">{MENU_TAGLINE.line2}</p>
        </motion.div>

        {/* Mini demo strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45 }}
          className="mt-5 rounded-lg px-4 py-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
          <WordPairDemo from="apple" to="galaxy" tier="good" size="xs" />
        </motion.div>

        {/* Mode cards */}
        <motion.div className="mt-6 space-y-2.5 text-left"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.45 }}>
          {MODES.map(m => (
            <ModeCard key={m.id} mode={m} layout="row"
              selected={m.id === 'pvp' && showPvpSetup}
              onClick={() => handleModeClick(m.id)} />
          ))}
        </motion.div>

        {/* PvP setup panel */}
        <AnimatePresence>
        {showPvpSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            <div className="mt-3 glass-raised rounded-xl p-4 text-left">
              <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Pass &amp; Play setup</p>
              {['Player 1', 'Player 2'].map((label, i) => (
                <div key={label} className={i === 0 ? 'mb-3' : ''}>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-body)' }}>{label} name</label>
                  <input type="text" maxLength={12} placeholder={label}
                    value={i === 0 ? pvpName1 : pvpName2}
                    onChange={e => i === 0 ? setPvpName1(e.target.value) : setPvpName2(e.target.value)}
                    className="form-input" />
                </div>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="h-10 rounded-lg btn-ghost text-sm"
                  onClick={() => setShowPvpSetup(false)}>Cancel</button>
                <motion.button type="button" whileTap={{ scale: 0.97 }}
                  className="h-10 rounded-lg btn-primary text-sm"
                  onClick={() => {
                    const n1 = pvpName1.trim() || 'Player 1';
                    const n2 = pvpName2.trim() || 'Player 2';
                    setShowPvpSetup(false);
                    onStartPvp(n1, n2);
                  }}>Start</motion.button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="mt-5">
          <BeatAiBanner variant="primary" />
        </div>

        <button type="button" className="mt-4 text-xs tracking-[0.1em] underline underline-offset-4 transition"
          style={{ color: 'var(--text-muted)' }}
          onClick={onHowToPlay}>How to play</button>
      </motion.div>
    </div>
  );
}
