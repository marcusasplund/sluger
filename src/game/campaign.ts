export const CAMPAIGN_KEY='sluger.campaign.v1';
export const NIGHTS=[
  {name:'After the rain',weather:'clear',hint:'Find your footing. Fill up and return to the pot.'},
  {name:'Rain on the leaves',weather:'rain',hint:'Rain restores moisture. The gardener has moved his defences.'},
  {name:'The dry evening',weather:'clear',hint:'Moisture drains faster. Plan your route between puddles.'},
] as const;
export interface Campaign {night:number;cleared:boolean;scores:number[];defended:'west'|'east'|null;hatchedClutches:number;incubatingClutches:number;}
export const freshCampaign=():Campaign=>({night:1,cleared:false,scores:[],defended:null,hatchedClutches:0,incubatingClutches:0});
export function readCampaign(storage:Pick<Storage,'getItem'>):Campaign {
  try {
    const v=JSON.parse(storage.getItem(CAMPAIGN_KEY)??'null');
    if(!v||!Number.isInteger(v.night)||v.night<1||v.night>3||typeof v.cleared!=='boolean'||!Array.isArray(v.scores)||v.scores.length!==v.night-1+Number(v.cleared)||!v.scores.every((n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)||![null,'west','east'].includes(v.defended)||![v.hatchedClutches,v.incubatingClutches].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000)||v.hatchedClutches>v.incubatingClutches)return freshCampaign();
    return {night:v.night,cleared:v.cleared,scores:[...v.scores],defended:v.defended,hatchedClutches:v.hatchedClutches,incubatingClutches:v.incubatingClutches};
  } catch {return freshCampaign();}
}
export function saveCampaign(storage:Pick<Storage,'setItem'>,c:Campaign){try{storage.setItem(CAMPAIGN_KEY,JSON.stringify(c));return true;}catch{return false;}}
export function clearNight(c:Campaign,score:number,westMeals:number,eastMeals:number):Campaign{
  if(c.cleared)return c;
  return {...c,cleared:true,scores:[...c.scores,score],defended:westMeals>=eastMeals?'west':'east'};
}
export function nextNight(c:Campaign,clutches:number):Campaign{
  if(!c.cleared)return c;
  const hatchedClutches=Math.min(clutches,c.incubatingClutches),incubatingClutches=clutches;
  return c.night===3?{...freshCampaign(),hatchedClutches,incubatingClutches}:{...c,night:c.night+1,cleared:false,hatchedClutches,incubatingClutches};
}
