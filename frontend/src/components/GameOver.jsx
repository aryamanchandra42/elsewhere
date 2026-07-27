import { motion, AnimatePresence } from 'framer-motion';
import BeatAiBanner from './ui/BeatAiBanner.jsx';

export default function GameOver({
  isLoss, resultText,
  p1Name, p2Name, userScore, computerScore, strikesP1, strikesP2, strikeLimit,
  gameMode, onlineCode, onlineToken,
  onPlayAgain, onRematch, onLeave,
  showSharePanel, onToggleShare, shareText, copyStatus, onCopy,
  analysisRows,
  rematchStatus,
  pvcResult,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 overflow-y-auto p-3 sm:p-5 border-t flex items-start sm:items-center justify-center"
      style={{ borderColor: 'var(--border)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[720px] glass rounded-2xl p-5 sm:p-7">

        {/* Result headline */}
        <motion.h2
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-2xl sm:text-3xl tracking-[0.06em] text-center game-title"
          style={{ color: isLoss ? 'var(--bad)' : 'var(--good)' }}>
          {resultText}
        </motion.h2>

        {/* Score cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-5 grid grid-cols-2 gap-3 text-center">
          {[[p1Name, userScore, strikesP1], [p2Name, computerScore, strikesP2]].map(([name, score, strikes]) => (
            <div key={name} className="glass-raised rounded-xl p-3">
              <p className="text-[10px] tracking-[0.16em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{name}</p>
              <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>
                {Number(score).toFixed(2)}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: strikes >= strikeLimit ? 'var(--bad)' : 'var(--text-muted)' }}>
                {strikes}/{strikeLimit} strikes
              </p>
            </div>
          ))}
        </motion.div>

        {/* Beat the AI CTA — most relevant moment right after a VS Computer match */}
        {pvcResult && pvcResult !== 'tie' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4 }}
            className="mt-4">
            <BeatAiBanner variant={pvcResult === 'win' ? 'primary' : 'muted'} />
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-4 flex gap-2">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            className="flex-1 h-10 rounded-xl btn-primary text-sm font-semibold"
            onClick={() => {
              if (gameMode === 'online' && onlineCode && onlineToken) onRematch();
              else onPlayAgain();
            }}>
            {gameMode === 'online' ? 'Rematch' : 'Play again'}
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            type="button" className="flex-1 h-10 rounded-xl btn-ghost text-sm"
            onClick={onToggleShare}>
            Share
          </motion.button>
          {gameMode === 'online' && (
            <motion.button whileTap={{ scale: 0.97 }}
              type="button" className="flex-1 h-10 rounded-xl btn-ghost text-sm"
              onClick={onLeave}>
              Leave
            </motion.button>
          )}
        </motion.div>

        {rematchStatus && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {rematchStatus}
          </motion.p>
        )}

        {/* Share panel */}
        <AnimatePresence>
        {showSharePanel && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="mt-3 glass-raised rounded-xl p-3">
              <p className="text-[10px] tracking-[0.16em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Shareable summary</p>
              <textarea readOnly className="w-full h-24 rounded-lg p-2 text-xs font-mono resize-none"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-body)', border: '1px solid var(--border)' }}
                value={shareText} />
              <div className="mt-2 flex items-center gap-2">
                <motion.button whileTap={{ scale: 0.96 }}
                  type="button" className="h-8 px-3 rounded-lg btn-primary text-xs font-medium"
                  onClick={onCopy}>Copy</motion.button>
                <AnimatePresence>
                {copyStatus && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs" style={{ color: 'var(--good)' }}>{copyStatus}</motion.span>
                )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Analysis table */}
        {analysisRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="mt-4 rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}>
            <div className="px-3 py-2 text-[10px] tracking-[0.16em] uppercase"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              Move analysis
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                  <tr>
                    {['#', 'Player', 'Word', 'Distance', 'Strike note', 'Best move'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysisRows.map((item, idx) => {
                    const pn = item.player === 'user' ? p1Name : p2Name;
                    const isStrike = item.moveResult === 'STRIKE';
                    const dist = isStrike
                      ? `strike (${Number(item.distance).toFixed(3)})`
                      : Number(item.distance).toFixed(3);
                    let note = '–';
                    if (isStrike) {
                      const r = item.relation;
                      note = r?.explanation?.trim() || r?.summary?.trim() || String(item.strikeReason || '').trim() || '–';
                    }
                    const bm = item.bestMove
                      ? `${item.bestMove.word} (${Number(item.bestMove.distance).toFixed(3)})` : '–';
                    return (
                      <tr key={idx} className="border-t transition"
                        style={{ borderColor: 'var(--border)', color: isStrike ? 'var(--bad)' : 'var(--text-body)' }}>
                        <td className="px-3 py-1.5 text-[11px]">{idx + 1}</td>
                        <td className="px-3 py-1.5 text-[11px]">{pn}</td>
                        <td className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: 'var(--text-strong)' }}>{item.word}</td>
                        <td className="px-3 py-1.5 text-[11px]">{dist}</td>
                        <td className="px-3 py-1.5 text-[11px] leading-snug max-w-[160px]">{note}</td>
                        <td className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--good)' }}>{bm}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
