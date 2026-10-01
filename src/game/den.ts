export const DEN_UPGRADES = [
  {id:'moss',name:'Moss lining',description:'Lose 10% less moisture per level, including when sliding.'},
  {id:'spring',name:'Spring water',description:'Recover 1 extra health per second in puddles per level.'},
  {id:'appetite',name:'Foraging practice',description:'Eat 10% faster per level.'},
] as const;
export type UpgradeId = typeof DEN_UPGRADES[number]['id'];
export type Den = { reserves:number; moss:number; spring:number; appetite:number };
export const freshDen=():Den=>({reserves:0,moss:0,spring:0,appetite:0});
export function readDen(value:unknown):Den {
  if(!value||typeof value!=='object')return freshDen();
  const v=value as Den;
  if(!Number.isSafeInteger(v.reserves)||v.reserves<0||!DEN_UPGRADES.every(({id})=>Number.isInteger(v[id])&&v[id]>=0&&v[id]<=3))return freshDen();
  return {reserves:v.reserves,moss:v.moss,spring:v.spring,appetite:v.appetite};
}
export const upgradeCost=(level:number)=>2+level*2;
export function buyUpgrade(den:Den,id:UpgradeId):Den {
  const cost=upgradeCost(den[id]);
  if(den[id]>=3||den.reserves<cost)return den;
  return {...den,reserves:den.reserves-cost,[id]:den[id]+1};
}
export const surplusMeals=(meals:number,required:number)=>Math.max(0,Math.floor(meals-required));
export function denSurvival(den:Den,beforeMoisture:number,moisture:number,health:number,dt:number,inPuddle:boolean,salted:boolean){
  return {
    moisture:moisture+Math.max(0,beforeMoisture-moisture)*den.moss*.1,
    health:Math.min(100,health+(inPuddle&&!salted?dt*den.spring:0)),
  };
}
export const eatingRate=(den:Den)=>1+den.appetite*.1;
