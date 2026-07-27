import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import GameplayDemo from './landing/GameplayDemo.jsx';
import BeatAiBanner from './ui/BeatAiBanner.jsx';
import { MODES } from '../constants/modes.js';
import { HERO_TAGLINE } from '../constants/copy.js';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} variants={fadeUp} initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      transition={{ delay }}
      className={className}>
      {children}
    </motion.div>
  );
}

const STEPS = [
  { n: '01', title: 'Set the anchor', body: 'The first player types any valid English word. This becomes the semantic anchor for the round.' },
  { n: '02', title: 'Jump far', body: 'The next player must say a word semantically distant from the anchor. Tiny hops cost strikes.' },
  { n: '03', title: 'AI judges instantly', body: 'GloVe embeddings measure the distance. Too close triggers a strike. Three strikes = eliminated.' },
];

const FACTS = [
  { value: '3', label: 'strikes to lose' },
  { value: '15', label: 'rounds online' },
  { value: '10s', label: 'per turn' },
  { value: '∞', label: 'word pairs' },
];

export default function LandingScreen({ onPlay, onHowToPlay }) {
  return (
    <div className="fixed inset-0 overflow-y-auto"
      style={{ fontFamily: 'Inter, sans-serif', color: 'var(--text-strong)' }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 sm:px-8 h-14"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <span className="game-title" style={{ fontSize: '1rem', color: 'var(--text-strong)' }}>
          ELSEWHERE
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onHowToPlay}
            className="btn-ghost rounded-lg text-xs px-4 h-9">How to play</button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={onPlay}
            className="btn-primary rounded-lg text-xs px-4 h-9">Play now →</motion.button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-16 pb-20"
        style={{ minHeight: 'calc(100vh - 3.5rem)' }}>

        {/* Decorative background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '0', right: '-5%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)' }} />
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-6 word-tile tile-good"
          style={{ fontSize: '1.4rem', width: 56, height: 56 }}>
          W
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="game-title"
          style={{
            fontSize: 'clamp(2.4rem, 12vw, 5.5rem)',
            lineHeight: 0.95,
            color: 'var(--text-strong)',
          }}>
          ELSEWHERE
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
          style={{ marginTop: '1.5rem', maxWidth: 460 }}>
          <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-strong)', fontWeight: 600 }}>
            {HERO_TAGLINE.primary}
          </p>
          <p style={{ marginTop: '0.4rem', fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-muted)' }}>
            {HERO_TAGLINE.secondary}
          </p>
        </motion.div>

        {/* Animated gameplay demo */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.6 }}
          style={{ marginTop: '2.25rem' }}>
          <GameplayDemo />
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.55 }}
          style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={onPlay} className="btn-primary rounded-xl"
            style={{ height: 50, padding: '0 2rem', fontSize: '0.95rem', letterSpacing: '0.05em' }}>
            Start Playing →
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onHowToPlay} className="btn-ghost rounded-xl"
            style={{ height: 50, padding: '0 1.5rem', fontSize: '0.9rem' }}>
            How to play
          </motion.button>
        </motion.div>

        {/* Beat the AI CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46, duration: 0.5 }}
          style={{ marginTop: '1.75rem', width: '100%', maxWidth: 420 }}>
          <BeatAiBanner variant="primary" />
        </motion.div>

        {/* Scroll nudge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ delay: 1.5, duration: 0.6 }}
          style={{ marginTop: '2.5rem', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          scroll to explore ↓
        </motion.div>
      </section>

      {/* ── FACT STRIP ── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <Reveal className="max-w-3xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {FACTS.map(f => (
            <div key={f.label}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-strong)', letterSpacing: '0.02em' }}>{f.value}</div>
              <div style={{ marginTop: '0.35rem', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{f.label}</div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-20">
        <Reveal>
          <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>The rules</p>
          <h2 className="game-title" style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: 'var(--text-strong)', lineHeight: 1.1, marginBottom: '3rem' }}>
            One rule. Infinite combinations.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="rounded-2xl p-5 h-full"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="game-title" style={{ fontSize: '1.6rem', lineHeight: 1, color: 'var(--border-strong)', marginBottom: '1rem' }}>{s.n}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: '0.5rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--text-body)' }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── GAME MODES ── */}
      <section style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20">
          <Reveal>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>How you play</p>
            <h2 className="game-title" style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: 'var(--text-strong)', lineHeight: 1.1, marginBottom: '3rem' }}>
              Three ways to play
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {MODES.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.1}>
                <motion.div whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}
                  transition={{ duration: 0.25 }}
                  className="rounded-2xl p-5 h-full flex flex-col"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <span className={`word-tile tile-${m.tone}`} style={{ width: 40, height: 40, fontSize: '1.1rem', borderRadius: 6, marginBottom: '0.85rem' }}>{m.tileLetter}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>{m.title}</h3>
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 99, background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{m.tag}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--text-body)', flex: 1 }}>{m.body}</p>
                  <button type="button" onClick={onPlay}
                    className="btn-ghost rounded-lg mt-4 text-xs"
                    style={{ height: 36, width: '100%' }}>{m.cta} →</button>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <Reveal>
          <div className="max-w-2xl mx-auto px-5 py-24 text-center">
            <div style={{ fontSize: 28, marginBottom: '1rem' }}>◈</div>
            <h2 className="game-title" style={{ fontSize: 'clamp(2.2rem, 7vw, 3.2rem)', color: 'var(--text-strong)', lineHeight: 1.1, marginBottom: '1rem' }}>
              Ready to jump?
            </h2>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-body)', marginBottom: '2rem', maxWidth: 360, margin: '0 auto 2rem' }}>
              Challenge a friend, test yourself against the AI, or find a match online. The distance between words is waiting.
            </p>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={onPlay} className="btn-primary rounded-xl"
              style={{ height: 52, padding: '0 2.5rem', fontSize: '1rem', letterSpacing: '0.05em' }}>
              Play Elsewhere →
            </motion.button>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span className="game-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ELSEWHERE</span>
        <span style={{ fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Powered by GloVe word embeddings</span>
      </footer>
    </div>
  );
}
