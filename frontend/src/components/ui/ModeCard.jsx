import { motion } from 'framer-motion';

// Title, tag, one-line description, letter-tile icon (not emoji).
// `layout="row"` is used by the compact menu list; `layout="grid"` matches the landing page's mode grid.
export default function ModeCard({ mode, onClick, layout = 'row', selected = false }) {
  const { tileLetter, title, tag, body, cta, tone = 'good' } = mode;

  if (layout === 'grid') {
    return (
      <motion.div whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }}
        transition={{ duration: 0.25 }}
        className="mode-card mode-card-grid">
        <span className={`word-tile mode-card-tile tile-${tone}`}>{tileLetter}</span>
        <div className="mode-card-title-row">
          <h3 className="mode-card-title">{title}</h3>
          <span className="mode-card-tag">{tag}</span>
        </div>
        <p className="mode-card-desc">{body}</p>
        {cta && (
          <button type="button" onClick={onClick} className="btn-ghost rounded-lg mode-card-cta-btn">
            {cta} →
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.button type="button"
      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`mode-card mode-card-row${selected ? ' mode-card-selected' : ''}`}>
      <span className={`word-tile mode-card-tile tile-${tone}`}>{tileLetter}</span>
      <span className="mode-card-body">
        <span className="mode-card-title-row">
          <span className="mode-card-title">{title}</span>
          <span className="mode-card-tag">{tag}</span>
        </span>
        {body && <span className="mode-card-desc">{body}</span>}
      </span>
      <span className="mode-card-arrow" aria-hidden>→</span>
    </motion.button>
  );
}
