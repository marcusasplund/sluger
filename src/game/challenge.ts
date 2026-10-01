export const NIGHT_CHALLENGES = [
  {id:'quiet',title:'Unseen supper',description:'Get full and return without a chase.',bonus:200},
  {id:'variety',title:'A little of everything',description:'Bring home 2 lilies and 2 lettuce.',bonus:180},
  {id:'lettuce',title:'Salad supper',description:'Bring home all 4 lettuce heads.',bonus:220},
  {id:'feast',title:'A feast to remember',description:'Bring home 6 lilies.',bonus:350},
  {id:'lawn',title:'Dinner with danger',description:'Bring home both lawn lilies.',bonus:300},
] as const;
export type ChallengeId = typeof NIGHT_CHALLENGES[number]['id'];
export type ChallengeStats = {lilies:number;lettuce:number;chased:boolean;lawnLilies:number};
export function chooseChallenge(previous?:ChallengeId,random=Math.random){
  const choices=NIGHT_CHALLENGES.filter(c=>c.id!==previous);
  return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
export function challengeStatus(id:ChallengeId,s:ChallengeStats){
  if(id==='quiet')return {ready:!s.chased&&s.lilies+s.lettuce>=3,failed:s.chased,progress:s.chased?'Spotted — try again next evening':`${Math.min(3,s.lilies+s.lettuce)}/3 meals · unseen`};
  if(id==='lettuce')return {ready:s.lettuce>=4,failed:false,progress:`${Math.min(4,s.lettuce)}/4 lettuce`};
  if(id==='feast')return {ready:s.lilies>=6,failed:false,progress:`${Math.min(6,s.lilies)}/6 lilies`};
  if(id==='variety')return {ready:s.lilies>=2&&s.lettuce>=2,failed:false,progress:`${Math.min(2,s.lilies)}/2 lilies · ${Math.min(2,s.lettuce)}/2 lettuce`};
  return {ready:s.lawnLilies===2,failed:false,progress:`${s.lawnLilies}/2 lawn lilies`};
}
export function threatDirection(dx:number,dz:number,forwardX:number,forwardZ:number){
  const angle=Math.atan2(-forwardZ*dx+forwardX*dz,forwardX*dx+forwardZ*dz);
  const direction=Math.abs(angle)>Math.PI*.75?'behind':Math.abs(angle)<Math.PI*.25?'ahead':angle>0?'right':'left';
  return {angle,direction};
}
