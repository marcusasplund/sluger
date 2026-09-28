export const MIN_MEAL = 3;
export const STRIKE_IMPACT = 0.58;
export const STRIKE_DURATION = 1.25;

export function raidReward(lilies: number, health: number, lettuce = 0, challenge = 0) {
  const rank = lilies >= 8 ? 'Garden legend' : lilies >= 6 ? 'A bold feast' : lilies >= 4 ? 'A good haul' : 'A narrow escape';
  const food = lilies * 100 + lettuce * 40;
  const bonus = Math.round(Math.max(0, lilies + lettuce * .4 - MIN_MEAL) ** 2 * 25);
  const survival = Math.round(health) * 2;
  return { rank, food, bonus, survival, challenge, total: food + bonus + survival + challenge };
}
