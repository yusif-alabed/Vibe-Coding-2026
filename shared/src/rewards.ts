/** Coin rewards for minigames. Calculated only on the server from server-simulated results. */

export const PARTICIPATION_COINS = 10;
/** Bonus by finishing place (1st, 2nd, 3rd, ...). */
export const PLACE_BONUS = [40, 25, 15, 5, 0, 0, 0, 0];

export interface RaceOutcome {
  place: number; // 1-based
  finished: boolean;
  racers: number; // total racers including bots
}

export function coinsForRace(o: RaceOutcome): number {
  if (o.place < 1 || o.racers < 1 || o.place > o.racers) return 0;
  const bonus = o.finished ? PLACE_BONUS[o.place - 1] ?? 0 : 0;
  return PARTICIPATION_COINS + bonus;
}
