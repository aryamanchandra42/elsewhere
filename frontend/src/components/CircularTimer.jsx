import { motion } from 'framer-motion';

const R = 28;
const CIRC = 2 * Math.PI * R;

export default function CircularTimer({ timeRemaining, maxTime, urgent, waiting }) {
  const pct = maxTime > 0 ? Math.max(0, Math.min(1, timeRemaining / maxTime)) : 0;
  const offset = CIRC * (1 - pct);

  const ringColor = urgent
    ? 'var(--bad)'
    : pct > 0.5
      ? 'var(--good)'
      : 'var(--mid)';

  const textColor = urgent ? 'var(--bad)' : 'var(--text-strong)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Track */}
        <circle
          cx="36" cy="36" r={R}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="4"
        />
        {/* Progress */}
        <motion.circle
          cx="36" cy="36" r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transformOrigin: '36px 36px', rotate: '-90deg' }}
          animate={{ strokeDashoffset: offset, stroke: ringColor }}
          transition={{ strokeDashoffset: { duration: 0.9, ease: 'linear' }, stroke: { duration: 0.4 } }}
        />
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center leading-none">
        {waiting ? (
          <span className="timer-wait-dots visible">
            <span className="timer-wait-dot" />
            <span className="timer-wait-dot" />
            <span className="timer-wait-dot" />
          </span>
        ) : (
          <motion.span
            key={timeRemaining}
            initial={{ scale: urgent ? 1.2 : 1, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className={`tabular-nums font-bold ${urgent ? 'timer-pulse' : ''}`}
            style={{ fontSize: '1.1rem', color: textColor, lineHeight: 1 }}
          >
            {timeRemaining}
          </motion.span>
        )}
        {!waiting && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
            sec
          </span>
        )}
      </div>
    </div>
  );
}
