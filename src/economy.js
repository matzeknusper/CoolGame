// Coin rewards (shared by the game and the balance tool).
export function levelReward(n, collected, stars, won, firstTime) {
  if (!won) return Math.round(collected * 0.6);
  const bonus = (25 + n * 5) * (1 + 0.2 * Math.max(0, stars - 1));
  return Math.round(collected + bonus * (firstTime ? 1 : 0.5));
}
