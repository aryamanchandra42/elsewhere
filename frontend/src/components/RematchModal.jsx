export default function RematchModal({ onAccept, onDecline }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-3 py-6"
      style={{ zIndex: 72, background: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[380px] rounded-xl border bg-white shadow-xl p-5 sm:p-6 text-center" style={{ borderColor: 'var(--lux-border)' }}>
        <h3 className="text-xl sm:text-2xl tracking-[0.04em]" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--lux-text-strong)' }}>
          Accept rematch?
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lux-text-body)' }}>
          Your opponent wants to play again.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            type="button"
            className="flex-1 min-h-11 px-4 py-2 rounded-md border font-semibold"
            style={{ borderColor: 'var(--lux-border)', color: 'var(--lux-text-body)', background: 'white' }}
            onClick={onDecline}
          >Decline</button>
          <button
            type="button"
            className="flex-1 min-h-11 px-4 py-2 rounded-md text-white font-semibold"
            style={{ background: '#121213' }}
            onClick={onAccept}
          >Accept</button>
        </div>
      </div>
    </div>
  );
}
