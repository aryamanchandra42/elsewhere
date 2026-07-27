import { motion } from 'framer-motion';

// Centered glass card shell used by lobby/settings screens: consistent padding, shadow, max-width.
export default function ScreenCard({ children, className = '', maxWidth = 480 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`screen-card glass rounded-2xl p-5 sm:p-6 text-left ${className}`}
      style={{ maxWidth, boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px var(--border-soft)' }}>
      {children}
    </motion.div>
  );
}
