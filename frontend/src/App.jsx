import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IntroOverlay from './components/IntroOverlay.jsx';
import HowToPlayModal from './components/HowToPlayModal.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import RematchModal from './components/RematchModal.jsx';
import WordHistory from './components/WordHistory.jsx';
import CircularTimer from './components/CircularTimer.jsx';
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

function cardCls(tier, isActive) {
  let c = 'rounded-sm border px-2 py-1.5 transition-all duration-300';
  if (isActive) c += ' active-turn';
  if (tier === 'good') c += ' tier-good';
  else if (tier === 'mid') c += ' tier-mid';
  else if (tier === 'bad') c += ' tier-bad';
  return c;
}

function onlineHistorySlot(player) {
  if (player === 'host') return 0;
  if (player === 'guest') return 1;
  if (typeof player === 'number') return player;
  const n = parseInt(player, 10);
  return Number.isNaN(n) ? null : n;
}

function hintMessage(step, gameMode, isUserTurn, moveNumber) {
  if (step === 2) return "Green = safe jump. Yellow = risky. Three too-close fouls and you're out. Aim for green.";
  if (step === 1) {
    if (gameMode === 'online') return "Wait for your opponent, then jump far when it's your turn. Cross categories: object → emotion → place.";
    return "Good! Now jump as far as possible. Cross categories: object → emotion → place.";
  }
  if (gameMode === 'pvp') return "Player 1: type any English word. It becomes the anchor for this round.";
  if (gameMode === 'online' && !isUserTurn && moveNumber === 0) return "Wait for your opponent. You'll take turns jumping far from each word.";
  return "Type any English word. It becomes the anchor for this round.";
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
  // Theme: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('elsewhere_theme') || 'dark'; } catch { return 'dark'; }
  });
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('elsewhere_theme', next); } catch {}
      return next;
    });
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Screen / phase: 'landing' | 'menu' | 'game'
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

  // Menu UI
  const [showPvpSetup, setShowPvpSetup] = useState(false);
  const [pvpName1, setPvpName1] = useState('');
  const [pvpName2, setPvpName2] = useState('');
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

  // ─── Premove queue ────────────────────────────────────────────────────────────
  const queuePremove = useCallback(() => {
    const w = premoveInput.trim().toLowerCase();
    if (!w) { setErrorMsg('Enter a word to queue.'); return; }
    setErrorMsg('');
    setPremoveWord(w);
  }, [premoveInput]);

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
  let resultColor = '#4f3c2f';
  const isOnlineLoss = onlineMySlot !== null && onlineMySlot === onlineLoserSlot;
  if (gameMode === 'online') {
    if (onlineEndReason === 'timeout') { resultText = isOnlineLoss ? "Time's up. You lose." : 'Opponent timed out. You win!'; resultColor = isOnlineLoss ? '#b35b4a' : '#6f8d62'; }
    else if (onlineEndReason === 'too_close') { resultText = isOnlineLoss ? '3 strikes, too close. You lose.' : 'Opponent hit 3 strikes. You win!'; resultColor = isOnlineLoss ? '#b35b4a' : '#6f8d62'; }
    else resultText = 'Full rounds — tie game.';
  } else if (gameEndedByTimeout) {
    resultText = gameMode === 'pvp' ? `Time's up! ${currentPlayer === 1 ? p2Name : p1Name} wins!` : "Time's up. You lose.";
    resultColor = '#b35b4a';
  } else if (gameEndedTooClose) {
    resultColor = '#b35b4a';
    if (gameMode === 'pvp') { const w = tooCloseLoserPlayer === 1 ? p2Name : p1Name; const l = tooCloseLoserPlayer === 1 ? p1Name : p2Name; resultText = `${l} hit 3 strikes. ${w} wins!`; }
    else { resultText = tooCloseLoserIsUser ? '3 strikes, too close. You lose.' : 'Computer hit 3 strikes. You win!'; if (!tooCloseLoserIsUser) resultColor = '#6f8d62'; }
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
              theme={theme}
              onToggleTheme={toggleTheme}
              onPlay={() => setScreen('menu')}
              onHowToPlay={() => setShowHowToPlay(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════ MENU SCREEN ══════════════════════════════════ */}
      <AnimatePresence mode="wait">
      {screen === 'menu' && (
        <motion.div key="menu"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="h-full flex items-center justify-center px-4 py-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px] text-center glass rounded-2xl p-6 sm:p-8"
            style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' }}>

            {/* Menu top-bar: back + theme */}
            <div className="flex items-center justify-between mb-5">
              <button type="button" onClick={() => setScreen('landing')}
                className="text-xs btn-ghost rounded-lg px-3 h-8"
                style={{ letterSpacing: '0.04em' }}>← Back</button>
              <button type="button" onClick={toggleTheme}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 14 }}
                title="Toggle theme">
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>◈</span>
              </div>
              <h1 className="leading-none tracking-[0.1em]"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  color: 'var(--text-strong)',
                  fontSize: 'clamp(2rem, 11vw, 3rem)',
                }}>
                ELSEWHERE
              </h1>
              <p className="text-[10px] sm:text-[11px] mt-3 tracking-[0.18em] uppercase" style={{ color: 'var(--text-muted)' }}>
                Stay far from the last word
              </p>
              <p className="text-[10px] sm:text-[11px] mt-1 tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                Three too-close fouls and you're out
              </p>
            </motion.div>

            <motion.div className="mt-8 space-y-2.5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.45 }}>
              {[
                { label: 'Pass & Play', action: () => setShowPvpSetup(s => !s), primary: true },
                { label: 'VS Computer', action: () => { setShowPvpSetup(false); setGameMode('pvc'); setP1Name('You'); setP2Name('Computer'); setScreen('game'); setTimeout(() => startGame(), 50); }, primary: true },
                { label: 'Online Room', action: () => { setShowPvpSetup(false); setGameMode('online'); setOnlineLobbyError(''); setOnlineSessionError(''); setScreen('game'); setGamePhase('intro'); }, primary: false },
              ].map((btn, i) => (
                <motion.button key={btn.label}
                  whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}
                  className={`w-full h-12 rounded-xl font-semibold tracking-[0.05em] text-sm transition ${btn.primary ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={btn.action}>
                  {btn.label}
                </motion.button>
              ))}
            </motion.div>

            {/* PvP setup panel */}
            <AnimatePresence>
            {showPvpSetup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden">
                <div className="mt-3 glass-raised rounded-xl p-4 text-left">
                  <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Pass &amp; Play setup</p>
                  {['Player 1', 'Player 2'].map((label, i) => (
                    <div key={label} className={i === 0 ? 'mb-3' : ''}>
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text-body)' }}>{label} name</label>
                      <input type="text" maxLength={12} placeholder={label}
                        value={i === 0 ? pvpName1 : pvpName2}
                        onChange={e => i === 0 ? setPvpName1(e.target.value) : setPvpName2(e.target.value)}
                        className="form-input" />
                    </div>
                  ))}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" className="h-10 rounded-lg btn-ghost text-sm"
                      onClick={() => setShowPvpSetup(false)}>Cancel</button>
                    <motion.button type="button" whileTap={{ scale: 0.97 }}
                      className="h-10 rounded-lg btn-primary text-sm"
                      onClick={() => {
                        const n1 = pvpName1.trim() || 'Player 1';
                        const n2 = pvpName2.trim() || 'Player 2';
                        setP1Name(n1); setP2Name(n2); setGameMode('pvp');
                        setShowPvpSetup(false); setScreen('game'); setTimeout(() => startGame(), 50);
                      }}>Start</motion.button>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            <button type="button" className="mt-5 text-xs tracking-[0.1em] underline underline-offset-4 transition"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowHowToPlay(true)}>How to play</button>
          </motion.div>
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
            style={{ borderColor: 'var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

            {/* Header */}
            <div className="h-14 shrink-0 border-b grid items-center px-3"
              style={{ borderColor: 'var(--border)', gridTemplateColumns: '48px 1fr 48px' }}>
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}
                onClick={() => { resetGame(); setScreen('menu'); }}>←</motion.button>
              <h1 className="text-center text-[22px] sm:text-[34px] tracking-[0.12em] leading-none"
                style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--text-strong)' }}>ELSEWHERE</h1>
              <button type="button" onClick={toggleTheme}
                className="w-9 h-9 rounded-lg flex items-center justify-center ml-auto"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', fontSize: 14 }}
                title="Toggle theme">
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>

            {/* ── INTRO / SETTINGS / LOBBY PHASE ── */}
            <AnimatePresence mode="wait">
            {(gamePhase === 'intro' || gamePhase === 'waiting') && (
              <motion.div key="lobby"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col justify-center">

                {/* Local mode settings */}
                {gameMode !== 'online' && (
                  <div className="max-w-[420px]">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="h-11 px-6 rounded-xl btn-primary text-sm font-semibold"
                      onClick={startGame}>Start game →</motion.button>
                    <p className="mt-4 text-sm" style={{ color: 'var(--text-body)' }}>
                      <strong style={{ color: 'var(--text-strong)' }}>{maxRounds} rounds</strong> · <strong style={{ color: 'var(--text-strong)' }}>{turnTimeLimit}s</strong> per turn
                    </p>
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
                  </div>
                )}

                {/* Online lobby (create / join) */}
                {gameMode === 'online' && gamePhase === 'intro' && (
                  <div className="max-w-[420px]">
                    <p className="text-sm mb-5" style={{ color: 'var(--text-body)' }}>
                      2–4 players · {ONLINE_STANDARD_ROUNDS} rounds · {ONLINE_STANDARD_TURN_SECONDS}s per turn
                    </p>
                    {onlineSessionError && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-3 text-sm px-3 py-2 rounded-lg"
                        style={{ color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid rgba(248,113,113,0.2)' }}>
                        {onlineSessionError}
                      </motion.p>
                    )}
                    <div className="glass-raised rounded-xl p-4 space-y-3">
                      {onlineLobbyError && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="text-sm px-3 py-2 rounded-lg"
                          style={{ color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid rgba(248,113,113,0.2)' }}>
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
                        onClick={createRoom}>Create room</motion.button>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        <span className="text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-muted)' }}>or join</span>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      </div>
                      <div className="flex gap-2">
                        <input type="text" maxLength={8} autoComplete="off" spellCheck="false"
                          placeholder="Room code" value={onlineJoinCodeInput}
                          onChange={e => {
                            const v = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                            setOnlineJoinCodeInput(v);
                            if (v.length === 6 || v.length === 8) joinRoomWithCode(v);
                          }}
                          className="form-input flex-1 uppercase tracking-widest" />
                        <motion.button whileTap={{ scale: 0.96 }}
                          className="px-4 h-10 rounded-lg btn-ghost text-sm shrink-0"
                          onClick={() => joinRoomWithCode(onlineJoinCodeInput)}>Join</motion.button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Online waiting lobby */}
                {gameMode === 'online' && gamePhase === 'waiting' && (
                  <div className="glass-raised rounded-xl p-4 max-w-[420px]">
                    <p className="text-[10px] tracking-[0.18em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>Waiting to start</p>
                    <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: 'var(--text-muted)' }}>Players in room</p>
                      <ul className="space-y-1.5">
                        {onlinePlayers.map((p, i) => (
                          <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                            className="text-sm flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                              style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-strong)' }}>{i + 1}</span>
                            {p.name || '–'}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{waitingStatus}</p>
                    {canStartRoom && (
                      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                        className="w-full h-10 mb-3 rounded-lg btn-primary text-sm font-semibold"
                        onClick={startOnlineRoom}>Start game</motion.button>
                    )}
                    {isHostPlayer && hostJoinUrl && (
                      <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
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
                )}
              </motion.div>
            )}
            </AnimatePresence>

            {/* ── ACTIVE GAME ── */}
            <AnimatePresence mode="wait">
            {gamePhase === 'active' && (
              <motion.div key="active"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 p-2 sm:p-3 border-t overflow-hidden min-h-0 flex"
                style={{ borderColor: 'var(--border)' }}>
                <main className="flex-1 rounded-xl p-3 sm:p-4 overflow-hidden min-h-0 flex flex-col glass-raised"
                  style={{ borderColor: 'var(--border)' }}>

                  {/* Top bar: turn indicator + timer */}
                  <div className="shrink-0 flex items-center justify-between mb-2">
                    {/* Turn badge */}
                    <AnimatePresence mode="wait">
                      <motion.div key={turnLabel}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.22 }}
                        className="flex flex-col">
                        <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: 'var(--text-muted)' }}>Now playing</span>
                        <span className="text-sm sm:text-base font-bold tracking-[0.06em]"
                          style={{ color: isUserTurn || !isUserTurn ? 'var(--text-strong)' : 'var(--text-body)' }}>
                          {turnLabel}
                        </span>
                      </motion.div>
                    </AnimatePresence>

                    {/* Circular timer */}
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
                        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                        <p className="flex-1 text-xs leading-snug" style={{ color: 'var(--text-body)' }}>
                          {hintMessage(hintsStep, gameMode, isUserTurn, moveNumber)}
                        </p>
                        <button type="button" className="shrink-0 text-base leading-none"
                          style={{ color: 'var(--text-muted)' }} onClick={() => bumpHint()}>×</button>
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>

                  {/* Round progress */}
                  <div className="shrink-0 mb-3">
                    <div className="flex justify-between text-[9px] uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--text-muted)' }}>
                      <span>Match progress</span><span>Round {currentRound}/{maxRounds}</span>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, var(--good), var(--mid))' }}
                        animate={{ width: `${Math.min(100, (currentRound / maxRounds) * 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }} />
                    </div>
                  </div>

                  {/* Word cards */}
                  <div className="shrink-0 grid grid-cols-2 gap-2 rounded-xl p-2"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>

                    {/* P1 card */}
                    <motion.div layout
                      className={`word-card-shell px-2.5 py-2 ${cardCls(p1Tier, activeIsP1)}`}
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <div className="flex items-start justify-between text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        <span>{p1Name}</span>
                        <span className="text-right">
                          <span ref={p1ScoreRef} className="block text-[11px]" style={{ color: 'var(--text-strong)' }}>{userScore.toFixed(2)}</span>
                          <span className="font-normal normal-case tracking-normal">
                            {Array.from({ length: STRIKE_LIMIT }).map((_, i) => (
                              <span key={i} style={{ color: i < strikesP1 ? 'var(--bad)' : 'rgba(255,255,255,0.15)', marginLeft: 1 }}>✕</span>
                            ))}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 min-h-[2.75rem] flex items-center justify-center">
                        {(activeIsP1 && (gameMode !== 'online' || isUserTurn) && !submitting) ? (
                          <input id="word-input-main" ref={wordInputRef} type="text" autoComplete="off"
                            inputMode="text" enterKeyHint="done" maxLength={24}
                            placeholder="Type a word…" value={wordInput}
                            onChange={e => setWordInput(e.target.value)}
                            className="word-card-input" />
                        ) : (
                          <AnimatePresence mode="wait">
                            <motion.p key={displayUserWord}
                              initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="text-center leading-tight break-all w-full"
                              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.3rem,5vw,2.1rem)', color: 'var(--text-strong)' }}>
                              {displayUserWord}
                            </motion.p>
                          </AnimatePresence>
                        )}
                      </div>
                    </motion.div>

                    {/* P2 card */}
                    <motion.div layout
                      className={`word-card-shell px-2.5 py-2 ${cardCls(p2Tier, !activeIsP1)}`}
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                      <div className="flex items-start justify-between text-[9px] uppercase tracking-[0.1em] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        <span>{p2Name}</span>
                        <span className="text-right">
                          <span ref={p2ScoreRef} className="block text-[11px]" style={{ color: 'var(--text-strong)' }}>{computerScore.toFixed(2)}</span>
                          <span className="font-normal normal-case tracking-normal">
                            {Array.from({ length: STRIKE_LIMIT }).map((_, i) => (
                              <span key={i} style={{ color: i < strikesP2 ? 'var(--bad)' : 'rgba(255,255,255,0.15)', marginLeft: 1 }}>✕</span>
                            ))}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 min-h-[2.75rem] flex items-center justify-center">
                        {(gameMode === 'pvp' && !activeIsP1) ? (
                          <input id="word-input-main" ref={wordInputRef} type="text" autoComplete="off"
                            inputMode="text" enterKeyHint="done" maxLength={24}
                            placeholder={`${p2Name}, type…`} value={wordInput}
                            onChange={e => setWordInput(e.target.value)}
                            className="word-card-input" />
                        ) : (
                          <AnimatePresence mode="wait">
                            <motion.p key={displayOppWord}
                              initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="text-center leading-tight break-all w-full"
                              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.3rem,5vw,2.1rem)', color: 'var(--text-strong)' }}>
                              {displayOppWord}
                            </motion.p>
                          </AnimatePresence>
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
                      disabled={submitting} onClick={submitWord}>
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="timer-wait-dots visible" style={{ height: '1em' }}>
                            <span className="timer-wait-dot" /><span className="timer-wait-dot" /><span className="timer-wait-dot" />
                          </span>
                          Sending
                        </span>
                      ) : 'Submit →'}
                    </motion.button>
                  </div>

                  {/* Premove panel */}
                  <AnimatePresence>
                  {(gameMode === 'online' || gameMode === 'pvc') && !isUserTurn && !submitting && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="shrink-0 mt-2 rounded-xl border border-dashed px-3 py-2.5"
                      style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] uppercase tracking-[0.16em] font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>Premove</span>
                        <input id="premove-input" type="text" maxLength={24} autoComplete="off"
                          inputMode="text" enterKeyHint="go"
                          placeholder="Queue your next word"
                          value={premoveInput} onChange={e => setPremoveInput(e.target.value)}
                          className="premove-input flex-1 min-w-[120px]" />
                        <motion.button type="button" whileTap={{ scale: 0.95 }}
                          className="h-8 px-3 rounded-lg btn-primary text-xs font-semibold shrink-0"
                          onClick={queuePremove}>Queue</motion.button>
                        <button type="button" className="h-8 px-3 rounded-lg btn-ghost text-xs shrink-0"
                          onClick={() => { setPremoveWord(null); setPremoveInput(''); }}>Clear</button>
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
            )}
            </AnimatePresence>

            {/* ── GAME OVER ── */}
            <AnimatePresence mode="wait">
            {gamePhase === 'over' && (
              <motion.div key="over"
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
                    className="text-2xl sm:text-3xl tracking-[0.04em] text-center"
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      color: isOnlineLoss || gameEndedByTimeout || (gameEndedTooClose && tooCloseLoserIsUser) ? 'var(--bad)' : 'var(--good)'
                    }}>
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
                        <p className="text-3xl font-light" style={{ color: 'var(--text-strong)', fontFamily: "'Cormorant Garamond', serif" }}>
                          {Number(score).toFixed(2)}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: strikes >= STRIKE_LIMIT ? 'var(--bad)' : 'var(--text-muted)' }}>
                          {strikes}/{STRIKE_LIMIT} strikes
                        </p>
                      </div>
                    ))}
                  </motion.div>

                  {/* Action buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="mt-4 flex gap-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 h-10 rounded-xl btn-primary text-sm font-semibold"
                      onClick={() => {
                        if (gameMode === 'online' && onlineCode && onlineToken) requestRematch(true);
                        else { resetGame(); }
                      }}>
                      {gameMode === 'online' ? 'Rematch' : 'Play again'}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      type="button" className="flex-1 h-10 rounded-xl btn-ghost text-sm"
                      onClick={() => { setShareText(buildShareSummary()); setShowSharePanel(s => !s); }}>
                      Share
                    </motion.button>
                    {gameMode === 'online' && (
                      <motion.button whileTap={{ scale: 0.97 }}
                        type="button" className="flex-1 h-10 rounded-xl btn-ghost text-sm"
                        onClick={() => { resetGame(); }}>
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
                          style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-body)', border: '1px solid var(--border)' }}
                          value={shareText} />
                        <div className="mt-2 flex items-center gap-2">
                          <motion.button whileTap={{ scale: 0.96 }}
                            type="button" className="h-8 px-3 rounded-lg btn-primary text-xs font-medium"
                            onClick={copyToClipboard}>Copy</motion.button>
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
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        Move analysis
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}>
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
            )}
            </AnimatePresence>

          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
