import {test,expect,type Page} from '@playwright/test';
import {LETTUCE} from '../src/game/food';
import {HOME} from '../src/game/rules';
const state=(p:Page)=>p.evaluate(()=>(window as any).__sluger.state());
const step=(p:Page,s:number)=>p.evaluate(s=>(window as any).__sluger.step(s),s);
const place=(p:Page,x:number,z:number)=>p.evaluate(([x,z])=>{(window as any).__sluger.place(x,z);(window as any).__sluger.gardener(-10,-10,Math.PI);},[x,z]);
async function start(p:Page){await p.goto('/?test');await p.getByRole('button',{name:'Into the garden'}).click();}

test('ordinary controls escape beer from centre; pause freezes grace; recovery clears wobble',async({page})=>{
  await start(page);const trap=(await state(page)).hazards.beer[0];
  await place(page,trap.x,trap.z);await step(page,.3);
  expect((await state(page)).phase).toBe('playing');expect((await state(page)).beer.stage).toBe('danger');
  await page.keyboard.press('Escape');const paused=await state(page);await step(page,3);
  expect((await state(page)).beer.exposure).toBe(paused.beer.exposure);
  await page.getByRole('button',{name:'Continue the evening'}).click();
  await page.keyboard.down('s');await step(page,1.6);await page.keyboard.up('s');
  expect((await state(page)).phase).toBe('playing');expect((await state(page)).beer.stage).toBe('recovering');
  await step(page,1.5);expect((await state(page)).beer.exposure).toBe(0);
});

test('partial bites persist without credit; completed meal credits once; reset restores leaves',async({page})=>{
  await start(page);const food=LETTUCE[0];await place(page,food.x,food.z);
  await page.keyboard.down('e');await step(page,.25);await page.keyboard.up('e');
  const partial=await state(page);expect(partial.lettuceEaten).toBe(0);expect(partial.feeding.remainingLeaves[0]).toBeLessThan(18);
  await place(page,0,7);await step(page,.3);await place(page,food.x,food.z);await step(page,.1);
  expect((await state(page)).eat).toBeCloseTo(partial.eat,1);
  await page.keyboard.down('e');await step(page,.5);await page.keyboard.up('e');
  expect((await state(page)).lettuceEaten).toBe(1);await step(page,1);expect((await state(page)).lettuceEaten).toBe(1);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start over',exact:true}).click();
  expect((await state(page)).feeding.remainingLeaves).toEqual([18,18,18,18]);expect((await state(page)).lettuceEaten).toBe(0);
});

test('shelter pauses, protects, counts exact reward and persists best after reload',async({page})=>{
  await start(page);
  for(const food of LETTUCE.slice(0,3)) {await place(page,food.x,food.z);await page.keyboard.down('e');await step(page,.7);await page.keyboard.up('e');}
  const reward=(await state(page)).reward;
  await place(page,HOME.x,HOME.z);await step(page,.1);expect((await state(page)).phase).toBe('homecoming');
  await expect(page.locator('#result')).toBeHidden();await page.keyboard.press('Escape');
  const paused=await state(page);await step(page,2);expect((await state(page)).homeAge).toBe(paused.homeAge);
  await page.getByRole('button',{name:'Continue the evening'}).click();await step(page,3.2);
  expect((await state(page)).phase).toBe('won');expect((await state(page)).score).toBe(reward.total);
  await expect(page.locator('#food-score')).toHaveText(String(reward.food));await expect(page.locator('#risk-score')).toHaveText(String(reward.bonus));
  await page.reload();await expect(page.locator('#intro-best')).toContainText(String(reward.total));
  await page.getByRole('button',{name:'Into the garden'}).click();expect((await state(page)).personalBest).toBe(reward.total);expect((await state(page)).homeAge).toBe(0);
});

test('unavailable storage and reduced motion still allow home, exact score and restart',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};});
  await start(page);
  for(const food of LETTUCE.slice(0,3)){await place(page,food.x,food.z);await page.keyboard.down('e');await step(page,.7);await page.keyboard.up('e');}
  await place(page,HOME.x,HOME.z);await step(page,1.8);
  expect((await state(page)).score).toBe((await state(page)).reward.total);
  await page.getByRole('button',{name:'One more evening'}).click();
  expect((await state(page)).phase).toBe('playing');
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Start over',exact:true})).toBeVisible();
  await expect(page.locator('#score-summary')).toBeHidden();
});

test('restart during homecoming cancels transition and restores controls',async({page})=>{
  await start(page);
  for(const food of LETTUCE.slice(0,3)){await place(page,food.x,food.z);await page.keyboard.down('e');await step(page,.7);await page.keyboard.up('e');}
  await place(page,HOME.x,HOME.z);await step(page,.2);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Start over',exact:true}).click();await step(page,2);
  expect((await state(page)).phase).toBe('playing');expect((await state(page)).homeAge).toBe(0);expect((await state(page)).lettuceEaten).toBe(0);
  await page.keyboard.down('w');await step(page,.4);await page.keyboard.up('w');expect((await state(page)).player.z).toBeLessThan(7.3);
});
