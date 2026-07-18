// In dev, VITE_API_BASE is empty so Vite's proxy forwards /api → localhost:5000.
// In production, set VITE_API_BASE=https://your-app.onrender.com in Vercel env vars.
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const post = (url, body) =>
  fetch(BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export async function evaluateDistance(word1, word2, history, moveNumber) {
  const r = await post('/api/distance', { word1, word2, history, move_number: moveNumber });
  return r.json();
}

export async function validateAnchor(word) {
  const r = await post('/api/anchor', { word });
  return { ok: r.ok, data: await r.json() };
}

export async function getComputerMove(word, history, moveNumber) {
  const r = await post('/api/computer-move', { word, history, move_number: moveNumber });
  return r.json();
}

export async function getBestMove(anchor, history, moveNumber) {
  const r = await post('/api/distance/best-move', { anchor, history, move_number: moveNumber });
  return r.json();
}

export async function createRoom(name, maxRounds, turnTimeLimit, maxPlayers) {
  const r = await post('/api/rooms', { name, max_rounds: maxRounds, turn_time_limit: turnTimeLimit, max_players: maxPlayers });
  return { ok: r.ok, data: await r.json() };
}

export async function joinRoom(code, name) {
  const r = await post('/api/rooms/join', { code, name });
  return { ok: r.ok, data: await r.json() };
}

export async function startRoom(code, token) {
  const r = await post(`/api/rooms/${code}/start`, { token });
  return { ok: r.ok, data: await r.json() };
}

export async function getRoom(code, token) {
  const r = await fetch(`${BASE}/api/rooms/${code}?token=${encodeURIComponent(token)}`);
  return { ok: r.ok, status: r.status, data: await r.json() };
}

export async function submitMove(code, token, word) {
  const r = await post(`/api/rooms/${code}/move`, { token, word });
  return { ok: r.ok, data: await r.json() };
}

export async function submitTimeout(code, token) {
  const r = await post(`/api/rooms/${code}/timeout`, { token });
  return { ok: r.ok, data: await r.json() };
}

export async function submitRematch(code, token, accept) {
  const r = await post(`/api/rooms/${code}/rematch`, { token, accept });
  return { ok: r.ok, data: await r.json() };
}
