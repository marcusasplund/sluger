import { HOME, distance, move, type Point, type Obstacle } from './rules';

export const RESCUE_SECONDS = 6;
export interface Hatchling extends Point {
  id:number; angle:number; alive:boolean; sheltered:boolean; fear:number;
}
export class YoungJourney {
  children:Hatchling[]=[];
  following=false;
  returning=false;
  departed=false;
  age=0;
  lost=0;
  reset(count:number, outingCount:number|boolean) {
    this.children=Array.from({length:Math.min(6,count)},(_,id)=>({id,x:HOME.x+Math.cos(id*2.4)*.35,z:HOME.z+.5+Math.sin(id*2.4)*.25,angle:0,alive:true,sheltered:id >= (typeof outingCount==='boolean' ? (outingCount?count:0) : outingCount),fear:0}));
    this.following=false;this.returning=false;this.departed=false;this.age=0;this.lost=0;
  }
  call(){this.following=true;}
  get alive(){return this.children.filter(c=>c.alive);}
  get danger(){return this.alive.find(c=>c.fear>0);}
  get ready(){return this.alive.every(c=>c.sheltered);}
  update(dt:number,player:Point,full:boolean,obstacles:Obstacle[],threatened:(c:Hatchling)=>boolean){
    this.age+=dt;
    if(full){this.returning=true;this.following=true;}
    if(distance(player,HOME)>2)this.departed=true;
    let leader=player;
    for(const c of this.alive){
      if(c.sheltered)continue;
      const danger=this.departed&&distance(c,HOME)>1.7&&threatened(c);
      // Calling releases a frightened youngster; reaching it also rescues it.
      if(danger&&distance(c,player)>1.2)c.fear+=dt;
      else c.fear=0;
      if(c.fear>=RESCUE_SECONDS){c.alive=false;this.lost++;continue;}
      let target:Point;
      if(this.returning&&distance(player,HOME)<1.1)target=HOME;
      else if(this.following)target=leader;
      else {
        const spread=this.departed?2.4:.35,angle=c.id*2.399+this.age*.22;
        target={x:(this.departed?player.x:HOME.x)+Math.cos(angle)*spread,z:(this.departed?player.z:HOME.z+.5)+Math.sin(angle)*spread};
      }
      const d=distance(c,target),stop=this.following?.38:.12;
      if(d>stop&&(c.fear===0||this.following||distance(c,player)<=1.2)){
        const speed=this.following?2.5:1.05,step=Math.min(d-stop,speed*dt);
        const dx=(target.x-c.x)/d,dz=(target.z-c.z)/d;
        let next=move(c,dx*step,dz*step,obstacles,.09);
        // Slide around circular obstacles if the direct route stalls.
        if(distance(c,next)<step*.3){
          const side=c.id%2?1:-1;
          next=move(c,-dz*step*side,dx*step*side,obstacles,.09);
        }
        c.angle=Math.atan2(-(next.x-c.x),-(next.z-c.z));c.x=next.x;c.z=next.z;
      }
      if(this.returning&&distance(player,HOME)<1.1&&distance(c,HOME)<.85)c.sheltered=true;
      leader=c;
    }
  }
}
