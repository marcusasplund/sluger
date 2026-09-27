import { canGoHome } from './food';

export const PARTNER = { x: -6, z: -4.6 };
export const PARTNER_TRAIL = [
  { x: -1.6, z: 6.6 }, { x: -2.5, z: 5.7 }, { x: -3.6, z: 4.2 },
  { x: -4.7, z: 3 }, { x: -5.2, z: 1.8 }, { x: -5.3, z: .2 },
  { x: -5.4, z: -1.2 }, { x: -5.3, z: -2.8 }, PARTNER,
];
export const MEETING_SECONDS = 2;
export const NEST_MOISTURE = 45;
export const EGG_MOISTURE_COST = 20;
export const CLUTCH_SIZE = 6;
export const NEST_KEY = 'sluger.nest.v1';
export const MAX_CLUTCHES = 10000;

export class PartnerJourney {
  discovered = false;
  met = false;
  meeting = 0;
  laid = false;
  reset() { this.discovered = false; this.met = false; this.meeting = 0; this.laid = false; }
  meet(dt: number, nearby: boolean, holding: boolean, moving: boolean) {
    if (nearby) this.discovered = true;
    if (this.met) return false;
    this.meeting = nearby && holding && !moving ? Math.min(MEETING_SECONDS, this.meeting + dt) : 0;
    if (this.meeting < MEETING_SECONDS) return false;
    this.met = true;
    return true;
  }
  canNest(lilies: number, lettuce: number, moisture: number) {
    return this.met && !this.laid && canGoHome(lilies, lettuce) && moisture >= NEST_MOISTURE;
  }
  lay(lilies: number, lettuce: number, moisture: number) {
    if (!this.canNest(lilies, lettuce, moisture)) return 0;
    this.laid = true;
    return CLUTCH_SIZE;
  }
}

export interface NestStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function readNest(storage: Pick<NestStorage, 'getItem'>): number {
  try {
    const saved: unknown = JSON.parse(storage.getItem(NEST_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'clutches' in saved) {
      const count = saved.clutches;
      if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= MAX_CLUTCHES) return count;
    }
  } catch { /* A blocked or corrupt save must not prevent play. */ }
  return 0;
}
export function saveNest(storage: Pick<NestStorage, 'setItem'>, clutches: number) {
  try { storage.setItem(NEST_KEY, JSON.stringify({ clutches })); return true; } catch { return false; }
}

export function nearPartnerTrail(x:number,z:number,radius:number) {
  for(let i=1;i<PARTNER_TRAIL.length;i++){
    const a=PARTNER_TRAIL[i-1],b=PARTNER_TRAIL[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<radius*radius)return true;
  }
  return false;
}
