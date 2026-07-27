import ModalShell from './ui/ModalShell.jsx';

export default function RematchModal({ onAccept, onDecline }) {
  return (
    <ModalShell
      title="Accept rematch?"
      onClose={onDecline}
      dismissOnBackdrop={false}
      maxWidth={380}
      zIndex={72}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button type="button" className="flex-1 min-h-11 px-4 py-2 rounded-lg btn-ghost text-sm font-semibold"
            onClick={onDecline}>Decline</button>
          <button type="button" className="flex-1 min-h-11 px-4 py-2 rounded-lg btn-primary text-sm font-semibold"
            onClick={onAccept}>Accept</button>
        </div>
      }>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
        Your opponent wants to play again.
      </p>
    </ModalShell>
  );
}
