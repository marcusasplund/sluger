import {test,expect} from '@playwright/test';
import {YoungJourney,RESCUE_SECONDS} from '../src/game/young';
import {HOME,distance} from '../src/game/rules';
import {freshCampaign,nextNight,clearNight,CAMPAIGN_KEY} from '../src/game/campaign';
import {NEST_KEY} from '../src/game/partner';

test('hatchlings spend their first night sheltered and mature on the next successful dawn',()=>{
  let c=nextNight(clearNight(freshCampaign(),100,1,0),1);
  c=nextNight(clearNight(c,100,1,0),1);
  expect(c.hatchedClutches).toBe(1);expect(c.matureClutches).toBe(0);
  c=nextNight(clearNight(c,100,1,0),1);expect(c.matureClutches).toBe(1);
  const y=new YoungJourney();y.reset(6,false);
  y.update(20,{x:5,z:0},false,[],()=>true);expect(y.ready).toBe(true);expect(y.lost).toBe(0);
});

test('calling gathers exploring youngsters, danger gives time to rescue, and neglect kills',()=>{
  const y=new YoungJourney();y.reset(6,true);
  const player={x:0,z:0};
  for(let i=0;i<600;i++)y.update(1/60,player,false,[],()=>false);
  expect(y.alive.some(c=>distance(c,player)>1.2)).toBe(true);
  y.update(1,player,false,[],()=>true);expect(y.danger).toBeDefined();expect(y.lost).toBe(0);
  y.call();
  for(let i=0;i<180;i++)y.update(1/60,player,false,[],()=>false);
  expect(y.danger).toBeUndefined();expect(y.alive.every(c=>distance(c,player)<3)).toBe(true);
  const victim=y.children[0];victim.x=8;victim.z=0;
  y.following=false;y.update(RESCUE_SECONDS-.1,player,false,[],c=>c===victim);expect(victim.alive).toBe(true);
  y.update(.11,player,false,[],c=>c===victim);expect(victim.alive).toBe(false);expect(y.lost).toBe(1);
});

test('a full parent gathers the whole family before sheltering',()=>{
  const y=new YoungJourney();y.reset(6,true);
  y.update(2,{x:0,z:4},false,[],()=>false);expect(y.ready).toBe(false);
  for(let i=0;i<600;i++)y.update(1/60,HOME,true,[],()=>false);
  expect(y.returning).toBe(true);expect(y.ready).toBe(true);expect(y.lost).toBe(0);
});

test('family controls work with keyboard and touch button, pause freezes movement, saves retain losses',async({page})=>{
  await page.addInitScript(({campaignKey,nestKey})=>{
    if(!localStorage.getItem(campaignKey)){
      localStorage.setItem(nestKey,JSON.stringify({clutches:1}));
      localStorage.setItem(campaignKey,JSON.stringify({night:1,cleared:false,scores:[],defended:null,hatchedClutches:1,incubatingClutches:1,matureClutches:1,lostYoung:1}));
    }
  },{campaignKey:CAMPAIGN_KEY,nestKey:NEST_KEY});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  const state=()=>page.evaluate(()=>(window as any).__sluger.state());
  expect((await state()).family.living).toBe(5);
  await expect(page.locator('#call-young')).toBeVisible();
  await page.keyboard.press('q');expect((await state()).family.following).toBe(true);
  await page.keyboard.press('Escape');const paused=(await state()).family.children;
  await page.waitForTimeout(250);expect((await state()).family.children).toEqual(paused);
  await page.getByRole('button',{name:'Continue the evening'}).click();
  await page.locator('#call-young').click();
  await page.evaluate(()=>{const d=(window as any).__sluger;d.place(0,4);d.gardener(9,-9,0);d.step(3);});
  await expect(page.locator('#family-status')).toContainText('following');
  await page.evaluate(()=>document.getElementById('review-controls')!.hidden=true);
  await page.screenshot({path:'artifacts/family-following.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#call-young')).toBeInViewport();
  await page.screenshot({path:'artifacts/family-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.getElementById('review-controls')!.hidden=false);
  await page.getByRole('button',{name:'Review home',exact:true}).click();
  await page.evaluate(()=>(window as any).__sluger.step(8));
  expect((await state()).phase).toBe('won');expect((await state()).family.ready).toBe(true);
  await page.reload();await page.getByRole('button',{name:'Into the garden'}).click();expect((await state()).family.living).toBe(5);
  expect(errors).toEqual([]);
});

test('young follow around an obstacle and younger siblings stay sheltered',()=>{
  const y=new YoungJourney();y.reset(6,3);y.call();
  const obstacles=[{x:0,z:6,radius:.8}];
  for(let i=0;i<1800;i++)y.update(1/60,{x:0,z:3},false,obstacles,()=>false);
  expect(y.alive.filter(c=>c.sheltered)).toHaveLength(3);
  expect(y.alive.filter(c=>!c.sheltered).every(c=>distance(c,{x:0,z:3})<1.5)).toBe(true);
});
