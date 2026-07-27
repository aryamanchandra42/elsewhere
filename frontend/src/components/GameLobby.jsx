import { motion } from 'framer-motion';
import ScreenCard from './ui/ScreenCard.jsx';
import { MODES } from '../constants/modes.js';

// Covers gamePhase 'intro' (local settings or online create/join) and 'waiting' (online lobby).
// Top-aligned scrollable shell — no vertical centering — so the card sits near the top of the
// viewport instead of leaving large empty bands above/below on wide screens.
export default function GameLobby({
  gameMode,
  gamePhase,
  turnTimeLimit,
  setTurnTimeLimit,
  maxRounds,
  setMaxRounds,
  onStartGame,
  onlineStandardRounds,
  onlineStandardTurnSeconds,
  onlineSessionError,
  onlineLobbyError,
  onlineNameInput,
  setOnlineNameInput,
  onlineMaxPlayers,
  setOnlineMaxPlayers,
  onCreateRoom,
  onlineJoinCodeInput,
  setOnlineJoinCodeInput,
  onJoinRoom,
  onlinePlayers,
  waitingStatus,
  canStartRoom,
  onStartOnlineRoom,
  isHostPlayer,
  hostJoinUrl,
  onlineCode,
}) {
  const modeInfo = MODES.find(m => m.id === gameMode);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="lobby-shell flex-1 overflow-y-auto p-4 sm:p-6">

      {/* Local mode settings (VS Computer / Pass & Play) */}
      {gameMode !== 'online' && (
        <ScreenCard className="mx-auto" maxWidth={480}>
          {modeInfo && <span className="rules-pill rules-pill-mode">{modeInfo.title}</span>}
          <p className="mt-3 text-sm" style={{ color: 'var(--text-body)' }}>
            Before you start — adjust the pace, then jump in.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rules-pill"><strong>{maxRounds}</strong>&nbsp;rounds</span>
            <span className="rules-pill"><strong>{turnTimeLimit}s</strong>&nbsp;per turn</span>
          </div>
          <div className="mt-4 glass-raised rounded-xl p-4">
            <p className="text-[10px] tracking-[0.18em] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Game settings</p>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-body)' }}>Turn time — <strong style={{ color: 'var(--text-strong)' }}>{turnTimeLimit}s</strong></label>
            <input type="range" min="5" max="30" step="1" value={turnTimeLimit}
              onChange={e => setTurnTimeLimit(parseInt(e.target.value))}
              className="w-full mb-5" style={{ accentColor: 'var(--good)' }} />
            <label className="block text-xs mb-2" style={{ color: 'var(--text-body)' }}>Rounds — <strong style={{ color: 'var(--text-strong)' }}>{maxRounds}</strong></label>
            <input type="range" min="5" max="30" step="1" value={maxRounds}
              onChange={e => setMaxRounds(parseInt(e.target.value))}
              className="w-full" style={{ accentColor: 'var(--good)' }} />
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="mt-5 h-11 w-full rounded-xl btn-primary text-sm font-semibold"
            onClick={onStartGame}>Start game →</motion.button>
        </ScreenCard>
      )}

      {/* Online lobby — create / join */}
      {gameMode === 'online' && gamePhase === 'intro' && (
        <ScreenCard className="mx-auto" maxWidth={720}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rules-pill rules-pill-mode">Online Room</span>
            <span className="rules-pill">2–4 players</span>
            <span className="rules-pill">{onlineStandardRounds} rounds</span>
            <span className="rules-pill">{onlineStandardTurnSeconds}s per turn</span>
          </div>

          {onlineSessionError && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-sm px-3 py-2 rounded-lg"
              style={{ color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid rgba(120,124,126,0.25)' }}>
              {onlineSessionError}
            </motion.p>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            {/* Create room */}
            <div className="glass-raised rounded-xl p-4 space-y-3">
              <p className="text-[10px] tracking-[0.18em] uppercase" style={{ color: 'var(--text-muted)' }}>Create a room</p>
              {onlineLobbyError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{ color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid rgba(120,124,126,0.25)' }}>
                  {onlineLobbyError}
                </motion.p>
              )}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Your name</label>
                <input type="text" maxLength={24} placeholder="Player name" value={onlineNameInput}
                  onChange={e => setOnlineNameInput(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Max players</label>
                <select value={onlineMaxPlayers} onChange={e => setOnlineMaxPlayers(parseInt(e.target.value))}
                  className="form-input">
                  <option value="2">2 players</option>
                  <option value="3">3 players</option>
                  <option value="4">4 players</option>
                </select>
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="w-full h-10 rounded-lg btn-primary text-sm font-semibold"
                onClick={onCreateRoom}>Create room</motion.button>
            </div>

            {/* Divider */}
            <div className="lobby-divider" aria-hidden>
              <span className="lobby-divider-line" />
              <span className="game-subtitle">or</span>
              <span className="lobby-divider-line" />
            </div>

            {/* Join room */}
            <div className="glass-raised rounded-xl p-4 space-y-3">
              <p className="text-[10px] tracking-[0.18em] uppercase" style={{ color: 'var(--text-muted)' }}>Join a room</p>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Room code</label>
                <div className="flex gap-2">
                  <input type="text" maxLength={8} autoComplete="off" spellCheck="false"
                    placeholder="Room code" value={onlineJoinCodeInput}
                    onChange={e => {
                      const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      setOnlineJoinCodeInput(v);
                      if (v.length === 6 || v.length === 8) onJoinRoom(v);
                    }}
                    className="form-input flex-1 uppercase tracking-widest" />
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="px-4 h-10 rounded-lg btn-ghost text-sm shrink-0"
                    onClick={() => onJoinRoom(onlineJoinCodeInput)}>Join</motion.button>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ask the host for their room code or invite link.</p>
            </div>
          </div>
        </ScreenCard>
      )}

      {/* Online waiting lobby */}
      {gameMode === 'online' && gamePhase === 'waiting' && (
        <ScreenCard className="mx-auto" maxWidth={640}>
          <span className="rules-pill rules-pill-mode">Waiting to start</span>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
              <p className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-muted)' }}>Players in room</p>
              <ul className="space-y-1.5">
                {onlinePlayers.map((p, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="text-sm flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'var(--bg-raised)', color: 'var(--text-strong)' }}>{i + 1}</span>
                    {p.name || '–'}
                  </motion.li>
                ))}
              </ul>
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{waitingStatus}</p>
              {canStartRoom && (
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                  className="w-full h-10 mt-3 rounded-lg btn-primary text-sm font-semibold"
                  onClick={onStartOnlineRoom}>Start game</motion.button>
              )}
            </div>
            {isHostPlayer && hostJoinUrl && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-soft)' }}>
                <p className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-muted)' }}>Invite link</p>
                <p className="text-xs font-mono break-all leading-snug mb-2" style={{ color: 'var(--text-body)' }}>{hostJoinUrl}</p>
                <div className="flex items-center gap-2">
                  <motion.button whileTap={{ scale: 0.96 }}
                    className="h-7 px-3 rounded-md btn-ghost text-xs"
                    onClick={() => navigator.clipboard.writeText(hostJoinUrl).catch(() => { })}>Copy link</motion.button>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Code: <strong style={{ color: 'var(--text-strong)' }}>{onlineCode}</strong></span>
                </div>
              </div>
            )}
          </div>
        </ScreenCard>
      )}
    </motion.div>
  );
}
