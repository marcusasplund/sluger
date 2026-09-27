export const HAZARD_SITES = [
  {x:-7,z:5.6},{x:-7,z:-2.5},{x:-8,z:-6},{x:7,z:6},
  {x:7,z:2},{x:-3,z:7.8},{x:-4,z:-8.7},{x:-9,z:0},
];
export function hazardLayout(previousBeer:number[]=[],random=Math.random){
  const ids=HAZARD_SITES.map((_,i)=>i);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const count=random()<.5?2:3;
  if(ids.slice(0,count).every(i=>previousBeer.includes(i))&&count===previousBeer.length){
    const other=ids.findIndex(i=>!previousBeer.includes(i));[ids[0],ids[other]]=[ids[other],ids[0]];
  }
  return {beer:ids.slice(0,count),poison:ids.slice(count,count+2)};
}
export function poisonStep(load:number,health:number,dt:number,exposed:boolean,water:boolean){
  const poison=Math.max(0,Math.min(1,load+dt*(exposed?.8:water?-.5:-.035)));
  return {poison,health:Math.max(0,health-dt*poison*12)};
}
