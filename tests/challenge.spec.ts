import {test,expect} from '@playwright/test';
import {chooseChallenge,challengeStatus,threatDirection} from '../src/game/challenge';
import {FLOWERS,HOME} from '../src/game/rules';
import {LETTUCE} from '../src/game/food';

test('side goals rotate, require the right food and a chase permanently loses the quiet bonus',()=>{
  expect(chooseChallenge('quiet',()=>0).id).not.toBe('quiet');
  const s={lilies:2,lettuce:2,chased:false,lawnLilies:1};
  expect(challengeStatus('variety',s).ready).toBe(true);
  expect(challengeStatus('lawn',s).ready).toBe(false);
  expect(challengeStatus('quiet',{...s,chased:true}).failed).toBe(true);
  expect(challengeStatus('quiet',{...s,chased:true}).ready).toBe(false);
  expect(challengeStatus('lawn',{...s,lawnLilies:2}).ready).toBe(true);
});
test('threat bearings stay relative to the camera in all directions',()=>{
  expect(threatDirection(0,-2,0,-1).direction).toBe('ahead');
  expect(threatDirection(0,2,0,-1).direction).toBe('behind');
  expect(threatDirection(2,0,0,-1).direction).toBe('right');
  expect(threatDirection(-2,0,0,-1).direction).toBe('left');
  expect(threatDirection(2,0,1,0).direction).toBe('ahead');
});
test('optional bonus is banked only at home and resets on the next raid',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(()=>{(window as any).__sluger.challenge('variety');document.getElementById('review-controls')!.hidden=true;});
  for(const [i,p] of [...FLOWERS.slice(0,2),...LETTUCE.slice(0,2)].entries()){
    await page.evaluate(({x,z})=>{const g=(window as any).__sluger;g.gardener(-10,-10,Math.PI);g.place(x,z);},p);
    await page.keyboard.down('e');await page.evaluate(s=>(window as any).__sluger.step(s),i<2?1.3:.8);await page.keyboard.up('e');
  }
  const ready=await page.evaluate(()=>(window as any).__sluger.state());expect(ready.challenge.ready).toBe(true);expect(ready.reward.challenge).toBe(180);expect(ready.personalBest).toBe(0);
  await expect(page.locator('#challenge-progress')).toContainText('bring it home');
  await page.screenshot({path:'artifacts/challenge-ready.png'});
  await page.evaluate(({x,z})=>{const g=(window as any).__sluger;g.place(x,z);g.step(4);},HOME);
  const won=await page.evaluate(()=>(window as any).__sluger.state());expect(won.phase).toBe('won');expect(won.score).toBe(ready.reward.total);expect(won.personalBest).toBe(won.score);
  await expect(page.locator('#challenge-result')).toContainText('+180 bonus secured');await page.screenshot({path:'artifacts/challenge-result.png'});
  await page.getByRole('button',{name:'Next night'}).click();
  const fresh=await page.evaluate(()=>(window as any).__sluger.state());expect(fresh.challenge.id).not.toBe('variety');expect(fresh.reward.challenge).toBe(0);expect(errors).toEqual([]);
});
test('nearby mower indicator points behind the camera and disappears at a safe distance',async({page})=>{
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(()=>{const g=(window as any).__sluger;g.place(4,-5.5);g.view([4,1,-9],[4,.3,-5.5]);document.getElementById('review-controls')!.hidden=true;});
  await page.waitForTimeout(50);await page.evaluate(()=>(window as any).__sluger.step(.01));
  await expect(page.locator('#mower-threat')).toContainText('behind');await page.screenshot({path:'artifacts/threat-behind.png'});
  await page.setViewportSize({width:390,height:700});await page.screenshot({path:'artifacts/polish-mobile.png'});
  const boxes=await page.evaluate(()=>{const map=document.querySelector('.map-wrap')!.getBoundingClientRect(),vitals=document.querySelector('.vitals')!.getBoundingClientRect();return {mapLeft:map.left,vitalsRight:vitals.right,scroll:document.documentElement.scrollWidth};});expect(boxes.mapLeft).toBeGreaterThan(boxes.vitalsRight);expect(boxes.scroll).toBe(390);
  await page.evaluate(()=>{const g=(window as any).__sluger;g.place(0,7);g.step(.01);});await expect(page.locator('#mower-threat')).toBeHidden();
});

test('a chase forfeits only the optional stealth bonus, not the raid',async({page})=>{
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(()=>{const g=(window as any).__sluger;g.challenge('quiet');g.place(0,2);g.gardener(0,1.2,0);g.step(1.3);});
  let result=await page.evaluate(()=>(window as any).__sluger.state());expect(result.challenge.failed).toBe(true);expect(result.phase).toBe('playing');
  await page.evaluate(()=>{const g=(window as any).__sluger;g.place(0,7);g.gardener(-10,-10,Math.PI);g.step(6);});
  result=await page.evaluate(()=>(window as any).__sluger.state());expect(result.alert).toBe(0);expect(result.challenge.failed).toBe(true);expect(result.reward.challenge).toBe(0);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start over',exact:true}).click();
  expect((await page.evaluate(()=>(window as any).__sluger.state())).challenge.failed).toBe(false);
});

test('new foraging challenges require a complete harvest',()=>{
  const stats={lilies:5,lettuce:3,chased:false,lawnLilies:2};
  expect(challengeStatus('lettuce',stats).ready).toBe(false);
  expect(challengeStatus('feast',stats).ready).toBe(false);
  expect(challengeStatus('lettuce',{...stats,lettuce:4}).ready).toBe(true);
  expect(challengeStatus('feast',{...stats,lilies:6}).ready).toBe(true);
});
