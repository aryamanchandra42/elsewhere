// Shared game-mode metadata used by MenuScreen, LandingScreen, HowToPlayModal, and IntroOverlay.
// No emoji fields — modes are represented with letter tiles to match the word-game design system.
export const MODES = [
  {
    id: 'pvc',
    tileLetter: 'C',
    title: 'VS Computer',
    tag: 'Solo',
    body: 'Play against an AI opponent that can earn strikes just like you can.',
    cta: 'Play solo',
    tone: 'good',
  },
  {
    id: 'pvp',
    tileLetter: 'P',
    title: 'Pass & Play',
    tag: 'Local',
    body: 'Two players, one device. Hand the screen between turns — no account needed.',
    cta: 'Play local',
    tone: 'good',
  },
  {
    id: 'online',
    tileLetter: 'O',
    title: 'Online Room',
    tag: 'Multiplayer',
    body: 'Create a private room and invite friends via a link or 6-digit code. 15 rounds · 10 s each.',
    cta: 'Play online',
    tone: 'mid',
  },
];
