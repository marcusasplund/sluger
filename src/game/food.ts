export const LETTUCE = [
  {x:-4.7,z:4.3},{x:4.6,z:5.8},{x:-4.5,z:-1},{x:4.4,z:-1},
];
export const FOOD = {
  lily: { name:'lily', seconds:1.15, moisture:9, points:100 },
  lettuce: { name:'lettuce', seconds:.65, moisture:24, points:40 },
};
export const FULL_MEAL = 3;
export const fullness = (lilies:number,lettuce:number) => Math.min(100,Math.round((lilies+lettuce)/FULL_MEAL*100));
export const canGoHome = (lilies:number,lettuce:number) => lilies+lettuce>=FULL_MEAL;
