import { useEffect, useRef } from 'react';

function HistoryEntry({ item, p1Name, p2Name, gameMode }) {
  let playerDisplay = '';
  if (item.player === 'system') {
    playerDisplay = 'Origin';
  } else if (gameMode === 'pvp') {
    playerDisplay = item.player === 'user' ? p1Name : p2Name;
  } else {
    playerDisplay = item.player === 'user' ? p1Name : (gameMode === 'online' ? p2Name : 'Computer');
  }

  const playerTone = item.player === 'user'
    ? '#4d4036'
    : item.player === 'computer'
      ? '#6a5a4c'
      : '#8a7b6f';

  let distanceContent = null;
  if (item.moveResult === 'SEED') {
    distanceContent = (
      <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: '#7d6f62' }}>
        <span>Distance</span>
        <span className="font-medium" style={{ color: '#4d4036' }}>– (anchor)</span>
      </div>
    );
  } else if (item.moveResult === 'STRIKE') {
    distanceContent = (
      <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: '#9a6b5c' }}>
        <span>Too close</span>
        <span className="font-medium">{item.distance != null ? item.distance.toFixed(3) : '–'} (strike)</span>
      </div>
    );
  } else if (item.distance != null) {
    distanceContent = (
      <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: '#7d6f62' }}>
        <span>Distance</span>
        <span className="font-medium" style={{ color: '#4d4036' }}>{item.distance.toFixed(3)}</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-l-[3px] px-2 py-1.5 animate-in" style={{ borderColor: '#e7ddd4', background: 'rgba(250,247,244,0.9)', borderLeftColor: '#d3c9be' }}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em]" style={{ color: playerTone }}>
        <span>{playerDisplay}</span>
      </div>
      <div className="text-base leading-tight break-words" style={{ color: '#2f2b27' }}>{item.word}</div>
      {distanceContent}
    </div>
  );
}

export default function WordHistory({ history, p1Name, p2Name, gameMode }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [history.length]);

  return (
    <div
      className="mt-3 border rounded-md px-3 py-2 min-h-0 flex-1 flex flex-col max-md:hidden"
      style={{ borderColor: 'var(--lux-border)', background: 'var(--lux-surface-soft)', minHeight: '120px' }}
    >
      <p className="text-[11px] tracking-[0.16em] font-semibold mb-2" style={{ color: 'var(--lux-text-muted)' }}>HISTORY</p>
      <div ref={scrollRef} className="min-h-0 h-full overflow-y-auto pr-1 space-y-2 text-sm" style={{ color: 'var(--lux-text-body)' }}>
        {history.length === 0
          ? <div className="text-center pt-2" style={{ color: 'var(--lux-text-muted)' }}>No guesses yet...</div>
          : [...history].reverse().map((item, i) => (
            <HistoryEntry key={i} item={item} p1Name={p1Name} p2Name={p2Name} gameMode={gameMode} />
          ))
        }
      </div>
    </div>
  );
}
