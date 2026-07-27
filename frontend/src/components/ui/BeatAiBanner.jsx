import { motion } from 'framer-motion';
import { BEAT_AI_CTA } from '../../constants/contact.js';

// Lightweight social CTA: "Think you can beat the AI? Text us with proof."
// `variant="muted"` is used after a loss ("Think you can do better?").
export default function BeatAiBanner({ variant = 'primary', className = '' }) {
  const isPrimary = variant === 'primary';
  const headline = isPrimary ? BEAT_AI_CTA.headline : 'Think you can do better?';

  return (
    <motion.a
      href={BEAT_AI_CTA.href}
      target={BEAT_AI_CTA.href === '#' ? undefined : '_blank'}
      rel="noopener noreferrer"
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      className={`beat-ai-banner${isPrimary ? '' : ' beat-ai-banner-muted'} ${className}`}>
      <span className="word-tile tile-good beat-ai-tile" style={{ width: 34, height: 34, fontSize: '0.62rem', borderRadius: 4 }}>AI</span>
      <span className="beat-ai-text">
        <strong>{headline}</strong> {BEAT_AI_CTA.action}.
      </span>
      <span className="beat-ai-arrow" aria-hidden>→</span>
    </motion.a>
  );
}
