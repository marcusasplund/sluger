import {DEN_UPGRADES,upgradeCost,type Den,type UpgradeId} from './game/den';

/** A quiet, optional choice between raids; never competes with the garden HUD. */
export function createDen(onBuy:(id:UpgradeId)=>void){
  const panel=document.createElement('details');
  panel.id='den';panel.hidden=true;
  panel.innerHTML=`<summary>Improve your home <span id="den-balance"></span></summary>
    <p id="den-income"></p><p>Extra meals brought home become stores. Improvements last through every night and retry.</p>
    <ul>${DEN_UPGRADES.map(u=>`<li><div><strong>${u.name} <span id="den-level-${u.id}"></span></strong><p>${u.description}</p></div><button type="button" id="den-buy-${u.id}" aria-label="Improve ${u.name}"></button></li>`).join('')}</ul>
    <p id="den-status" role="status" aria-live="polite"></p>`;
  for(const {id} of DEN_UPGRADES)panel.querySelector<HTMLButtonElement>(`#den-buy-${id}`)!.onclick=()=>onBuy(id);
  return {panel,render(den:Den,earned:number,saved:boolean,message=''){
    panel.querySelector('#den-balance')!.textContent=`${den.reserves} stored`;
    panel.querySelector('#den-income')!.textContent=earned>0?`+${earned} extra meals stored tonight.`:'Bring home more than the fullness target to build your stores.';
    panel.querySelector('#den-status')!.textContent=message+(saved?'':' Stores and improvements are kept for this session only.');
    for(const {id} of DEN_UPGRADES){
      panel.querySelector(`#den-level-${id}`)!.textContent=`${den[id]}/3`;
      const button=panel.querySelector<HTMLButtonElement>(`#den-buy-${id}`)!;
      button.textContent=den[id]>=3?'Complete':`${upgradeCost(den[id])} meals`;
      button.disabled=den[id]>=3||den.reserves<upgradeCost(den[id]);
    }
  }};
}
