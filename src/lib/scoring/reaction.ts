export const MIN_REACTION_MS = 120;
export const MAX_REACTION_MS = 5000;

export function isValidReactionMs(value: number) {
  return Number.isFinite(value) && value >= MIN_REACTION_MS && value <= MAX_REACTION_MS;
}

export function reactionMsToLeaderboardScore(value: number) {
  const reactionMs = Math.round(value);

  return Math.max(1, 1200 - reactionMs);
}

export function isValidReactionTime(value: number) {
  return isValidReactionMs(value);
}

export function calculateReactionScore(value: number) {
  return reactionMsToLeaderboardScore(value);
}