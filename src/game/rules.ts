import { onLawn } from "./lawn";
export type Point = { x: number; z: number };
export type Obstacle = Point & { radius: number };
export const HOME = { x: 0, z: 9 };
export const FLOWERS = [
  { x: -3.3, z: 5 },
  { x: 3.4, z: 4.2 },
  { x: -5.8, z: 1.3 },
  { x: 5.7, z: 0.3 },
  { x: -3.8, z: -3 },
  { x: 3.3, z: -4 },
  { x: -6, z: -6.7 },
  { x: 6, z: -7 },
];
export const WATER = [
  { x: -1.5, z: 3, radius: 1.12 },
  { x: 2.2, z: -2, radius: 1.05 },
  { x: -2.2, z: -6.5, radius: 0.95 },
];
export const SALT = [
  { x: -3.1, z: -0.7, radius: 0.65 },
  { x: 4.5, z: -2, radius: 0.7 },
  { x: 1.5, z: -6, radius: 0.6 },
];
export const PATROL = [
  { x: 0, z: -8 },
  { x: 8, z: -4 },
  { x: 7, z: 6 },
  { x: -7, z: 6 },
  { x: -8, z: -5 },
];
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function covered(p: Point) {
  return !onLawn(p) && Math.abs(p.x) > 2.5 && Math.abs(p.x) < 8.5 && p.z < 7 && p.z > -9;
}
export function move(
  p: Point,
  dx: number,
  dz: number,
  obstacles: Obstacle[],
  radius = 0.24,
) {
  const result = {
    x: Math.max(-10.7, Math.min(10.7, p.x + dx)),
    z: Math.max(-10, Math.min(10.5, p.z + dz)),
  };
  for (const o of obstacles) {
    const d = distance(result, o),
      min = radius + o.radius;
    if (d < min) {
      const nx = d > 0.00001 ? (result.x - o.x) / d : 1;
      const nz = d > 0.00001 ? (result.z - o.z) / d : 0;
      result.x = o.x + nx * min;
      result.z = o.z + nz * min;
    }
  }
  return result;
}
export function visible(
  observer: Point,
  heading: number,
  target: Point,
  hidden: boolean,
  obstacles: Obstacle[],
) {
  const d = distance(observer, target);
  if (d > (hidden ? 1.4 : 6) || d < 0.001) return d < 0.001;
  if (
    d > 1 &&
    ((target.x - observer.x) * Math.sin(heading) +
      (target.z - observer.z) * Math.cos(heading)) /
      d <
      0.55
  )
    return false;
  for (const o of obstacles) {
    const t = Math.max(
      0,
      Math.min(
        1,
        ((o.x - observer.x) * (target.x - observer.x) +
          (o.z - observer.z) * (target.z - observer.z)) /
          (d * d),
      ),
    );
    if (
      distance(o, {
        x: observer.x + t * (target.x - observer.x),
        z: observer.z + t * (target.z - observer.z),
      }) < o.radius
    )
      return false;
  }
  return true;
}
export function survival(
  moisture: number,
  health: number,
  dt: number,
  wet: boolean,
  sprint: boolean,
  salted: boolean,
) {
  moisture = Math.max(
    0,
    Math.min(100, moisture + dt * (wet ? 16 : sprint ? -4 : -0.23)),
  );
  health = Math.max(
    0,
    Math.min(
      100,
      health + dt * (salted ? -28 : moisture <= 0 ? -7 : wet ? 3 : 0),
    ),
  );
  return { moisture, health };
}
