import { useState } from 'react';

const STEPS = [
  {
    title: 'Stay Elsewhere',
    content: (
      <div>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--lux-text-body)' }}>
          Each turn, pick a word that means something <strong>different</strong> from the last one.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--lux-border)', background: 'var(--lux-surface-soft)' }}>
            <p className="font-serif text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--lux-text-strong)' }}>
              apple <span style={{ color: 'var(--lux-text-muted)' }}>→</span> galaxy
            </p>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: '#e2e2e3' }}>
              <div className="h-full rounded-full" style={{ width: '88%', background: '#6aaa64' }} />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6aaa64' }}>Safe jump</p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--lux-border)', background: 'var(--lux-surface-soft)' }}>
            <p className="font-serif text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--lux-text-strong)' }}>
              apple <span style={{ color: 'var(--lux-text-muted)' }}>→</span> orange
            </p>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: '#e2e2e3' }}>
              <div className="h-full rounded-full" style={{ width: '22%', background: '#787c7e' }} />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#787c7e' }}>Too close: strike toward loss</p>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Rules',
    content: (
      <div>
        <ul className="mt-4 space-y-2 text-sm" style={{ color: 'var(--lux-text-body)' }}>
          <li>Land too close in meaning and you take a strike. Three strikes and you lose.</li>
          <li>You have a timer each turn. Think fast.</li>
        </ul>
        <p className="mt-4 text-[11px] tracking-[0.14em] uppercase font-semibold" style={{ color: 'var(--lux-text-muted)' }}>Move quality</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--lux-border)', background: 'rgba(106,170,100,0.12)' }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#6aaa64' }} /> Safe
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--lux-border)', background: 'rgba(201,180,88,0.14)' }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#c9b458' }} /> Risky
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium" style={{ borderColor: 'var(--lux-border)', background: 'rgba(120,124,126,0.12)' }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#787c7e' }} /> Lose zone
          </span>
        </div>
      </div>
    )
  },
  {
    title: 'Choose a mode',
    content: (
      <div className="mt-4 space-y-2">
        {[
          { label: 'VS Computer', desc: 'Alternate with the AI. Same rules.' },
          { label: 'Pass & Play', desc: 'Two players, one device. Pass after each word.' },
          { label: 'Online room', desc: 'Share a link or code and play a friend remotely.' },
        ].map(m => (
          <div key={m.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--lux-border)', background: 'var(--lux-surface-soft)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--lux-text-muted)' }}>{m.label}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--lux-text-body)' }}>{m.desc}</p>
          </div>
        ))}
      </div>
    )
  }
];

export default function IntroOverlay({ onClose }) {
  const [step, setStep] = useState(1);
  const isLast = step >= 3;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-3 py-6"
      style={{ zIndex: 70, background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-xl border bg-white shadow-xl p-5 sm:p-6 text-left overflow-y-auto"
        style={{ maxHeight: 'min(92vh,640px)', borderColor: 'var(--lux-border)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-3xl sm:text-4xl tracking-[0.06em]" style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--lux-text-strong)' }}>
          {STEPS[step - 1].title}
        </h2>
        {STEPS[step - 1].content}

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center">
          <button
            type="button"
            className="text-sm underline underline-offset-4"
            style={{ color: 'var(--lux-text-muted)' }}
            onClick={() => { setStep(3); }}
          >Skip</button>
          <div className="flex gap-2">
            {!isLast && (
              <button
                type="button"
                className="flex-1 sm:flex-none min-h-11 px-5 rounded-md text-white font-semibold"
                style={{ background: '#121213' }}
                onClick={() => setStep(s => Math.min(3, s + 1))}
              >Next</button>
            )}
            {isLast && (
              <button
                type="button"
                className="flex-1 sm:flex-none min-h-11 px-5 rounded-md text-white font-semibold"
                style={{ background: '#121213' }}
                onClick={onClose}
              >Got it, let&apos;s play</button>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--lux-text-muted)' }}>{step} / 3</p>
      </div>
    </div>
  );
}
