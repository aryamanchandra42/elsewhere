// Pure presentational helpers shared by game-phase components (no state, no side effects).

export function panelCls(tier, isActive) {
  let c = 'player-panel px-3 py-3 transition-all duration-300';
  if (isActive) c += ' active-turn';
  if (tier === 'good') c += ' tier-good';
  else if (tier === 'mid') c += ' tier-mid';
  else if (tier === 'bad') c += ' tier-bad';
  return c;
}

export function hintMessage(step, gameMode, isUserTurn, moveNumber) {
  if (step === 2) return "Green = safe jump. Yellow = risky. Three too-close fouls and you're out. Aim for green.";
  if (step === 1) {
    if (gameMode === 'online') return "Wait for your opponent, then jump far when it's your turn. Cross categories: object → emotion → place.";
    return "Good! Now jump as far as possible. Cross categories: object → emotion → place.";
  }
  if (gameMode === 'pvp') return "Player 1: type any English word. It becomes the anchor for this round.";
  if (gameMode === 'online' && !isUserTurn && moveNumber === 0) return "Wait for your opponent. You'll take turns jumping far from each word.";
  return "Type any English word. It becomes the anchor for this round.";
}
