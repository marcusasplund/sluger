import {test,expect} from '@playwright/test';
import {freshDen,readDen,buyUpgrade,denSurvival,eatingRate,surplusMeals} from '../src/game/den';
import {freshCampaign,clearNight,nextNight,readCampaign,CAMPAIGN_KEY} from '../src/game/campaign';
import {LETTUCE} from '../src/game/food';
import {FLOWERS,HOME} from '../src/game/rules';

test('stores are earned once, only beyond family needs, and survive transitions',()=>{
  expect(surplusMeals(6,7)).toBe(0);expect(surplusMeals(8,7)).toBe(1);
  const won=clearNight(freshCampaign(),400,3,2,2);
  expect(won.den?.reserves).toBe(2);
  expect(clearNight(won,400,3,2,2)).toEqual(won);
  expect(nextNight(won,0).den).toEqual(won.den);
  expect(readCampaign({getItem:()=>JSON.stringify(won)})).toEqual(won);
  const legacy={...won};delete legacy.den;
  expect(readCampaign({getItem:()=>JSON.stringify(legacy)}).den).toEqual(freshDen());
  expect(readDen({reserves:-1,moss:0,spring:0,appetite:0})).toEqual(freshDen());
  expect(readDen({reserves:20,moss:4,spring:0,appetite:0})).toEqual(freshDen());
});

test('upgrades cost stores, cap at three, and affect survival and eating',()=>{
  const empty=freshDen();expect(buyUpgrade(empty,'moss')).toBe(empty);
  let den={...empty,reserves:12};
  for(let i=0;i<3;i++)den=buyUpgrade(den,'moss');
  expect(den).toMatchObject({reserves:0,moss:3});expect(buyUpgrade(den,'moss')).toBe(den);
  expect(denSurvival(den,100,90,50,1,false,false)).toEqual({moisture:93,health:50});
  expect(denSurvival({...den,spring:3},50,66,50,1,true,false)).toEqual({moisture:66,health:53});
  expect(denSurvival({...den,spring:3},50,66,50,1,false,false).health).toBe(50);
  expect(denSurvival({...den,spring:3},50,66,50,1,true,true).health).toBe(50);
  expect(denSurvival({...den,spring:3},90,100,99,1,true,false).health).toBe(100);
  expect(eatingRate({...den,appetite:3})).toBe(1.3);
});

test('harvest extra food, buy an improvement, and retain it across reload and retry',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  for(const p of [...LETTUCE,FLOWERS[0]]){
    await page.evaluate(p=>{const g=(window as any).__sluger;g.gardener(-10,-10,Math.PI);g.place(p.x,p.z);},p);
    await page.keyboard.down('e');await page.evaluate(()=>(window as any).__sluger.step(1.3));await page.keyboard.up('e');
  }
  await page.evaluate(p=>{const g=(window as any).__sluger;g.place(p.x,p.z);g.step(4);},HOME);
  const state=()=>page.evaluate(()=>(window as any).__sluger.state());
  expect((await state()).phase).toBe('won');
  await page.locator('#den summary').click();
  await expect(page.locator('#den-income')).toHaveText('+2 extra meals stored tonight.');
  await page.getByRole('button',{name:'Improve Foraging practice'}).click();
  await expect(page.locator('#den-status')).toContainText('level 1');
  expect((await state()).campaign.den).toMatchObject({reserves:0,appetite:1});
  await expect(page.getByRole('button',{name:'Improve Moss lining'})).toBeDisabled();
  await page.evaluate(()=>document.getElementById('review-controls')!.hidden=true);
  for(const [width,height] of [[1440,1000],[768,1024],[390,844]]){
    await page.setViewportSize({width,height});await page.locator('#den').scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`artifacts/den-${width}.png`});
  }
  await page.reload();await page.getByRole('button',{name:'Into the garden'}).click();
  expect((await state()).campaign).toMatchObject({night:2,den:{reserves:0,appetite:1}});
  await page.keyboard.press('Escape');await expect(page.locator('#den')).toBeHidden();
  await page.getByRole('button',{name:'Start over',exact:true}).click();
  expect((await state()).campaign.den.appetite).toBe(1);
  await page.evaluate(p=>{const g=(window as any).__sluger;g.gardener(-10,-10,Math.PI);g.place(p.x,p.z);},FLOWERS[0]);
  await page.keyboard.down('e');await page.evaluate(()=>(window as any).__sluger.step(1.06));await page.keyboard.up('e');
  expect((await state()).eaten).toBe(1);
  await page.evaluate(()=>{const g=(window as any).__sluger;g.kill('spade');g.step(5);});
  expect((await state()).phase).toBe('lost');
  await expect(page.locator('#den')).toBeHidden();
  expect((await state()).campaign.den).toMatchObject({reserves:0,appetite:1});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).den.reserves,CAMPAIGN_KEY)).toBe(0);
  expect(errors).toEqual([]);
});

test('blocked storage keeps purchases for this session and explains the limit',async({page})=>{
  await page.addInitScript(({key,progress})=>{
    localStorage.setItem(key,JSON.stringify(progress));
    Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};
  },{key:CAMPAIGN_KEY,progress:{...freshCampaign(),den:{...freshDen(),reserves:2}}});
  await page.goto('/?test&review');await page.getByRole('button',{name:'Review home',exact:true}).click();
  await page.evaluate(()=>(window as any).__sluger.step(4));
  await page.locator('#den summary').click();
  await page.getByRole('button',{name:'Improve Moss lining'}).click();
  await expect(page.locator('#den-status')).toContainText('session only');
  await page.evaluate(()=>document.getElementById('review-controls')!.hidden=true);
  await page.getByRole('button',{name:'Next night',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__sluger.state().campaign.den.moss)).toBe(1);
});
