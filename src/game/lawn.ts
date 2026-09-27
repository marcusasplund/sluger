import type { Point } from './rules';
export const LAWN = { left: 2.7, right: 8.5, back: -8.9, front: -2.8 };
export const onLawn = (p: Point) => p.x > LAWN.left && p.x < LAWN.right && p.z > LAWN.back && p.z < LAWN.front;
export const MOWER_ROUTE: Point[] = [
  {x:4,z:-8}, {x:4,z:-3.5}, {x:5.5,z:-3.5}, {x:5.5,z:-8},
  {x:7,z:-8}, {x:7,z:-3.5}, {x:7.7,z:-3.5}, {x:7.7,z:-8.3}, {x:4,z:-8.3},
];
export function mowerHit(player: Point, from: Point, to: Point) {
  const dx=to.x-from.x,dz=to.z-from.z;
  const t=Math.max(0,Math.min(1,((player.x-from.x)*dx+(player.z-from.z)*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(player.x-from.x-dx*t,player.z-from.z-dz*t)<.68;
}
