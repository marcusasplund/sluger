import {freshDen,readDen,type Den} from './den';
export const CAMPAIGN_KEY='sluger.campaign.v1';
export const NIGHTS=[
  {name:'After the rain',weather:'clear',drying:0,hint:'Find your footing. Fill up and return to the pot.'},
  {name:'Rain on the leaves',weather:'rain',drying:0,hint:'Rain restores moisture. The gardener has moved his defences.'},
  {name:'The dry evening',weather:'clear',drying:.55,hint:'Moisture drains faster. Plan your route between puddles.'},
  {name:'Gentle drizzle',weather:'rain',drying:0,hint:'A wet evening for a longer forage. Bring home extra food.'},
  {name:'A break in the clouds',weather:'clear',drying:.25,hint:'The beds are drying out. Lettuce helps you stay damp.'},
  {name:'Heat in the soil',weather:'clear',drying:.8,hint:'The warm ground dries you quickly. Follow the puddles home.'},
] as const;
/** The opening teaches survival; later nights cycle through all conditions. */
export function nightConditions(night:number){return NIGHTS[(night-1)%NIGHTS.length];}
export interface Campaign {den?:Den;night:number;cleared:boolean;scores:number[];defended:'west'|'east'|null;hatchedClutches:number;matureClutches?:number;lostYoung?:number;incubatingClutches:number;}
export const freshCampaign=():Campaign=>({den:freshDen(),night:1,cleared:false,scores:[],defended:null,hatchedClutches:0,matureClutches:0,lostYoung:0,incubatingClutches:0});
export function readCampaign(storage:Pick<Storage,'getItem'>):Campaign {
  try {
    const v=JSON.parse(storage.getItem(CAMPAIGN_KEY)??'null');
    if(!v||!Number.isSafeInteger(v.night)||v.night<1||typeof v.cleared!=='boolean'||!Array.isArray(v.scores)||v.scores.length!==v.night-1+Number(v.cleared)||!v.scores.every((n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)||![null,'west','east'].includes(v.defended)||![v.hatchedClutches,v.incubatingClutches].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000)||v.hatchedClutches>v.incubatingClutches)return freshCampaign();
    if((v.matureClutches!==undefined&&(!Number.isSafeInteger(v.matureClutches)||v.matureClutches<0||v.matureClutches>v.hatchedClutches))||(v.lostYoung!==undefined&&(!Number.isSafeInteger(v.lostYoung)||v.lostYoung<0||v.lostYoung>v.hatchedClutches*6)))return freshCampaign();
    return {den:readDen(v.den),matureClutches:v.matureClutches??0,lostYoung:v.lostYoung??0,night:v.night,cleared:v.cleared,scores:[...v.scores],defended:v.defended,hatchedClutches:v.hatchedClutches,incubatingClutches:v.incubatingClutches};
  } catch {return freshCampaign();}
}
export function saveCampaign(storage:Pick<Storage,'setItem'>,c:Campaign){try{storage.setItem(CAMPAIGN_KEY,JSON.stringify(c));return true;}catch{return false;}}
export function clearNight(c:Campaign,score:number,westMeals:number,eastMeals:number,surplus=0):Campaign{
  if(c.cleared)return c;
  const den=readDen(c.den);
  return {...c,den:{...den,reserves:den.reserves+Math.max(0,Math.floor(surplus))},cleared:true,scores:[...c.scores,score],defended:westMeals>=eastMeals?'west':'east'};
}
export function nextNight(c:Campaign,clutches:number):Campaign{
  if(!c.cleared)return c;
  const family={matureClutches:c.hatchedClutches,lostYoung:c.lostYoung??0};
  const hatchedClutches=Math.min(clutches,c.incubatingClutches),incubatingClutches=clutches;
  return {...c,...family,night:c.night+1,cleared:false,hatchedClutches,incubatingClutches};
}
