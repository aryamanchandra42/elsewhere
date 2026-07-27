import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ModalShell from './ui/ModalShell.jsx';
import { WordPairDemo } from './WordTiles.jsx';
import { MODES } from '../constants/modes.js';
import { HERO_TAGLINE } from '../constants/copy.js';

const TOTAL_STEPS = 3;
const TITLES = ['Stay Elsewhere', 'The rules', 'Choose a mode'];

export default function IntroOverlay({ onClose }) {
  const [step, setStep] = useState(1);
  const isLast = step >= TOTAL_STEPS;

  return (
    <ModalShell
      eyebrow="Welcome"
      title={TITLES[step - 1]}
      onClose={onClose}
      maxWidth={440}
      zIndex={70}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center">
          <button type="button" className="text-sm underline underline-offset-4"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setStep(TOTAL_STEPS)}>Skip</button>
          <div className="flex items-center gap-3 justify-between sm:justify-end">
            <div className="flex gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <span key={i} className={`round-dot${i < step ? ' done' : ''}${i === step - 1 ? ' current' : ''}`} />
              ))}
            </div>
            {!isLast ? (
              <button type="button" className="min-h-11 px-5 rounded-lg btn-primary text-sm font-semibold"
                onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}>Next</button>
            ) : (
              <button type="button" className="min-h-11 px-5 rounded-lg btn-primary text-sm font-semibold"
                onClick={onClose}>Got it, let&apos;s play</button>
            )}
          </div>
        </div>
      }>
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {HERO_TAGLINE.primary} {HERO_TAGLINE.secondary}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                <WordPairDemo from="apple" to="galaxy" tier="good" size="sm" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--good)' }}>Safe jump</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                <WordPairDemo from="apple" to="orange" tier="bad" size="sm" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--bad)' }}>Too close — strike</p>
              </div>
            </div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ul className="space-y-2 text-sm list-disc pl-4" style={{ color: 'var(--text-body)' }}>
              <li>Land too close in meaning and you take a strike. Three strikes and you lose.</li>
              <li>You have a timer each turn. Think fast.</li>
            </ul>
            <p className="mt-4 text-[11px] tracking-[0.14em] uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Move quality</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { color: 'var(--good)', label: 'Safe' },
                { color: 'var(--mid)', label: 'Risky' },
                { color: 'var(--bad)', label: 'Lose zone' },
              ].map(c => (
                <span key={c.label} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', color: c.color }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                  {c.label}
                </span>
              ))}
            </div>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-2">
            {MODES.map(m => (
              <div key={m.id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                <span className={`word-tile tile-${m.tone}`} style={{ width: 32, height: 32, fontSize: '0.9rem', borderRadius: 4, flexShrink: 0 }}>{m.tileLetter}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{m.title}</p>
                  <p className="mt-0.5 text-sm" style={{ color: 'var(--text-body)' }}>{m.body}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
}
