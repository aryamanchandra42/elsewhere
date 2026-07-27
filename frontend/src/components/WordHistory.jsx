import WordTiles from './WordTiles.jsx';

function tierFromEntry(item) {
  if (item.moveResult === 'STRIKE') return 'bad';
  if (item.moveResult === 'SEED') return null;
  if (typeof item.z === 'number') {
    if (item.z < 0) return 'bad';
    if (item.z < 1) return 'mid';
    return 'good';
  }
  if (typeof item.distance === 'number') {
    if (item.distance < 45) return 'bad';
    if (item.distance < 62) return 'mid';
    return 'good';
  }
  return null;
}

function HistoryEntry({ item, p1Name, p2Name, gameMode }) {
  let playerDisplay = '';
  if (item.player === 'system') {
    playerDisplay = 'Origin';
  } else if (gameMode === 'pvp') {
    playerDisplay = item.player === 'user' ? p1Name : p2Name;
  } else {
    playerDisplay = item.player === 'user' ? p1Name : (gameMode === 'online' ? p2Name : 'Computer');
  }

  const tier = tierFromEntry(item);
  const borderColor = tier === 'good' ? 'var(--good)' : tier === 'mid' ? 'var(--mid)' : tier === 'bad' ? 'var(--bad)' : 'var(--border-strong)';

  let distanceLabel = null;
  if (item.moveResult === 'SEED') {
    distanceLabel = <span style={{ color: 'var(--text-muted)' }}>Anchor word</span>;
  } else if (item.moveResult === 'STRIKE') {
    distanceLabel = (
      <span style={{ color: 'var(--bad)' }}>
        Strike{item.distance != null ? ` · ${item.distance.toFixed(3)}` : ''}
      </span>
    );
  } else if (item.distance != null) {
    distanceLabel = (
      <span style={{ color: tier === 'good' ? 'var(--good)' : tier === 'mid' ? 'var(--mid)' : 'var(--text-body)' }}>
        +{item.distance.toFixed(3)} distance
      </span>
    );
  }

  return (
    <div className="history-entry px-2.5 py-2" style={{ borderLeftColor: borderColor }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="game-subtitle" style={{ fontSize: '9px' }}>{playerDisplay}</span>
        {distanceLabel && <span className="text-[10px] font-semibold">{distanceLabel}</span>}
      </div>
      <WordTiles word={item.word} tier={tier} size="xs" minSlots={item.word?.length || 1} />
    </div>
  );
}

export default function WordHistory({ history, p1Name, p2Name, gameMode }) {
  return (
    <div
      className="mt-3 border rounded-lg px-3 py-2 min-h-0 flex-1 flex flex-col max-md:hidden"
      style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-surface)', minHeight: '120px' }}
    >
      <p className="game-subtitle mb-2">Word trail</p>
      <div className="min-h-0 h-full overflow-y-auto pr-1 space-y-2 text-sm" style={{ color: 'var(--text-body)' }}>
        {history.length === 0
          ? <div className="text-center pt-2 game-subtitle">No words played yet…</div>
          : [...history].reverse().map((item, i) => (
            <HistoryEntry key={i} item={item} p1Name={p1Name} p2Name={p2Name} gameMode={gameMode} />
          ))
        }
      </div>
    </div>
  );
}
