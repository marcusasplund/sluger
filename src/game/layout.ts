import { FLOWERS, WATER, SALT, distance, type Point } from './rules';
import { LETTUCE } from './food';
import { PARTNER, PARTNER_TRAIL } from './partner';
import { HAZARD_SITES } from './hazards';
import { LAWN } from './lawn';

export type Area = Point & {radius:number};
export interface GardenLayout {water:Area[];salt:Area[];partner:Point;trail:Point[];}
// These rocks are also used by the renderer. Larger border rocks and pots are
// outside the placement bounds; the log and home are south of those bounds.
export const GARDEN_ROCKS = [
  [-2.65,3.65,.29],[-2.7,3.18,.19],[-.35,2.24,.16],[3.22,-1.7,.24],[-3.1,-6.3,.27],
];
const obstacles=GARDEN_ROCKS.map(([x,z,r])=>({x,z,radius:r*.76}));
const hazards=HAZARD_SITES.map(p=>({...p,radius:1.2}));
const food=[...FLOWERS,...LETTUCE].map(p=>({...p,radius:.55}));
const separated=(p:Area,other:Area[],gap=.25)=>other.every(o=>distance(p,o)>p.radius+o.radius+gap);
function shuffle<T>(items:T[],random:()=>number){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function offLawn(p:Area){return p.x+p.radius<LAWN.left||p.x-p.radius>LAWN.right||p.z+p.radius<LAWN.back||p.z-p.radius>LAWN.front;}
function candidate(p:Area){
  // Leave the stepping-stone corridor clear, including a slug's body width.
  return Math.abs(p.x)-p.radius>1.05&&offLawn(p)&&separated(p,[...hazards,...food,...obstacles]);
}
function segmentDistance(p:Point,a:Point,b:Point){
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  return distance(p,{x:a.x+t*dx,z:a.z+t*dz});
}
export function trailClear(p:Area,trail:Point[]){return trail.slice(1).every((b,i)=>segmentDistance(p,trail[i],b)>p.radius+.4);}

// Breadth-first search keeps the trail out of every possible trap site, so later
// poison/beer shuffles cannot turn the companion's trail into a trap.
function route(target:Point):Point[]|undefined {
  const step=.4,width=39,depth=38;
  const point=(id:number)=>({x:-7.6+(id%width)*step,z:6-Math.floor(id/width)*step});
  const start=19,queue=[start],parents=new Map<number,number>([[start,-1]]);
  const clear=(p:Point)=>offLawn({...p,radius:.3})&&separated({...p,radius:.3},[...hazards,...obstacles],.2);
  for(let head=0;head<queue.length;head++){
    const id=queue[head],p=point(id);
    if(distance(p,target)<.45){
      const trail:Point[]=[target];let node=id;
      while(node!==-1){trail.push(point(node));node=parents.get(node)!;}
      const path=trail.reverse(),smooth:Point[]=[path[0]];
      // Remove grid stair-steps while retaining the same safe clearance.
      for(let from=0;from<path.length-1;){
        let to=path.length-1;
        for(;to>from+1;to--){
          const a=path[from],b=path[to],samples=Math.ceil(distance(a,b)/.15);
          if(Array.from({length:samples+1},(_,i)=>({x:a.x+(b.x-a.x)*i/samples,z:a.z+(b.z-a.z)*i/samples})).every(clear))break;
        }
        smooth.push(path[to]);from=to;
      }
      return smooth;
    }
    const x=id%width,z=Math.floor(id/width);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,next=nz*width+nx;
      if(nx<0||nx>=width||nz<0||nz>=depth||parents.has(next)||!clear(point(next)))continue;
      parents.set(next,id);queue.push(next);
    }
  }
}

export function gardenLayout(random=Math.random):GardenLayout {
  const sites:Point[]=[];
  for(let x=-7.4;x<=7.4;x+=.4)for(let z=-8;z<=6.4;z+=.4)sites.push({x:Number(x.toFixed(2)),z:Number(z.toFixed(2))});
  const shuffled=shuffle(sites,random);
  // Start with water in three depth bands, guaranteeing a useful distribution.
  const water:Area[]=[];
  for(const [front,back,radius] of [[5.6,2.4,.85],[1.2,-2.4,.8],[-4.4,-8,.75]]){
    const p=shuffled.find(p=>p.z<=front&&p.z>=back&&candidate({...p,radius})&&separated({...p,radius},water));
    if(!p)throw new Error('Garden water placement has no safe site');
    water.push({...p,radius});
  }
  let partner:Point|undefined,trail:Point[]|undefined;
  for(const p of shuffled){
    if(p.z>5||p.z< -7||!candidate({...p,radius:.8})||!separated({...p,radius:1},water))continue;
    const path=route(p);
    if(path){partner={...p};trail=path;break;}
  }
  if(!partner||!trail)throw new Error('Garden companion placement has no safe route');
  const salt:Area[]=[];
  for(const p of shuffled){
    const area={...p,radius:.55};
    if(!candidate(area)||!separated(area,[...water,...salt,{...partner,radius:1.4}])||!trailClear(area,trail))continue;
    salt.push(area);if(salt.length===3)break;
  }
  if(salt.length!==3)throw new Error('Garden salt placement has no safe site');
  return {water,salt,partner,trail};
}

// Called once before terrain, vegetation, materials and interaction volumes are
// built. Keep shared references intact so every system uses the same layout.
export function applyGardenLayout(layout:GardenLayout){
  WATER.splice(0,WATER.length,...layout.water.map(p=>({...p})));
  SALT.splice(0,SALT.length,...layout.salt.map(p=>({...p})));
  Object.assign(PARTNER,layout.partner);
  PARTNER_TRAIL.splice(0,PARTNER_TRAIL.length,...layout.trail.map(p=>({...p})));
}
