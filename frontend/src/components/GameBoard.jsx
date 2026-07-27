import { motion, AnimatePresence } from 'framer-motion';
import CircularTimer from './CircularTimer.jsx';
import WordHistory from './WordHistory.jsx';
import WordTiles, { WordInputTiles } from './WordTiles.jsx';
import { panelCls, hintMessage } from '../utils/gameHelpers.js';

export default function GameBoard({
  gameMode, isUserTurn, activeIsP1, turnLabel,
  timeRemaining, turnTimeLimit, timerUrgent, submitting,
  hintsStep, onBumpHint, moveNumber,
  currentRound, maxRounds,
  p1Tier, p2Tier, p1Name, p2Name, userScore, computerScore,
  strikesP1, strikesP2, strikeLimit,
  wordInputRef, wordInput, setWordInput,
  displayUserWord, displayOppWord,
  p1ScoreRef, p2ScoreRef,
  safetyTier,
  onSubmitWord,
  errorMsg, hitMsg, comboCount,
  premoveWord, premoveInput, setPremoveInput, onQueuePremove, onClearPremove,
  history,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 p-2 sm:p-3 border-t overflow-hidden min-h-0 flex"
      style={{ borderColor: 'var(--border)' }}>
      <main className="flex-1 rounded-xl p-3 sm:p-4 overflow-hidden min-h-0 flex flex-col game-board">

        {/* Top bar: turn indicator + timer */}
        <div className="shrink-0 flex items-center justify-between mb-2">
          <AnimatePresence mode="wait">
            <motion.div key={turnLabel}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col">
              <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: 'var(--text-muted)' }}>Now playing</span>
              <span className="text-sm sm:text-base font-bold tracking-[0.06em]" style={{ color: 'var(--text-strong)' }}>
                {turnLabel}
              </span>
            </motion.div>
          </AnimatePresence>

          <CircularTimer
            timeRemaining={timeRemaining}
            maxTime={turnTimeLimit}
            urgent={timerUrgent}
            waiting={submitting}
          />
        </div>

        {/* Hint bar */}
        <AnimatePresence>
        {hintsStep < 3 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-2">
            <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <p className="flex-1 text-xs leading-snug" style={{ color: 'var(--text-body)' }}>
                {hintMessage(hintsStep, gameMode, isUserTurn, moveNumber)}
              </p>
              <button type="button" className="shrink-0 text-base leading-none"
                style={{ color: 'var(--text-muted)' }} onClick={onBumpHint}>×</button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Round progress — tile dots (capped for long matches) */}
        <div className="shrink-0 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="game-subtitle">Round {currentRound}/{maxRounds}</span>
            <span className="game-subtitle">{Math.round((currentRound / maxRounds) * 100)}%</span>
          </div>
          {maxRounds <= 15 ? (
            <div className="round-dots" role="list" aria-label={`Round ${currentRound} of ${maxRounds}`}>
              {Array.from({ length: maxRounds }, (_, i) => {
                const n = i + 1;
                let cls = 'round-dot';
                if (n < currentRound) cls += ' done';
                else if (n === currentRound) cls += ' current';
                return <span key={n} className={cls} role="listitem" aria-label={`Round ${n}`} title={`Round ${n}`} />;
              })}
            </div>
          ) : (
            <div className="h-2 w-full rounded overflow-hidden" style={{ background: 'var(--progress-track)' }}
              role="progressbar" aria-valuenow={currentRound} aria-valuemin={1} aria-valuemax={maxRounds}>
              <motion.div className="h-full"
                style={{ background: 'var(--good)', borderRadius: 4 }}
                animate={{ width: `${Math.min(100, (currentRound / maxRounds) * 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }} />
            </div>
          )}
        </div>

        {/* Anchor prompt */}
        {moveNumber === 0 && (
          <p className="text-center game-subtitle mb-2">Set the anchor word</p>
        )}

        {/* Word panels */}
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* P1 panel */}
          <motion.div layout className={panelCls(p1Tier, activeIsP1)}>
            <div className="flex items-start justify-between mb-2">
              <span className="game-subtitle">{p1Name}</span>
              <span className="text-right">
                <span ref={p1ScoreRef} className="block text-sm font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>{userScore.toFixed(2)}</span>
                <span className="inline-flex gap-0.5 mt-0.5">
                  {Array.from({ length: strikeLimit }).map((_, i) => (
                    <span key={i} className={`strike-pip${i < strikesP1 ? ' used' : ''}`} />
                  ))}
                </span>
              </span>
            </div>
            <div className="min-h-[3rem] flex items-center justify-center py-1">
              {(activeIsP1 && (gameMode !== 'online' || isUserTurn) && !submitting) ? (
                <WordInputTiles
                  id="word-input-main"
                  inputRef={wordInputRef}
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value)}
                  placeholder="Type a word"
                  maxLength={24}
                  size="md"
                />
              ) : displayUserWord !== '–' ? (
                <WordTiles word={displayUserWord} tier={p1Tier} size="md" animateReveal minSlots={displayUserWord.length} />
              ) : (
                <WordTiles word="" size="md" placeholder minSlots={5} />
              )}
            </div>
          </motion.div>

          {/* P2 panel */}
          <motion.div layout className={panelCls(p2Tier, !activeIsP1)}>
            <div className="flex items-start justify-between mb-2">
              <span className="game-subtitle">{p2Name}</span>
              <span className="text-right">
                <span ref={p2ScoreRef} className="block text-sm font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>{computerScore.toFixed(2)}</span>
                <span className="inline-flex gap-0.5 mt-0.5">
                  {Array.from({ length: strikeLimit }).map((_, i) => (
                    <span key={i} className={`strike-pip${i < strikesP2 ? ' used' : ''}`} />
                  ))}
                </span>
              </span>
            </div>
            <div className="min-h-[3rem] flex items-center justify-center py-1">
              {(gameMode === 'pvp' && !activeIsP1) ? (
                <WordInputTiles
                  id="word-input-main"
                  inputRef={wordInputRef}
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value)}
                  placeholder={`${p2Name}, type`}
                  maxLength={24}
                  size="md"
                />
              ) : displayOppWord !== '–' ? (
                <WordTiles word={displayOppWord} tier={p2Tier} size="md" animateReveal minSlots={displayOppWord.length} />
              ) : (
                <WordTiles word="" size="md" placeholder minSlots={5} />
              )}
            </div>
          </motion.div>
        </div>

        {/* Safety meter */}
        <AnimatePresence>
        {safetyTier && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="shrink-0 my-2">
            <p className="text-[9px] uppercase tracking-[0.14em] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Jump safety</p>
            <div className="flex gap-1.5">
              {[
                { key: 'bad', label: 'Danger', cls: 'safety-active-danger' },
                { key: 'mid', label: 'Risky', cls: 'safety-active-mid' },
                { key: 'good', label: 'Safe', cls: 'safety-active-good' },
              ].map(seg => (
                <motion.div key={seg.key}
                  animate={{ scale: safetyTier === seg.key ? 1.04 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`safety-seg ${safetyTier === seg.key ? seg.cls : ''}`}>
                  {seg.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Submit */}
        <div className="shrink-0 mt-2 flex sm:justify-end">
          <motion.button type="button"
            whileHover={!submitting ? { scale: 1.02 } : {}}
            whileTap={!submitting ? { scale: 0.97 } : {}}
            className="submit-btn h-11 sm:h-12 w-full sm:w-auto sm:min-w-[140px] rounded-xl text-sm sm:text-base px-5"
            disabled={submitting} onClick={onSubmitWord}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="timer-wait-dots visible" style={{ height: '1em' }}>
                  <span className="timer-wait-dot" /><span className="timer-wait-dot" /><span className="timer-wait-dot" />
                </span>
                Sending
              </span>
            ) : 'Enter'}
          </motion.button>
        </div>

        {/* Premove panel */}
        <AnimatePresence>
        {(gameMode === 'online' || gameMode === 'pvc') && !isUserTurn && !submitting && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="shrink-0 mt-2 rounded-xl border border-dashed px-3 py-2.5"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.16em] font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>Premove</span>
              <input id="premove-input" type="text" maxLength={24} autoComplete="off"
                inputMode="text" enterKeyHint="go"
                placeholder="Queue your next word"
                value={premoveInput} onChange={e => setPremoveInput(e.target.value)}
                className="premove-input flex-1 min-w-[120px]" />
              <motion.button type="button" whileTap={{ scale: 0.95 }}
                className="h-8 px-3 rounded-lg btn-primary text-xs font-semibold shrink-0"
                onClick={onQueuePremove}>Queue</motion.button>
              <button type="button" className="h-8 px-3 rounded-lg btn-ghost text-xs shrink-0"
                onClick={onClearPremove}>Clear</button>
            </div>
            <AnimatePresence>
            {premoveWord && (
              <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-1.5 text-[11px]" style={{ color: 'var(--good)' }}>
                ✓ Queued: &quot;{premoveWord}&quot; — auto-submits on your turn
              </motion.p>
            )}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Hit feedback / Error + combo */}
        <div className="shrink-0 mt-1.5 flex items-center justify-between min-h-5">
          <AnimatePresence mode="wait">
            {errorMsg ? (
              <motion.span key={'err-' + errorMsg} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="text-xs font-medium" style={{ color: 'var(--bad)' }}>{errorMsg}</motion.span>
            ) : hitMsg ? (
              <motion.span key={'hit-' + hitMsg} initial={{ opacity: 0, y: 4, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                className="text-xs font-semibold tracking-wide" style={{ color: 'var(--good)' }}>{hitMsg}</motion.span>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
          {comboCount >= 2 && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-xs font-semibold" style={{ color: 'var(--mid)' }}>×{comboCount} combo!</motion.span>
          )}
          </AnimatePresence>
        </div>

        {/* History */}
        <WordHistory history={history} p1Name={p1Name} p2Name={p2Name} gameMode={gameMode} />
      </main>
    </motion.div>
  );
}
