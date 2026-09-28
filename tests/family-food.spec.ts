import {test,expect} from '@playwright/test';
import {requiredMeals,canGoHome,fullness,LETTUCE} from '../src/game/food';
import {PartnerJourney,NEST_KEY} from '../src/game/partner';
import {CAMPAIGN_KEY,freshCampaign} from '../src/game/campaign';
import {FLOWERS,HOME} from '../src/game/rules';

test('family meals scale with hatched clutches, stay attainable and gate new eggs too',()=>{
  expect([0,1,2,10000].map(requiredMeals)).toEqual([3,5,7,7]);
  expect(fullness(0,3,1)).toBe(60);expect(canGoHome(0,3,1)).toBe(false);
  expect(canGoHome(1,4,1)).toBe(true);
  const partner=new PartnerJourney();partner.met=true;
  expect(partner.lay(0,3,100,1)).toBe(0);
  expect(partner.lay(1,4,100,1)).toBe(6);
});

test('a saved family needs five actual meals before homecoming; retry and reload retain the requirement',async({page})=>{
  await page.addInitScript(({nest,campaign,progress})=>{
    localStorage.setItem(nest,JSON.stringify({clutches:1}));
    localStorage.setItem(campaign,JSON.stringify(progress));
  },{nest:NEST_KEY,campaign:CAMPAIGN_KEY,progress:{...freshCampaign(),hatchedClutches:1,incubatingClutches:1}});
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  const state=()=>page.evaluate(()=>(window as any).__sluger.state());
  const step=(seconds:number)=>page.evaluate(s=>(window as any).__sluger.step(s),seconds);
  const place=(p:{x:number;z:number})=>page.evaluate(p=>{(window as any).__sluger.place(p.x,p.z);(window as any).__sluger.gardener(-10,-10,Math.PI);},p);
  const eat=async(p:{x:number;z:number},seconds:number)=>{await place(p);await page.keyboard.down('e');await step(seconds);await page.keyboard.up('e');};
  expect((await state()).requiredMeals).toBe(5);
  for(const f of LETTUCE.slice(0,3))await eat(f,.7);
  await place(HOME);await step(3);
  expect((await state()).phase).toBe('playing');expect((await state()).fullness).toBe(60);
  await expect(page.locator('#mission')).toContainText('2 more meals');
  await expect(page.locator('#interaction-text')).toContainText('your young');
  await eat(LETTUCE[3],.7);await place(HOME);await step(.2);expect((await state()).phase).toBe('playing');
  await eat(FLOWERS[0],1.2);await place(HOME);await step(4);
  expect((await state()).phase).toBe('won');await expect(page.locator('#result-description')).toContainText('Your young are fed');
  await page.getByRole('button',{name:'Next night',exact:true}).click();
  expect((await state()).requiredMeals).toBe(5);expect((await state()).fullness).toBe(0);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start over',exact:true}).click();expect((await state()).requiredMeals).toBe(5);
  await page.reload();await page.getByRole('button',{name:'Into the garden'}).click();expect((await state()).requiredMeals).toBe(5);
});
