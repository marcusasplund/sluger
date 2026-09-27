import { test, expect } from "@playwright/test";
import { move, visible, survival, covered } from "../src/game/rules";

test("collision pushes the slug outside obstacles, including an exact centre overlap", () => {
  const obstacle = { x: 0, z: 0, radius: 1 };
  const p = move({ x: 0, z: 0 }, 0, 0, [obstacle]);
  expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.24);
  expect(move({ x: 10, z: 0 }, 10, 0, []).x).toBe(10.7);
});
test("vision accounts for facing, distance, leaf cover and solid obstacles", () => {
  const eye = { x: 0, z: 0 };
  expect(visible(eye, 0, { x: 0, z: 4 }, false, [])).toBe(true);
  expect(visible(eye, 0, { x: 0, z: -4 }, false, [])).toBe(false);
  expect(visible(eye, 0, { x: 0, z: 4 }, true, [])).toBe(false);
  expect(
    visible(eye, 0, { x: 0, z: 4 }, false, [{ x: 0, z: 2, radius: 0.6 }]),
  ).toBe(false);
  expect(covered({ x: 4, z: 1 })).toBe(true);
  expect(covered({ x: 0, z: 1 })).toBe(false);
});
test("water restores moisture; sprinting spends it; salt and dehydration damage life", () => {
  expect(survival(95, 99, 1, true, false, false)).toEqual({
    moisture: 100,
    health: 100,
  });
  expect(survival(10, 100, 1, false, true, false).moisture).toBe(6);
  expect(survival(100, 100, 1, false, false, true).health).toBe(72);
  expect(survival(0, 5, 1, false, false, false).health).toBe(0);
});

test("bringing home extra food increases the raid reward", async () => {
  const { raidReward, MIN_MEAL } = await import('../src/game/raid');
  expect(MIN_MEAL).toBe(3);
  expect(raidReward(3,100).bonus).toBe(0);
  expect(raidReward(8,100).total).toBeGreaterThan(raidReward(3,100).total);
  expect(raidReward(8,100).rank).toBe('Garden legend');
});

test("short lawn provides no cover and mower collision catches a swept crossing", async () => {
  const { onLawn, mowerHit } = await import('../src/game/lawn');
  expect(onLawn({x:5,z:-5})).toBe(true);
  expect(covered({x:5,z:-5})).toBe(false);
  expect(covered({x:-5,z:-5})).toBe(true);
  expect(mowerHit({x:5,z:-5},{x:5,z:-6},{x:5,z:-4})).toBe(true);
  expect(mowerHit({x:6,z:-5},{x:5,z:-6},{x:5,z:-4})).toBe(false);
});

test("hazard layouts vary without overlap and poison can be washed off",async()=>{
  const {hazardLayout,poisonStep}=await import('../src/game/hazards');
  let previous:number[]=[];
  for(let i=0;i<30;i++){
    const layout=hazardLayout(previous,()=>.4);
    expect(new Set([...layout.beer,...layout.poison]).size).toBe(layout.beer.length+layout.poison.length);
    expect([...layout.beer].sort()).not.toEqual([...previous].sort());previous=layout.beer;
  }
  expect(poisonStep(.5,100,1,false,false).health).toBeLessThan(100);
  expect(poisonStep(.5,100,1,false,true).poison).toBe(0);
});
