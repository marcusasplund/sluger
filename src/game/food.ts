export const LETTUCE = [
  {x:-4.7,z:4.3},{x:4.6,z:5.8},{x:-4.5,z:-1},{x:4.4,z:-1},
];
export const FOOD = {
  lily: { name:'lily', seconds:1.15, moisture:9, points:100 },
  lettuce: { name:'lettuce', seconds:.65, moisture:24, points:40 },
};
export const FULL_MEAL = 3;
// Two shared provisions per hatched clutch, capped so old saves remain playable.
export const requiredMeals = (hatchedClutches=0) => FULL_MEAL + Math.min(4, Math.max(0, Math.floor(hatchedClutches))*2);
export const fullness = (lilies:number,lettuce:number,hatchedClutches=0) => Math.min(100,Math.round((lilies+lettuce)/requiredMeals(hatchedClutches)*100));
export const canGoHome = (lilies:number,lettuce:number,hatchedClutches=0) => lilies+lettuce>=requiredMeals(hatchedClutches);
