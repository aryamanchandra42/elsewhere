import { motion } from 'framer-motion';

// Shared modal chrome: backdrop + rounded card + title using the game-title font,
// with a slot for footer actions (green primary / ghost secondary buttons).
export default function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  maxWidth = 420,
  zIndex = 70,
  dismissOnBackdrop = true,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-center justify-center px-3 py-6"
      style={{ zIndex, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-2xl overflow-hidden text-left"
        style={{
          maxWidth,
          maxHeight: 'min(92vh, 640px)',
          overflowY: 'auto',
          background: 'var(--modal-bg)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px var(--border-soft)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 sm:p-6">
          {eyebrow && (
            <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{eyebrow}</p>
          )}
          {title && (
            <h2 className="text-2xl sm:text-3xl game-title" style={{ color: 'var(--text-strong)' }}>{title}</h2>
          )}
          <div className={title ? 'mt-4' : ''}>{children}</div>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
