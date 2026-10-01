import {test,expect} from '@playwright/test';
import {freshCampaign,clearNight,nextNight,readCampaign,saveCampaign,CAMPAIGN_KEY,nightConditions} from '../src/game/campaign';
import {NEST_KEY} from '../src/game/partner';

test('campaign advances only after success, hatches after two dawns and keeps the family beyond night three',()=>{
  let c=freshCampaign();expect(nextNight(c,1)).toEqual(c);
  c=clearNight(c,200,3,0);expect(clearNight(c,999,0,3)).toEqual(c);
  c=nextNight(c,1);expect(c).toMatchObject({night:2,scores:[200],defended:'west',hatchedClutches:0,incubatingClutches:1});
  c=nextNight(clearNight(c,300,0,3),1);expect(c).toMatchObject({night:3,defended:'east',hatchedClutches:1});
  c=nextNight(clearNight(c,400,1,2),2);expect(c).toMatchObject({night:4,scores:[200,300,400],cleared:false,hatchedClutches:1,incubatingClutches:2});
});

test('campaign persistence rejects corrupt progress and tolerates unavailable storage',()=>{
  const c=nextNight(clearNight(freshCampaign(),250,2,1),1);
  expect(readCampaign({getItem:()=>JSON.stringify(c)})).toEqual(c);
  for(const value of ['broken',JSON.stringify({...c,scores:[]}),JSON.stringify({...c,hatchedClutches:5})])expect(readCampaign({getItem:()=>value})).toEqual(freshCampaign());
  expect(saveCampaign({setItem:()=>{throw Error('blocked');}},c)).toBe(false);
});

test('three playable nights change weather and defences, survive reload, hatch eggs and continue beyond night three',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(key=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({clutches:1}));},NEST_KEY);
  await page.goto('/?test&review');
  const state=()=>page.evaluate(()=>(window as any).__sluger.state());
  const win=async()=>{await page.getByRole('button',{name:'Review home',exact:true}).click();await page.evaluate(()=>(window as any).__sluger.step(4));expect((await state()).phase).toBe('won');};
  await win();expect((await state()).campaign).toMatchObject({night:1,cleared:true,weather:'clear',young:0});
  await page.getByRole('button',{name:'Next night',exact:true}).click();
  expect((await state()).campaign).toMatchObject({night:2,cleared:false,weather:'rain',young:0});
  expect((await state()).hazards.poison).toHaveLength(3);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start over',exact:true}).click();
  expect((await state()).campaign.night).toBe(2);
  await page.reload();await page.getByRole('button',{name:'Into the garden'}).click();
  expect((await state()).campaign.night).toBe(2);
  await win();await page.getByRole('button',{name:'Next night',exact:true}).click();
  expect((await state()).campaign).toMatchObject({night:3,weather:'clear',young:6});
  expect((await state()).nest.visibleEggs).toBe(0);
  await page.evaluate(()=>{(window as any).__sluger.view([1.5,1.3,7.8],[0,.1,9.7]);document.getElementById('review-controls')!.hidden=true;});
  await page.screenshot({path:'artifacts/campaign-hatchlings.png'});
  await page.evaluate(()=>document.getElementById('review-controls')!.hidden=false);
  await win();await expect(page.locator('#campaign-result')).toContainText('Night 3 survived');
  expect((await state()).campaign.scores).toHaveLength(3);
  await page.screenshot({path:'artifacts/campaign-finale.png'});
  await page.getByRole('button',{name:'Next night',exact:true}).click();
  expect((await state()).campaign).toMatchObject({night:4,scores:expect.any(Array),young:6});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).night,CAMPAIGN_KEY)).toBe(4);
  await page.reload();await page.getByRole('button',{name:'Into the garden'}).click();
  expect((await state()).campaign).toMatchObject({night:4,weather:'rain',young:6});
  for(let night=4;night<=7;night++){
    await win();await page.getByRole('button',{name:'Next night',exact:true}).click();
    expect((await state()).campaign.night).toBe(night+1);
  }
  expect((await state()).campaign.scores).toHaveLength(7);
  expect(errors).toEqual([]);
});

test('later weather cycles safely and completed legacy saves continue',()=>{
  for(let night=1;night<=100;night++)expect(nightConditions(night)).toBeDefined();
  expect(nightConditions(6).drying).toBeGreaterThan(nightConditions(3).drying);
  expect(nightConditions(7)).toEqual(nightConditions(1));
  const legacy={...freshCampaign(),night:3,cleared:true,scores:[100,200,300]};
  const continued=nextNight(readCampaign({getItem:()=>JSON.stringify(legacy)}),0);
  expect(continued).toMatchObject({night:4,scores:[100,200,300]});
  expect(readCampaign({getItem:()=>JSON.stringify(continued)})).toEqual(continued);
});
