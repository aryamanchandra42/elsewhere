import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { WordPairDemo } from './WordTiles.jsx';
import { MODES } from '../constants/modes.js';
import { HOW_TO_PLAY_INTRO } from '../constants/copy.js';

const EXAMPLES = [
  { from: 'apple', to: 'galaxy', tier: 'good', pct: '88%', label: 'Safe — huge semantic jump' },
  { from: 'apple', to: 'orange', tier: 'bad', pct: '18%', label: 'Strike — same fruit category' },
];

const SECTIONS = [
  {
    title: 'Concept',
    ordered: false,
    items: [
      'Say a valid English word each turn.',
      'Stay semantically far from the previous word.',
      'Too close = a strike. Three strikes = elimination.',
      'Survive all rounds without losing = tie.',
    ],
  },
  {
    title: 'Turn flow',
    ordered: true,
    items: [
      'Read the current anchor word.',
      'Type a word and press Enter or Submit.',
      'The AI checks semantic distance instantly.',
      'Your word becomes the next anchor.',
    ],
  },
  {
    title: 'Strategy',
    ordered: false,
    items: [
      'Avoid small category hops (fruit → fruit).',
      'Cross domains: object → emotion → place.',
      'Watch the timer — running out loses the round.',
      'Study the history panel for weak patterns.',
    ],
  },
];

export default function HowToPlayModal({ onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.div
      key="htp-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-start justify-center"
      style={{ zIndex: 80, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-[calc(100%-1.5rem)] max-w-[780px] mx-auto mt-4 sm:mt-8 rounded-2xl overflow-hidden"
        style={{
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px var(--border-soft)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Guide</p>
            <h3 className="text-2xl sm:text-3xl game-title" style={{ color: 'var(--text-strong)' }}>
              How to play
            </h3>
          </div>
          <button type="button"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl leading-none transition"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }}
            onClick={onClose}>×</button>
        </div>

        <div className="px-6 pb-8 pt-5 space-y-6">

          {/* Tagline */}
          <p style={{ color: 'var(--text-body)', lineHeight: 1.7, fontSize: '0.9rem' }}>
            {HOW_TO_PLAY_INTRO}
          </p>

          {/* Examples */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
            <p className="text-[10px] tracking-[0.18em] uppercase font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Examples</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXAMPLES.map(ex => (
                <div key={ex.from + ex.to} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <WordPairDemo from={ex.from} to={ex.to} tier={ex.tier} size="xs" />
                    <span className="shrink-0 ml-2" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ex.tier === 'good' ? 'var(--good)' : 'var(--bad)' }}>{ex.pct}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--progress-track)' }}>
                    <div style={{ width: ex.pct, height: '100%', borderRadius: 999, background: ex.tier === 'good' ? 'var(--good)' : 'var(--bad)' }} />
                  </div>
                  <p className="mt-2" style={{ fontSize: '11px', color: ex.tier === 'good' ? 'var(--good)' : 'var(--bad)' }}>{ex.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Color legend */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] uppercase tracking-[0.14em] font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>Jump quality:</span>
            {[
              { color: 'var(--good)', label: 'Safe' },
              { color: 'var(--mid)', label: 'Risky' },
              { color: 'var(--bad)', label: 'Strike zone' },
            ].map(c => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', color: c.color }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                {c.label}
              </span>
            ))}
          </div>

          {/* Concept / Flow / Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SECTIONS.map(s => (
              <div key={s.title} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                <p className="text-[10px] tracking-[0.18em] uppercase font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{s.title}</p>
                {s.ordered
                  ? <ol className="space-y-2 text-sm leading-relaxed list-decimal pl-4" style={{ color: 'var(--text-body)' }}>
                      {s.items.map(i => <li key={i}>{i}</li>)}
                    </ol>
                  : <ul className="space-y-2 text-sm leading-relaxed list-disc pl-4" style={{ color: 'var(--text-body)' }}>
                      {s.items.map(i => <li key={i}>{i}</li>)}
                    </ul>
                }
              </div>
            ))}
          </div>

          {/* Game modes */}
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Game modes</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map(m => (
                <div key={m.id} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                  <span className={`word-tile tile-${m.tone}`} style={{ width: 30, height: 30, fontSize: '0.85rem', borderRadius: 4, marginBottom: '0.6rem' }}>{m.tileLetter}</span>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-strong)' }}>{m.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-body)' }}>{m.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring note */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'var(--good-bg)', border: '1px solid rgba(106,170,100,0.2)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-body)' }}>
              <strong style={{ color: 'var(--good)' }}>Scoring:</strong> Each valid move adds its cosine distance to your score. The further the jump, the more you earn. Win by outlasting your opponent — or survive all rounds for a tie.
            </p>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
