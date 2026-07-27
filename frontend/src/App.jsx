import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IntroOverlay from './components/IntroOverlay.jsx';
import HowToPlayModal from './components/HowToPlayModal.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import RematchModal from './components/RematchModal.jsx';
import MenuScreen from './components/MenuScreen.jsx';
import GameLobby from './components/GameLobby.jsx';
import GameBoard from './components/GameBoard.jsx';
import GameOver from './components/GameOver.jsx';
import * as api from './api.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_CODE = 'elsewhere_room_code';
const STORAGE_TOKEN = 'elsewhere_room_token';
const LS_INTRO_SEEN = 'elsewhere_intro_seen';
const LS_HINTS_STEP = 'elsewhere_hints_step';
const ONLINE_STANDARD_ROUNDS = 15;
const ONLINE_STANDARD_TURN_SECONDS = 10;
const STRIKE_LIMIT = 3;
const POLL_WAITING = 450;
const POLL_THEIR_TURN = 280;
const POLL_MY_TURN = 750;
const POLL_FINISHED = 400;

// ─── Storage helpers ──────────────────────────────────────────────────────────
function readCredentials() {
  try {
    const code = sessionStorage.getItem(STORAGE_CODE) || localStorage.getItem(STORAGE_CODE);
    const token = sessionStorage.getItem(STORAGE_TOKEN) || localStorage.getItem(STORAGE_TOKEN);
    return { code, token };
  } catch { return { code: null, token: null }; }
}
function saveCredentials(code, token) {
  try {
    sessionStorage.setItem(STORAGE_CODE, code);
    sessionStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_CODE, code);
    localStorage.setItem(STORAGE_TOKEN, token);
  } catch { }
}
function clearCredentials() {
  try {
    [sessionStorage, localStorage].forEach(s => {
      s.removeItem(STORAGE_CODE);
      s.removeItem(STORAGE_TOKEN);
    });
  } catch { }
}
function getIntroSeen() {
  try { return localStorage.getItem(LS_INTRO_SEEN) === '1'; } catch { return true; }
}
function setIntroSeen() {
  try { localStorage.setItem(LS_INTRO_SEEN, '1'); } catch { }
}
function getHintsStep() {
  try { return Math.min(3, Math.max(0, parseInt(localStorage.getItem(LS_HINTS_STEP) || '0', 10) || 0)); } catch { return 0; }
}
function saveHintsStep(n) {
  try { localStorage.setItem(LS_HINTS_STEP, String(Math.min(3, Math.max(0, n)))); } catch { }
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────
function tierFromMove(z, distance) {
  if (typeof z === 'number' && !Number.isNaN(z)) {
    if (z < 0) return 'bad';
    if (z < 1) return 'mid';
    return 'good';
  }
  if (typeof distance === 'number' && !Number.isNaN(distance)) {
    if (distance < 45) return 'bad';
    if (distance < 62) return 'mid';
    return 'good';
  }
  return null;
}

function onlineHistorySlot(player) {
  if (player === 'host') return 0;
  if (player === 'guest') return 1;
  if (typeof player === 'number') return player;
  const n = parseInt(player, 10);
  return Number.isNaN(n) ? null : n;
}

// ─── DOM FX (no React state needed) ──────────────────────────────────────────
function spawnFloatingText(text, color, targetEl) {
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'floating-score-pop';
  el.textContent = text;
  const jitter = (Math.random() - 0.5) * 24;
  el.style.left = `${rect.left + rect.width / 2 + jitter}px`;
  el.style.top = `${rect.top - 4}px`;
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function spawnConfetti() {
  const colors = ['#6aaa64', '#c9b458', '#787c7e', '#121213'];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = `${cx + (Math.random() - 0.5) * 50}px`;
    el.style.top = `${cy + (Math.random() - 0.5) * 50}px`;
    const angle = Math.random() * Math.PI * 2;
    const v = 100 + Math.random() * 200;
    el.style.setProperty('--tx', `${Math.cos(angle) * v}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * v}px`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(() => {
    const { code, token } = readCredentials();
    return (code && token) ? 'game' : 'landing';
  });
  // Game phase: 'intro' | 'waiting' | 'active' | 'over'
  const [gamePhase, setGamePhase] = useState('intro');
  const [gameMode, setGameMode] = useState('pvc'); // 'pvc' | 'pvp' | 'online'

  // Settings (local modes)
  const [turnTimeLimit, setTurnTimeLimit] = useState(7);
  const [maxRounds, setMaxRounds] = useState(10);

  // Game progress
  const [currentRound, setCurrentRound] = useState(1);
  const [moveNumber, setMoveNumber] = useState(0);
  const [lastWord, setLastWord] = useState(null);
  const [history, setHistory] = useState([]);
  const [isUserTurn, setIsUserTurn] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState(1); // PvP: 1 or 2

  // Scores & strikes
  const [userScore, setUserScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [strikesP1, setStrikesP1] = useState(0);
  const [strikesP2, setStrikesP2] = useState(0);

  // Names
  const [p1Name, setP1Name] = useState('You');
  const [p2Name, setP2Name] = useState('Computer');

  // End-game flags
  const [gameEndedByTimeout, setGameEndedByTimeout] = useState(false);
  const [gameEndedTooClose, setGameEndedTooClose] = useState(false);
  const [tooCloseLoserPlayer, setTooCloseLoserPlayer] = useState(null); // PvP: 1 or 2
  const [tooCloseLoserIsUser, setTooCloseLoserIsUser] = useState(null); // PvC: true/false

  // Online-specific state
  const [onlineCode, setOnlineCode] = useState(null);
  const [onlineToken, setOnlineToken] = useState(null);
  const [onlineMySlot, setOnlineMySlot] = useState(null);
  const [onlineMyRole, setOnlineMyRole] = useState(null);
  const [onlineEndReason, setOnlineEndReason] = useState(null);
  const [onlineLoserSlot, setOnlineLoserSlot] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [hostJoinUrl, setHostJoinUrl] = useState('');
  const [waitingStatus, setWaitingStatus] = useState('');
  const [isHostPlayer, setIsHostPlayer] = useState(false);
  const [canStartRoom, setCanStartRoom] = useState(false);
  const [onlineSessionError, setOnlineSessionError] = useState('');
  const [onlineLobbyError, setOnlineLobbyError] = useState('');
  const [rematchStatus, setRematchStatus] = useState('');
  const [showRematchModal, setShowRematchModal] = useState(false);

  // UI state
  const [timeRemaining, setTimeRemaining] = useState(7);
  const [timerUrgent, setTimerUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [premoveWord, setPremoveWord] = useState(null);
  const [premoveInput, setPremoveInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hitMsg, setHitMsg] = useState('');
  const [p1Tier, setP1Tier] = useState(null);
  const [p2Tier, setP2Tier] = useState(null);
  const [safetyTier, setSafetyTier] = useState(null);
  const [hintsStep, setHintsStep] = useState(getHintsStep);
  const [comboCount, setComboCount] = useState(0);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  // Online lobby form state
  const [onlineNameInput, setOnlineNameInput] = useState('');
  const [onlineJoinCodeInput, setOnlineJoinCodeInput] = useState('');
  const [onlineMaxPlayers, setOnlineMaxPlayers] = useState(4);

  // Overlays
  const [showIntro, setShowIntro] = useState(!getIntroSeen());
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // ─── Refs (mutable, no re-render) ────────────────────────────────────────────
  const timerIntervalRef = useRef(null);
  const timerDeadlineRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const moveInFlightRef = useRef(false);
  const joinInFlightRef = useRef(false);
  const pendingComputerRef = useRef(null); // { word, distance, meaning, z }
  const historyRenderKeyRef = useRef('');
  const timeoutPendingRef = useRef(false);
  const wordInputRef = useRef(null);
  const p1ScoreRef = useRef(null);
  const p2ScoreRef = useRef(null);

  // Snapshot ref so callbacks can read latest state without being re-created
  const S = useRef({});
  S.current = {
    gameMode, isUserTurn, moveNumber, lastWord, history, currentRound, maxRounds,
    turnTimeLimit, wordInput, onlineCode, onlineToken, strikesP1, strikesP2,
    currentPlayer, p1Name, p2Name, userScore, computerScore, gamePhase,
    gameEndedByTimeout, gameEndedTooClose, tooCloseLoserPlayer, tooCloseLoserIsUser,
    onlineMySlot, onlineMyRole, onlineEndReason, onlineLoserSlot,
    premoveWord, timeRemaining,
  };

  // ─── Timer ────────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    timerDeadlineRef.current = null;
  }, []);

  // forward-declared; defined after endGame
  const handleTimerExpireRef = useRef(null);

  const startTimer = useCallback((seconds) => {
    stopTimer();
    timerDeadlineRef.current = Date.now() + seconds * 1000;
    setTimeRemaining(seconds);
    setTimerUrgent(false);
    timerIntervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((timerDeadlineRef.current - Date.now()) / 1000));
      setTimeRemaining(left);
      setTimerUrgent(left <= 3);
      if (left <= 0) {
        stopTimer();
        handleTimerExpireRef.current?.();
      }
    }, 250);
  }, [stopTimer]);

  // ─── Poll stop ────────────────────────────────────────────────────────────────
  const stopPoll = useCallback(() => {
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  }, []);

  // ─── Tier helpers ─────────────────────────────────────────────────────────────
  const applyMoveTier = useCallback((z, distance, mover) => {
    const tier = tierFromMove(z, distance);
    if (!tier) return;
    setSafetyTier(tier);
    if (mover === 'user') { setP1Tier(tier); setP2Tier(null); }
    else { setP2Tier(tier); setP1Tier(null); }
  }, []);

  const clearTiers = useCallback(() => { setP1Tier(null); setP2Tier(null); setSafetyTier(null); }, []);

  // ─── Hints ────────────────────────────────────────────────────────────────────
  const bumpHint = useCallback((to) => {
    setHintsStep(s => {
      const next = to !== undefined ? to : s + 1;
      saveHintsStep(next);
      return next;
    });
  }, []);

  // ─── History ──────────────────────────────────────────────────────────────────
  const addToHistory = useCallback((entry) => setHistory(h => [...h, entry]), []);

  const buildPlayedWords = useCallback(() => {
    const words = S.current.history.map(e => e.word);
    if (pendingComputerRef.current?.word) words.push(pendingComputerRef.current.word);
    return words;
  }, []);

  // ─── Best-move fetch (background, updates history after) ────────────────────
  const fetchBestMoveAsync = useCallback((anchor, histWords, moveNum, playedWord) => {
    if (!anchor) return;
    api.getBestMove(anchor, histWords, moveNum).then(j => {
      if (!j.best_move) return;
      setHistory(h => h.map(item =>
        item.word === playedWord && !item.bestMove ? { ...item, bestMove: j.best_move } : item
      ));
    }).catch(() => { });
  }, []);

  // ─── endGame ──────────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    stopTimer();
    pendingComputerRef.current = null;
    clearTiers();
    setGamePhase('over');
  }, [clearTiers, stopTimer]);

  // ─── computerMove (PvC) ───────────────────────────────────────────────────────
  const computerMoveRef = useRef(null);
  computerMoveRef.current = async () => {
    const s = S.current;
    if (!s.lastWord) { setIsUserTurn(true); startTimer(s.turnTimeLimit); return; }
    const nextMove = s.moveNumber + 1;
    try {
      const data = await api.getComputerMove(s.lastWord, buildPlayedWords(), nextMove);
      if (data.error) { setIsUserTurn(true); startTimer(s.turnTimeLimit); return; }

      if (data.too_close) {
        const newStrikes = s.strikesP2 + 1;
        setStrikesP2(newStrikes);
        addToHistory({ word: data.word, player: 'computer', distance: data.distance, z: data.z, moveResult: 'STRIKE', relation: data.relation, strikeReason: data.reason });
        applyMoveTier(data.z, data.distance, 'computer');
        if (newStrikes < STRIKE_LIMIT) {
          setErrorMsg(`Computer too close: strike ${newStrikes} of ${STRIKE_LIMIT}.`);
          setTimeout(() => { setErrorMsg(''); computerMoveRef.current(); }, 3200);
        } else {
          setGameEndedTooClose(true);
          setTooCloseLoserIsUser(false);
          setMoveNumber(nextMove);
          setLastWord(data.word);
          setTimeout(() => endGame(), 600);
        }
        return;
      }

      setComputerScore(prev => {
        spawnFloatingText(`+${data.distance.toFixed(3)}`, '#c9b458', p2ScoreRef.current);
        return prev + data.distance;
      });
      pendingComputerRef.current = { word: data.word, distance: data.distance, meaning: data.meaning, z: data.z };
      applyMoveTier(data.z, data.distance, 'computer');
      bumpHint(2);
      setMoveNumber(nextMove);
      setLastWord(data.word);

      if (s.currentRound >= s.maxRounds) {
        setTimeout(() => {
          if (pendingComputerRef.current) {
            addToHistory({ ...pendingComputerRef.current, player: 'computer', moveResult: null });
            pendingComputerRef.current = null;
          }
          endGame();
        }, 2000);
      } else {
        setCurrentRound(r => r + 1);
        setIsUserTurn(true);
        startTimer(s.turnTimeLimit);
        // fire premove if queued
        if (s.premoveWord) setTimeout(() => consumePremoveRef.current?.(), 100);
      }
    } catch (e) { console.error(e); }
  };

  // ─── Timer expire ─────────────────────────────────────────────────────────────
  handleTimerExpireRef.current = () => {
    const s = S.current;
    if (s.gamePhase !== 'active') return;
    if (s.gameMode === 'pvc' && !s.isUserTurn) return;
    if (s.gameMode === 'online' && moveInFlightRef.current) return;
    setGameEndedByTimeout(true);
    setErrorMsg("Time's up!");
    if (s.gameMode === 'online') {
      timeoutPendingRef.current = true;
      api.submitTimeout(s.onlineCode, s.onlineToken).then(res => {
        if (res.ok && res.data?.room?.status === 'finished') {
          applyOnlineStateRef.current?.(res.data.room);
          endGame();
        }
      }).catch(() => { });
    } else {
      setTimeout(() => endGame(), 1000);
    }
  };

  // ─── Premove ──────────────────────────────────────────────────────────────────
  const consumePremoveRef = useRef(null);
  consumePremoveRef.current = () => {
    const pw = S.current.premoveWord;
    if (!pw) return;
    setPremoveWord(null);
    setPremoveInput('');
    setWordInput(pw);
    setTimeout(() => submitWordWithRef.current?.(pw), 50);
  };

  // ─── submitWordWith ───────────────────────────────────────────────────────────
  const submitWordWithRef = useRef(null);
  submitWordWithRef.current = async (word) => {
    const s = S.current;
    if (s.gamePhase !== 'active') return;
    const w = word.toLowerCase().trim();
    if (!w) return;

    // ── Online ──
    if (s.gameMode === 'online') {
      if (!s.isUserTurn || moveInFlightRef.current) return;
      moveInFlightRef.current = true;
      stopTimer();
      setSubmitting(true);
      setErrorMsg('');
      try {
        const res = await api.submitMove(s.onlineCode, s.onlineToken, w);
        setWordInput('');
        if (!res.ok) {
          setErrorMsg(res.data?.error || 'Error submitting move.');
          setSubmitting(false);
          moveInFlightRef.current = false;
          startTimer(s.turnTimeLimit);
          return;
        }
        if (res.data.foul_only) {
          applyOnlineStateRef.current?.(res.data.room);
          const st = res.data.strikes ?? 0;
          const lim = res.data.strike_limit ?? STRIKE_LIMIT;
          setErrorMsg(`Too close: strike ${st} of ${lim}. Try again.`);
          setSubmitting(false);
          moveInFlightRef.current = false;
          startTimer(s.turnTimeLimit);
          return;
        }
        applyOnlineStateRef.current?.(res.data.room);
        // Show hit feedback from last scored move in the returned history
        const hist = res.data.room?.word_history || [];
        const lastScored = [...hist].reverse().find(e => e.eval_result !== 'STRIKE' && e.eval_result !== 'SEED' && typeof e.z === 'number');
        if (lastScored) {
          const onlineTier = tierFromMove(lastScored.z, lastScored.distance);
          setHitMsg(onlineTier === 'good' ? `Strong jump! +${Number(lastScored.distance).toFixed(3)}` : onlineTier === 'mid' ? `Safe jump +${Number(lastScored.distance).toFixed(3)}` : `Risky jump +${Number(lastScored.distance).toFixed(3)}`);
        }
        if (res.data.room?.status === 'finished') endGame();
      } catch {
        setErrorMsg('Network error.');
        setSubmitting(false);
        moveInFlightRef.current = false;
        startTimer(s.turnTimeLimit);
      } finally {
        if (moveInFlightRef.current) { setSubmitting(false); moveInFlightRef.current = false; }
      }
      return;
    }

    // ── PvP / PvC ──
    if (s.gameMode === 'pvc' && !s.isUserTurn) return;
    stopTimer();
    setErrorMsg('');
    setHitMsg('');

    // Flush pending computer word into history
    if (pendingComputerRef.current) {
      addToHistory({ ...pendingComputerRef.current, player: 'computer', moveResult: null });
      pendingComputerRef.current = null;
    }

    const nextMove = s.moveNumber + 1;

    try {
      // Move 1 = anchor word
      if (nextMove === 1) {
        const { ok, data } = await api.validateAnchor(w);
        if (!ok) { setErrorMsg(data.error || 'Invalid word.'); startTimer(s.turnTimeLimit); return; }
        setMoveNumber(1);
        setLastWord(w);
        setWordInput('');
        const anchorPlayer = s.gameMode === 'pvp' ? (s.currentPlayer === 1 ? 'user' : 'computer') : 'user';
        addToHistory({ word: w, player: anchorPlayer, distance: null, z: null, moveResult: 'SEED' });
        clearTiers();
        bumpHint(1);
        if (s.gameMode === 'pvp') {
          if (s.currentPlayer === 1) setCurrentPlayer(2);
          else { setCurrentPlayer(1); setCurrentRound(r => r + 1); }
          if (s.currentRound > s.maxRounds) { setTimeout(() => endGame(), 800); }
          else startTimer(s.turnTimeLimit);
        } else {
          setIsUserTurn(false);
          setTimeout(() => computerMoveRef.current(), 1500);
        }
        return;
      }

      // Move 2+: evaluate distance
      const anchorSnap = s.lastWord;
      const histSnap = buildPlayedWords();
      const data = await api.evaluateDistance(s.lastWord, w, histSnap, nextMove);
      if (data.error) {
        let msg = data.error;
        if (data.suggestion) msg += ` Did you mean "${data.suggestion}"?`;
        setErrorMsg(msg);
        startTimer(s.turnTimeLimit);
        return;
      }

      if (data.too_close) {
        const moverLabel = s.gameMode === 'pvp' ? (s.currentPlayer === 1 ? 'user' : 'computer') : 'user';
        const foulOnP1 = s.gameMode === 'pvp' ? s.currentPlayer === 1 : true;
        addToHistory({ word: w, player: moverLabel, distance: data.distance, z: data.z, moveResult: 'STRIKE', relation: data.relation, strikeReason: data.reason });
        applyMoveTier(data.z, data.distance, moverLabel);
        const prevStrikes = foulOnP1 ? s.strikesP1 : s.strikesP2;
        const newStrikes = prevStrikes + 1;
        if (foulOnP1) setStrikesP1(newStrikes); else setStrikesP2(newStrikes);
        if (newStrikes < STRIKE_LIMIT) {
          setErrorMsg(`Too close: strike ${newStrikes} of ${STRIKE_LIMIT}. Try again.`);
          setWordInput('');
          startTimer(s.turnTimeLimit);
          return;
        }
        setGameEndedTooClose(true);
        if (s.gameMode === 'pvp') setTooCloseLoserPlayer(s.currentPlayer);
        else { setTooCloseLoserIsUser(true); fetchBestMoveAsync(anchorSnap, histSnap, nextMove, w); }
        setMoveNumber(nextMove);
        setLastWord(w);
        setWordInput('');
        setTimeout(() => endGame(), 600);
        return;
      }

      // Valid move
      setMoveNumber(nextMove);
      setLastWord(w);
      setWordInput('');

      if (s.gameMode === 'pvp') {
        const moverLabel = s.currentPlayer === 1 ? 'user' : 'computer';
        // Add directly to history — no pending buffer in PvP (that's only for async PvC computer moves)
        addToHistory({ word: w, player: moverLabel, distance: data.distance, z: data.z, moveResult: null });
        if (s.currentPlayer === 1) { setUserScore(prev => { spawnFloatingText(`+${data.distance.toFixed(3)}`, '#6aaa64', p1ScoreRef.current); return prev + data.distance; }); }
        else { setComputerScore(prev => { spawnFloatingText(`+${data.distance.toFixed(3)}`, '#c9b458', p2ScoreRef.current); return prev + data.distance; }); }
        applyMoveTier(data.z, data.distance, moverLabel);
        bumpHint(2);
        const pvpTier = tierFromMove(data.z, data.distance);
        setHitMsg(pvpTier === 'good' ? `Strong jump! +${data.distance.toFixed(3)}` : pvpTier === 'mid' ? `Safe jump +${data.distance.toFixed(3)}` : `Risky jump +${data.distance.toFixed(3)}`);
        if (s.currentPlayer === 1) setCurrentPlayer(2);
        else { setCurrentPlayer(1); setCurrentRound(r => r + 1); }
        if (s.currentRound > s.maxRounds) setTimeout(() => endGame(), 800);
        else startTimer(s.turnTimeLimit);
      } else {
        // PvC
        setUserScore(prev => { spawnFloatingText(`+${data.distance.toFixed(3)}`, '#6aaa64', p1ScoreRef.current); return prev + data.distance; });
        addToHistory({ word: w, player: 'user', distance: data.distance, z: data.z, moveResult: null });
        fetchBestMoveAsync(anchorSnap, histSnap, nextMove, w);
        applyMoveTier(data.z, data.distance, 'user');
        bumpHint(2);
        const pvcTier = tierFromMove(data.z, data.distance);
        setHitMsg(pvcTier === 'good' ? `Strong jump! +${data.distance.toFixed(3)}` : pvcTier === 'mid' ? `Safe jump +${data.distance.toFixed(3)}` : `Risky jump +${data.distance.toFixed(3)}`);
        const isStrong = pvcTier === 'good';
        if (isStrong) spawnConfetti();
        if (s.currentRound >= s.maxRounds) { setTimeout(() => endGame(), 1000); }
        else { setIsUserTurn(false); setTimeout(() => computerMoveRef.current(), 1500); }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred.');
      startTimer(s.turnTimeLimit);
    }
  };

  const submitWord = useCallback(() => {
    const w = S.current.wordInput.toLowerCase().trim();
    if (!w) return;
    submitWordWithRef.current(w);
  }, []);

  // ─── applyOnlineState ─────────────────────────────────────────────────────────
  const applyOnlineStateRef = useRef(null);
  applyOnlineStateRef.current = (game) => {
    if (!game) return;
    const mySlot = typeof game.my_slot === 'number' ? game.my_slot : null;
    const myRole = game.my_role || null;
    setOnlineMySlot(mySlot);
    setOnlineMyRole(myRole);

    const endReason = game.end_reason || null;
    let loserSlotVal = typeof game.loser_slot === 'number' ? game.loser_slot : null;
    if (loserSlotVal === null && game.loser_role != null) {
      const lr = String(game.loser_role).toLowerCase();
      if (lr === 'host') loserSlotVal = 0;
      else if (lr === 'guest') loserSlotVal = 1;
      else { const p = parseInt(lr, 10); if (!Number.isNaN(p)) loserSlotVal = p; }
    }
    setOnlineEndReason(endReason);
    setOnlineLoserSlot(loserSlotVal);

    const plist = Array.isArray(game.players) ? game.players : [];
    const isHost = myRole === 'host' || mySlot === 0;
    setIsHostPlayer(isHost);

    const hostNm = String(game.host_username || '').trim() || 'Host';
    const guestNm = String(game.guest_username || '').trim() || 'Guest';
    let newP2Name;
    if (plist.length > 2 && mySlot !== null) {
      const others = plist.filter((_, i) => i !== mySlot);
      newP2Name = others.map(p => p.name).join(', ') || 'Others';
    } else {
      newP2Name = isHost ? (game.guest_username ? guestNm : 'Opponent') : hostNm;
    }
    setP1Name('You');
    setP2Name(newP2Name);

    const mr = Math.max(5, Math.min(30, Number(game.max_rounds) || ONLINE_STANDARD_ROUNDS));
    const ttl = Math.max(5, Math.min(30, Number(game.turn_time_limit) || ONLINE_STANDARD_TURN_SECONDS));
    setMaxRounds(mr);
    setTurnTimeLimit(ttl);
    setCurrentRound(game.current_round || 1);

    // Scores
    if (plist.length > 0 && mySlot !== null && plist[mySlot]) {
      const me = plist[mySlot];
      const others = plist.filter((_, i) => i !== mySlot);
      setUserScore(Number(me.score) || 0);
      setComputerScore(others.reduce((acc, p) => acc + (Number(p.score) || 0), 0));
      setStrikesP1(Number(me.strikes) || 0);
      setStrikesP2(others.reduce((acc, p) => acc + (Number(p.strikes) || 0), 0));
    } else {
      setUserScore(Number(isHost ? game.host_score : game.guest_score) || 0);
      setComputerScore(Number(isHost ? game.guest_score : game.host_score) || 0);
      setStrikesP1(Number(isHost ? game.host_strikes : game.guest_strikes) || 0);
      setStrikesP2(Number(isHost ? game.guest_strikes : game.host_strikes) || 0);
    }

    // History sync
    const hist = game.word_history || [];
    const renderKey = JSON.stringify({ len: hist.length, last: game.last_word || '', round: game.current_round });
    if (renderKey !== historyRenderKeyRef.current) {
      historyRenderKeyRef.current = renderKey;
      const newHistory = hist.map(entry => {
        let playerLabel;
        if (entry.player === 'system') { playerLabel = 'system'; }
        else {
          const ep = onlineHistorySlot(entry.player);
          playerLabel = (ep !== null && mySlot !== null && ep === mySlot) ? 'user' : 'computer';
        }
        let mr2 = null;
        if (entry.eval_result === 'SEED') mr2 = 'SEED';
        else if (entry.eval_result === 'STRIKE') mr2 = 'STRIKE';
        return { word: entry.word, player: playerLabel, distance: entry.distance, z: entry.z, moveResult: mr2, relation: entry.relation, strikeReason: entry.reason };
      });
      setHistory(newHistory);
      setMoveNumber(hist.length);
      setLastWord(game.last_word || null);

      // Apply tier for last scored move
      for (let i = hist.length - 1; i >= 0; i--) {
        const e = hist[i];
        if (e.eval_result === 'SEED' || e.eval_result === 'STRIKE' || typeof e.z !== 'number') continue;
        const ep = onlineHistorySlot(e.player);
        const pl = (ep !== null && mySlot !== null && ep === mySlot) ? 'user' : 'computer';
        applyMoveTier(e.z, e.distance, pl);
        break;
      }
    }

    const prevIsMyTurn = S.current.isUserTurn;
    const isMyTurn = !!game.is_my_turn;
    setIsUserTurn(isMyTurn);

    if (isMyTurn && !moveInFlightRef.current) {
      const needsFreshClock = !prevIsMyTurn || S.current.timeRemaining > ttl;
      if (needsFreshClock) startTimer(ttl);
    } else if (!isMyTurn) {
      stopTimer();
      timeoutPendingRef.current = false;
    }

    if (game.status === 'active') {
      setGamePhase('active');
      setGameEndedByTimeout(false);
      setShowRematchModal(false);
    }

    // Rematch modal logic
    if (game.status === 'finished' && game.rematch) {
      const votes = game.rematch.votes || {};
      const sk = mySlot != null ? String(mySlot) : '';
      const myVote = votes[sk];
      let otherAccepted = false, otherDeclined = false;
      Object.keys(votes).forEach(k => {
        if (String(k) === sk) return;
        if (votes[k] === true) otherAccepted = true;
        if (votes[k] === false) otherDeclined = true;
      });
      if (otherDeclined) setRematchStatus('A player declined rematch.');
      else if (myVote === true && !otherAccepted) setRematchStatus('Waiting for opponent to accept rematch...');
      if (otherAccepted && myVote !== true && myVote !== false) setShowRematchModal(true);
      else setShowRematchModal(false);
    } else {
      setShowRematchModal(false);
    }

    // Fire premove if it just became our turn
    if (game.status === 'active' && isMyTurn && !prevIsMyTurn && S.current.premoveWord && !moveInFlightRef.current) {
      setTimeout(() => consumePremoveRef.current?.(), 50);
    }
  };

  // ─── applyWaitingLobby ────────────────────────────────────────────────────────
  const applyWaitingLobby = useCallback((game) => {
    const plist = Array.isArray(game.players) ? game.players : [];
    const mySlot = typeof game.my_slot === 'number' ? game.my_slot : null;
    const isHost = !!game.is_host || mySlot === 0;
    setOnlineMySlot(mySlot);
    setOnlineMyRole(game.my_role || null);
    setIsHostPlayer(isHost);
    setOnlinePlayers(plist);
    const cap = Math.max(2, Math.min(4, Number(game.max_players) || 4));
    setWaitingStatus(
      isHost
        ? `${plist.length} of ${cap} players here. Start once two or more have joined.`
        : 'Waiting for the host to start.'
    );
    setCanStartRoom(isHost && plist.length >= 2 && game.status === 'waiting');
  }, []);

  // ─── Polling loop ─────────────────────────────────────────────────────────────
  const startPoll = useCallback((code, token) => {
    stopPoll();
    let failCount = 0;
    const schedule = (ms) => { pollTimeoutRef.current = setTimeout(runPoll, ms); };
    const runPoll = async () => {
      if (!code || !token) return;
      if (pollInFlightRef.current) { schedule(120); return; }
      pollInFlightRef.current = true;
      let nextDelay = 650;
      try {
        const { ok, status, data } = await api.getRoom(code, token);
        failCount = 0;
        if (status === 403 || status === 404) {
          stopPoll();
          invalidateSessionRef.current?.('This room session is invalid or expired.');
          return;
        }
        const game = data.room;
        if (game.status === 'waiting') {
          applyWaitingLobby(game);
          nextDelay = POLL_WAITING;
        } else if (game.status === 'active') {
          if (S.current.gamePhase === 'waiting') setGamePhase('active');
          applyOnlineStateRef.current?.(game);
          nextDelay = game.is_my_turn ? POLL_MY_TURN : POLL_THEIR_TURN;
        } else if (game.status === 'finished') {
          applyOnlineStateRef.current?.(game);
          if (S.current.gamePhase !== 'over') endGame();
          const hasVotes = game.rematch?.votes
            ? Object.values(game.rematch.votes).some(v => v != null) : false;
          nextDelay = hasVotes ? POLL_FINISHED : Math.max(POLL_FINISHED, 2200);
        }
      } catch {
        failCount++;
        if (failCount >= 3) { setErrorMsg('Network error (poll).'); return; }
        nextDelay = Math.min(1500, 350 * failCount);
      } finally {
        pollInFlightRef.current = false;
      }
      schedule(nextDelay);
    };
    schedule(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyWaitingLobby, endGame, stopPoll]);

  // ─── Invalidate session ───────────────────────────────────────────────────────
  const invalidateSessionRef = useRef(null);
  invalidateSessionRef.current = (msg) => {
    stopPoll();
    stopTimer();
    clearCredentials();
    setOnlineCode(null);
    setOnlineToken(null);
    setShowRematchModal(false);
    setPremoveWord(null);
    setGameMode('online');
    setGamePhase('intro');
    setScreen('game');
    setOnlineSessionError(msg || 'Session invalid or expired.');
  };

  // ─── Create room ──────────────────────────────────────────────────────────────
  const createRoom = useCallback(async () => {
    const name = onlineNameInput.trim() || 'Host';
    setOnlineLobbyError('');
    setOnlineSessionError('');
    try {
      const { ok, data } = await api.createRoom(name, ONLINE_STANDARD_ROUNDS, ONLINE_STANDARD_TURN_SECONDS, onlineMaxPlayers);
      if (!ok) { setOnlineLobbyError(data?.error || 'Failed to create room.'); return; }
      setGameMode('online');
      setOnlineCode(data.code);
      setOnlineToken(data.token);
      saveCredentials(data.code, data.token);
      setGamePhase('waiting');
      const url = `${location.origin}/join/${encodeURIComponent(data.code)}`;
      setHostJoinUrl(url);
      if (data.room) applyWaitingLobby(data.room);
      startPoll(data.code, data.token);
    } catch { setOnlineLobbyError('Network error. Try again.'); }
  }, [onlineNameInput, onlineMaxPlayers, applyWaitingLobby, startPoll]);

  // ─── Join room ────────────────────────────────────────────────────────────────
  const joinRoomWithCode = useCallback(async (rawCode) => {
    if (joinInFlightRef.current) return;
    const code = String(rawCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!code) { setOnlineLobbyError('Enter a room code.'); return; }
    const name = onlineNameInput.trim() || 'Guest';
    setOnlineLobbyError('');
    setOnlineSessionError('');
    joinInFlightRef.current = true;
    try {
      const { ok, data } = await api.joinRoom(code, name);
      if (!ok) { setOnlineLobbyError(data?.error || 'Could not join that room.'); return; }
      setOnlineCode(data.code);
      setOnlineToken(data.token);
      saveCredentials(data.code, data.token);
      setGameMode('online');
      const room = data.room;
      if (room?.status === 'waiting') {
        setGamePhase('waiting');
        if (room.is_host) { const url = `${location.origin}/join/${encodeURIComponent(data.code)}`; setHostJoinUrl(url); }
        applyWaitingLobby(room);
        startPoll(data.code, data.token);
      } else {
        setGamePhase(room?.status === 'finished' ? 'over' : 'active');
        applyOnlineStateRef.current?.(room);
        startPoll(data.code, data.token);
      }
    } catch { setOnlineLobbyError('Network error. Try again.'); }
    finally { joinInFlightRef.current = false; }
  }, [onlineNameInput, applyWaitingLobby, startPoll]);

  // ─── Start room ───────────────────────────────────────────────────────────────
  const startOnlineRoom = useCallback(async () => {
    const s = S.current;
    if (!s.onlineCode || !s.onlineToken) return;
    try {
      const { ok, data } = await api.startRoom(s.onlineCode, s.onlineToken);
      if (!ok) { setOnlineSessionError(data?.error || 'Could not start game.'); return; }
      setGamePhase('active');
      applyOnlineStateRef.current?.(data.room);
    } catch { setOnlineSessionError('Network error. Try again.'); }
  }, []);

  // ─── Rematch ──────────────────────────────────────────────────────────────────
  const requestRematch = useCallback(async (accept) => {
    const s = S.current;
    if (!s.onlineCode || !s.onlineToken) return;
    try {
      const { ok, data } = await api.submitRematch(s.onlineCode, s.onlineToken, accept);
      if (!ok) { setErrorMsg(data?.error || 'Could not send rematch response.'); return; }
      if (!accept) { resetGameRef.current?.(); return; }
      setRematchStatus('Waiting for opponent…');
      if (data.started && data.room) {
        setGamePhase('active');
        applyOnlineStateRef.current?.(data.room);
      }
      startPoll(s.onlineCode, s.onlineToken);
    } catch { setErrorMsg('Network error while requesting rematch.'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoll]);

  // ─── Reset ────────────────────────────────────────────────────────────────────
  const resetGameRef = useRef(null);
  resetGameRef.current = () => {
    stopTimer();
    stopPoll();
    clearCredentials();
    clearTiers();
    pendingComputerRef.current = null;
    historyRenderKeyRef.current = '';
    moveInFlightRef.current = false;
    joinInFlightRef.current = false;
    setPremoveWord(null); setPremoveInput('');
    setGamePhase('intro');
    setCurrentRound(1); setMoveNumber(0); setLastWord(null); setHistory([]);
    setIsUserTurn(true); setCurrentPlayer(1);
    setUserScore(0); setComputerScore(0); setStrikesP1(0); setStrikesP2(0);
    setGameEndedByTimeout(false); setGameEndedTooClose(false);
    setTooCloseLoserPlayer(null); setTooCloseLoserIsUser(null);
    setOnlineCode(null); setOnlineToken(null);
    setShowRematchModal(false); setRematchStatus('');
    setErrorMsg(''); setHitMsg(''); setWordInput('');
    setShowSharePanel(false); setHintsStep(getHintsStep());
    setOnlineLobbyError(''); setOnlineSessionError('');
  };
  const resetGame = useCallback(() => resetGameRef.current(), []);

  // ─── startGame (local modes) ──────────────────────────────────────────────────
  const startGame = useCallback(() => {
    stopTimer(); stopPoll(); clearTiers();
    pendingComputerRef.current = null; historyRenderKeyRef.current = '';
    timeoutPendingRef.current = false; moveInFlightRef.current = false;
    setPremoveWord(null); setPremoveInput('');
    setGamePhase('active');
    setCurrentRound(1); setMoveNumber(0); setLastWord(null); setHistory([]);
    setIsUserTurn(true); setCurrentPlayer(1);
    setUserScore(0); setComputerScore(0); setStrikesP1(0); setStrikesP2(0);
    setGameEndedByTimeout(false); setGameEndedTooClose(false);
    setTooCloseLoserPlayer(null); setTooCloseLoserIsUser(null);
    setErrorMsg(''); setHitMsg(''); setWordInput('');
    setShowSharePanel(false); setShareText(''); setCopyStatus(''); setRematchStatus('');
    setHintsStep(getHintsStep());
    startTimer(S.current.turnTimeLimit);
    setTimeout(() => wordInputRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTiers, startTimer, stopPoll, stopTimer]);

  // ─── Menu navigation (mode select) ───────────────────────────────────────────
  // All local modes now route through the intro/settings screen before startGame()
  // is actually called — the player taps "Start game" once they're happy with the
  // rounds/turn-time settings, instead of jumping straight into an active board.
  const startPvcFlow = useCallback(() => {
    setGameMode('pvc'); setP1Name('You'); setP2Name('Computer');
    setScreen('game'); setGamePhase('intro');
  }, []);

  const startPvpFlow = useCallback((n1, n2) => {
    setP1Name(n1); setP2Name(n2); setGameMode('pvp');
    setScreen('game'); setGamePhase('intro');
  }, []);

  const startOnlineFlow = useCallback(() => {
    setGameMode('online'); setOnlineLobbyError(''); setOnlineSessionError('');
    setScreen('game'); setGamePhase('intro');
  }, []);

  // ─── Premove queue ────────────────────────────────────────────────────────────
  const queuePremove = useCallback(() => {
    const w = premoveInput.trim().toLowerCase();
    if (!w) { setErrorMsg('Enter a word to queue.'); return; }
    setErrorMsg('');
    setPremoveWord(w);
  }, [premoveInput]);

  const clearPremove = useCallback(() => { setPremoveWord(null); setPremoveInput(''); }, []);

  // ─── Restore saved session on mount ──────────────────────────────────────────
  useEffect(() => {
    const { code, token } = readCredentials();
    if (!code || !token) return;
    api.getRoom(code, token).then(({ ok, status, data }) => {
      if (!ok || status !== 200) { clearCredentials(); return; }
      setScreen('game');
      setOnlineCode(code); setOnlineToken(token); setGameMode('online');
      const game = data.room;
      if (game.status === 'waiting') {
        setGamePhase('waiting');
        if (game.is_host) { const url = `${location.origin}/join/${encodeURIComponent(code)}`; setHostJoinUrl(url); }
        applyWaitingLobby(game);
        startPoll(code, token);
      } else {
        setGamePhase(game.status === 'finished' ? 'over' : 'active');
        applyOnlineStateRef.current?.(game);
        if (game.status !== 'finished') startPoll(code, token);
        else { endGame(); startPoll(code, token); }
      }
    }).catch(() => clearCredentials());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handle /join/<code> in URL ───────────────────────────────────────────────
  useEffect(() => {
    const match = location.pathname.match(/^\/join\/([A-Za-z0-9]{4,12})\/?$/);
    if (!match) return;
    const code = match[1].toUpperCase();
    const { code: storedCode } = readCredentials();
    if (storedCode && storedCode.toUpperCase() !== code) clearCredentials();
    setGameMode('online'); setScreen('game'); setGamePhase('intro');
    setOnlineJoinCodeInput(code);
    joinRoomWithCode(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-focus word input on turn start ─────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'active' || submitting) return;
    const canType = (gameMode === 'pvp') ||
      (gameMode === 'pvc' && isUserTurn) ||
      (gameMode === 'online' && isUserTurn);
    if (!canType) return;
    const t = setTimeout(() => wordInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [gamePhase, isUserTurn, currentPlayer, submitting, gameMode]);

  // ─── Enter key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.isComposing) return;
      const key = e.key?.toLowerCase();
      if (key !== 'enter' && e.code?.toLowerCase() !== 'enter') return;
      const t = e.target;
      if (t?.id === 'premove-input') { e.preventDefault(); queuePremove(); return; }
      if (t?.tagName && ['input', 'textarea', 'select'].includes(t.tagName.toLowerCase()) && t.id !== 'word-input-main') return;
      const s = S.current;
      if (s.gamePhase !== 'active') return;
      if (s.gameMode === 'online' && (!s.isUserTurn || moveInFlightRef.current)) return;
      if (s.gameMode === 'pvc' && !s.isUserTurn) return;
      e.preventDefault();
      submitWord();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [queuePremove, submitWord]);

  // ─── Combo count ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const valid = history.filter(i => i.distance !== null && i.moveResult !== 'STRIKE');
    let count = 0;
    for (let i = valid.length - 1; i >= 0; i--) {
      const strong = typeof valid[i].z === 'number' ? valid[i].z > 1.0 : Number(valid[i].distance) > 0.8;
      if (strong) count++; else break;
    }
    setComboCount(count);
  }, [history]);

  // ─── Derived values ───────────────────────────────────────────────────────────
  const activeIsP1 = gameMode === 'pvp' ? currentPlayer === 1 : isUserTurn;

  const validHistory = history.filter(e => e.moveResult !== 'STRIKE');
  let displayUserWord = '–', displayOppWord = '–';
  for (let i = validHistory.length - 1; i >= 0; i--) {
    const e = validHistory[i];
    if (e.player === 'user' && displayUserWord === '–') displayUserWord = e.word;
    if ((e.player === 'computer' || e.player === 'system') && displayOppWord === '–') displayOppWord = e.word;
    if (displayUserWord !== '–' && displayOppWord !== '–') break;
  }
  if (pendingComputerRef.current?.word) displayOppWord = pendingComputerRef.current.word;

  // ─── Result text (game over) ──────────────────────────────────────────────────
  let resultText = 'Full rounds — tie game.';
  const isOnlineLoss = onlineMySlot !== null && onlineMySlot === onlineLoserSlot;
  if (gameMode === 'online') {
    if (onlineEndReason === 'timeout') { resultText = isOnlineLoss ? "Time's up. You lose." : 'Opponent timed out. You win!'; }
    else if (onlineEndReason === 'too_close') { resultText = isOnlineLoss ? '3 strikes, too close. You lose.' : 'Opponent hit 3 strikes. You win!'; }
    else resultText = 'Full rounds — tie game.';
  } else if (gameEndedByTimeout) {
    resultText = gameMode === 'pvp' ? `Time's up! ${currentPlayer === 1 ? p2Name : p1Name} wins!` : "Time's up. You lose.";
  } else if (gameEndedTooClose) {
    if (gameMode === 'pvp') { const w = tooCloseLoserPlayer === 1 ? p2Name : p1Name; const l = tooCloseLoserPlayer === 1 ? p1Name : p2Name; resultText = `${l} hit 3 strikes. ${w} wins!`; }
    else { resultText = tooCloseLoserIsUser ? '3 strikes, too close. You lose.' : 'Computer hit 3 strikes. You win!'; }
  }

  const isLoss = isOnlineLoss || gameEndedByTimeout || (gameEndedTooClose && tooCloseLoserIsUser);

  // pvcResult drives the "Beat the AI" CTA on the game-over screen
  let pvcResult = null;
  if (gameMode === 'pvc') {
    if (gameEndedByTimeout) pvcResult = 'loss';
    else if (gameEndedTooClose) pvcResult = tooCloseLoserIsUser ? 'loss' : 'win';
    else pvcResult = 'tie';
  }

  const analysisRows = history.filter(i => i.distance !== null);

  // ─── Share summary ────────────────────────────────────────────────────────────
  const buildShareSummary = useCallback(() => {
    const s = S.current;
    const modeLabel = s.gameMode === 'online' ? 'Online room' : s.gameMode === 'pvp' ? 'Pass & Play' : 'VS Computer';
    const moves = s.history.filter(i => i.distance !== null && i.moveResult !== 'STRIKE');
    const lines = [
      `ELSEWHERE — ${modeLabel}`,
      `Round: ${s.currentRound}/${s.maxRounds}`,
      `${s.p1Name}: ${Number(s.userScore).toFixed(2)}  |  ${s.p2Name}: ${Number(s.computerScore).toFixed(2)}`,
      resultText,
      `Valid moves: ${moves.length}`,
    ];
    return lines.join('\n');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultText]);

  const copyToClipboard = useCallback(async () => {
    try { await navigator.clipboard.writeText(shareText); setCopyStatus('Copied!'); setTimeout(() => setCopyStatus(''), 1800); }
    catch { setCopyStatus('Copy failed'); }
  }, [shareText]);

  const toggleSharePanel = useCallback(() => {
    setShareText(buildShareSummary());
    setShowSharePanel(s => !s);
  }, [buildShareSummary]);

  // ─── Floating badge turn label ────────────────────────────────────────────────
  const turnLabel = gameMode === 'pvp'
    ? `${currentPlayer === 1 ? p1Name : p2Name}'s Turn`
    : isUserTurn ? 'Your Turn' : `${p2Name}'s Turn`;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-mesh"
      style={{ color: 'var(--text-strong)', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Overlays ── */}
      <AnimatePresence>
        {showIntro && <IntroOverlay onClose={() => { setIntroSeen(); setShowIntro(false); }} />}
        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
        {showRematchModal && (
          <RematchModal
            onAccept={() => { setShowRematchModal(false); requestRematch(true); }}
            onDecline={() => { setShowRematchModal(false); requestRematch(false); }}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════ LANDING SCREEN ═══════════════════════════════ */}
      <AnimatePresence>
        {screen === 'landing' && (
          <motion.div key="landing" className="fixed inset-0 z-10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}>
            <LandingScreen
              onPlay={() => setScreen('menu')}
              onHowToPlay={() => setShowHowToPlay(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════ MENU SCREEN ══════════════════════════════════ */}
      <AnimatePresence mode="wait">
      {screen === 'menu' && (
        <motion.div key="menu" className="fixed inset-0 z-10 h-full"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}>
          <MenuScreen
            onBack={() => setScreen('landing')}
            onHowToPlay={() => setShowHowToPlay(true)}
            onStartPvc={startPvcFlow}
            onStartPvp={startPvpFlow}
            onStartOnline={startOnlineFlow}
          />
        </motion.div>
      )}
      </AnimatePresence>

      {/* ══════════════════════════ GAME SCREEN ══════════════════════════════════ */}
      <AnimatePresence mode="wait">
      {screen === 'game' && (
        <motion.div key="game"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full flex items-stretch md:items-center justify-center px-0 md:px-3 overflow-hidden">
          <div className="w-full max-w-none md:max-w-[1024px] xl:max-w-[1280px] mx-auto glass border-0 md:border rounded-none md:rounded-2xl h-full md:h-[calc(100dvh-1.25rem)] flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>

            {/* Header */}
            <div className="h-14 shrink-0 border-b grid items-center px-3"
              style={{ borderColor: 'var(--border)', gridTemplateColumns: '48px 1fr' }}>
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}
                onClick={() => { resetGame(); setScreen('menu'); }}>←</motion.button>
              <h1 className="text-center text-lg sm:text-2xl leading-none game-title">ELSEWHERE</h1>
            </div>

            {/* Single AnimatePresence for the three game phases — guarantees only one
                phase is ever mounted at a time (fixes the old lobby/active/over overlap bug). */}
            <AnimatePresence mode="wait">
              {(gamePhase === 'intro' || gamePhase === 'waiting') && (
                <GameLobby
                  key="lobby"
                  gameMode={gameMode}
                  gamePhase={gamePhase}
                  turnTimeLimit={turnTimeLimit}
                  setTurnTimeLimit={setTurnTimeLimit}
                  maxRounds={maxRounds}
                  setMaxRounds={setMaxRounds}
                  onStartGame={startGame}
                  onlineStandardRounds={ONLINE_STANDARD_ROUNDS}
                  onlineStandardTurnSeconds={ONLINE_STANDARD_TURN_SECONDS}
                  onlineSessionError={onlineSessionError}
                  onlineLobbyError={onlineLobbyError}
                  onlineNameInput={onlineNameInput}
                  setOnlineNameInput={setOnlineNameInput}
                  onlineMaxPlayers={onlineMaxPlayers}
                  setOnlineMaxPlayers={setOnlineMaxPlayers}
                  onCreateRoom={createRoom}
                  onlineJoinCodeInput={onlineJoinCodeInput}
                  setOnlineJoinCodeInput={setOnlineJoinCodeInput}
                  onJoinRoom={joinRoomWithCode}
                  onlinePlayers={onlinePlayers}
                  waitingStatus={waitingStatus}
                  canStartRoom={canStartRoom}
                  onStartOnlineRoom={startOnlineRoom}
                  isHostPlayer={isHostPlayer}
                  hostJoinUrl={hostJoinUrl}
                  onlineCode={onlineCode}
                />
              )}
              {gamePhase === 'active' && (
                <GameBoard
                  key="active"
                  gameMode={gameMode}
                  isUserTurn={isUserTurn}
                  activeIsP1={activeIsP1}
                  turnLabel={turnLabel}
                  timeRemaining={timeRemaining}
                  turnTimeLimit={turnTimeLimit}
                  timerUrgent={timerUrgent}
                  submitting={submitting}
                  hintsStep={hintsStep}
                  onBumpHint={() => bumpHint()}
                  moveNumber={moveNumber}
                  currentRound={currentRound}
                  maxRounds={maxRounds}
                  p1Tier={p1Tier}
                  p2Tier={p2Tier}
                  p1Name={p1Name}
                  p2Name={p2Name}
                  userScore={userScore}
                  computerScore={computerScore}
                  strikesP1={strikesP1}
                  strikesP2={strikesP2}
                  strikeLimit={STRIKE_LIMIT}
                  wordInputRef={wordInputRef}
                  wordInput={wordInput}
                  setWordInput={setWordInput}
                  displayUserWord={displayUserWord}
                  displayOppWord={displayOppWord}
                  p1ScoreRef={p1ScoreRef}
                  p2ScoreRef={p2ScoreRef}
                  safetyTier={safetyTier}
                  onSubmitWord={submitWord}
                  errorMsg={errorMsg}
                  hitMsg={hitMsg}
                  comboCount={comboCount}
                  premoveWord={premoveWord}
                  premoveInput={premoveInput}
                  setPremoveInput={setPremoveInput}
                  onQueuePremove={queuePremove}
                  onClearPremove={clearPremove}
                  history={history}
                />
              )}
              {gamePhase === 'over' && (
                <GameOver
                  key="over"
                  isLoss={isLoss}
                  resultText={resultText}
                  p1Name={p1Name}
                  p2Name={p2Name}
                  userScore={userScore}
                  computerScore={computerScore}
                  strikesP1={strikesP1}
                  strikesP2={strikesP2}
                  strikeLimit={STRIKE_LIMIT}
                  gameMode={gameMode}
                  onlineCode={onlineCode}
                  onlineToken={onlineToken}
                  onPlayAgain={resetGame}
                  onRematch={() => requestRematch(true)}
                  onLeave={resetGame}
                  showSharePanel={showSharePanel}
                  onToggleShare={toggleSharePanel}
                  shareText={shareText}
                  copyStatus={copyStatus}
                  onCopy={copyToClipboard}
                  analysisRows={analysisRows}
                  rematchStatus={rematchStatus}
                  pvcResult={pvcResult}
                />
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
