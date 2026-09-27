import {test,expect,type Page} from '@playwright/test';
import {PARTNER,PARTNER_TRAIL,NEST_KEY} from '../src/game/partner';
import {LETTUCE} from '../src/game/food';
import {HOME} from '../src/game/rules';
const state=(p:Page)=>p.evaluate(()=>(window as any).__sluger.state());
const step=(p:Page,s:number)=>p.evaluate(s=>(window as any).__sluger.step(s),s);
const place=(p:Page,x:number,z:number)=>p.evaluate(([x,z])=>{(window as any).__sluger.place(x,z);(window as any).__sluger.gardener(-10,-10,Math.PI);},[x,z]);
async function start(p:Page){await p.goto('/?test');await p.getByRole('button',{name:'Into the garden'}).click();}
async function meet(p:Page){await place(p,PARTNER.x,PARTNER.z+1.2);await p.keyboard.down('e');await step(p,2.1);await p.keyboard.up('e');expect((await state(p)).partner.met).toBe(true);}
async function feed(p:Page){for(const f of LETTUCE.slice(0,3)){await place(p,f.x,f.z);await p.keyboard.down('e');await step(p,.7);await p.keyboard.up('e');}}

test('discover trail, interrupt greeting, pause and complete meeting with existing E',async({page})=>{
  await start(page);expect((await state(page)).partner.discovered).toBe(false);
  await place(page,PARTNER_TRAIL[0].x,PARTNER_TRAIL[0].z);await step(page,.1);expect((await state(page)).partner.discovered).toBe(true);
  await expect(page.locator('#next-generation')).toContainText('silver trail');
  await place(page,PARTNER.x,PARTNER.z+1.2);await page.keyboard.down('e');await step(page,.5);await page.keyboard.up('e');await step(page,.1);
  expect((await state(page)).partner.meeting).toBe(0);expect((await state(page)).eaten).toBe(0);
  await page.keyboard.down('e');await step(page,.5);await page.keyboard.press('Escape');const paused=await state(page);await step(page,3);
  expect((await state(page)).partner.meeting).toBe(paused.partner.meeting);
  await page.keyboard.up('e');await page.getByRole('button',{name:'Continue the evening'}).click();await meet(page);
  expect((await state(page)).lettuceEaten).toBe(0);await expect(page.locator('#next-generation')).toContainText('45% moisture');
});

test('a full evening can still end without a companion or eggs',async({page})=>{
  await start(page);await feed(page);await place(page,HOME.x,HOME.z);await step(page,3.2);
  expect((await state(page)).phase).toBe('won');expect((await state(page)).nest.eggs).toBe(0);
});

test('meeting plus food and moisture lays one clutch, preserves score, persists through reset and reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);await meet(page);await feed(page);const reward=(await state(page)).reward;
  await place(page,HOME.x,HOME.z);await step(page,.1);expect((await state(page)).phase).toBe('playing');
  await expect(page.locator('#interaction-text')).toContainText('Lay 6 eggs');
  const before=(await state(page)).moisture;
  await page.keyboard.down('e');await step(page,.2);await page.keyboard.up('e');expect((await state(page)).phase).toBe('homecoming');
  await page.keyboard.press('Escape');await step(page,4);expect((await state(page)).nest.eggs).toBe(0);
  await page.getByRole('button',{name:'Continue the evening'}).click();await step(page,4.5);
  const result=await state(page);expect(result.phase).toBe('won');expect(result.nest.eggs).toBe(6);expect(result.nest.visibleEggs).toBe(6);expect(result.moisture).toBeCloseTo(before-20,0);expect(result.score).toBe(reward.total);
  await expect(page.locator('#nest-result')).toContainText('6 eggs laid');await step(page,4);expect((await state(page)).nest.eggs).toBe(6);
  await page.getByRole('button',{name:'One more evening'}).click();expect((await state(page)).partner.met).toBe(false);expect((await state(page)).nest.eggs).toBe(6);
  await page.reload();expect((await state(page)).nest.eggs).toBe(6);await expect(page.locator('#intro-nest')).toContainText('6 eggs');expect(errors).toEqual([]);
});

test('too little moisture explains the requirement and shelter without eggs remains available',async({page})=>{
  await start(page);await meet(page);await feed(page);await page.evaluate(()=>(window as any).__sluger.stats(30,100));
  await place(page,HOME.x,HOME.z);await page.keyboard.down('e');await step(page,.4);await page.keyboard.up('e');
  expect((await state(page)).phase).toBe('playing');await expect(page.locator('#interaction-text')).toContainText('Too dry');
  await page.getByRole('button',{name:'Shelter without eggs'}).click();await step(page,3.2);
  expect((await state(page)).phase).toBe('won');expect((await state(page)).nest.eggs).toBe(0);
});

test('restart before egg deposition cancels the clutch; corrupt or denied storage never blocks play',async({page})=>{
  await page.addInitScript(key=>{localStorage.setItem(key,'broken');Storage.prototype.setItem=()=>{throw Error('blocked');};},NEST_KEY);
  await start(page);expect((await state(page)).nest.eggs).toBe(0);await meet(page);await feed(page);
  await place(page,HOME.x,HOME.z);await page.keyboard.down('e');await step(page,1.9);await page.keyboard.up('e');
  expect((await state(page)).nest.visibleEggs).toBeGreaterThan(0);expect((await state(page)).nest.eggs).toBe(0);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Start over',exact:true}).click();await step(page,3);expect((await state(page)).nest.eggs).toBe(0);expect((await state(page)).partner.met).toBe(false);
  await meet(page);await feed(page);await place(page,HOME.x,HOME.z);await page.keyboard.down('e');await step(page,4.5);await page.keyboard.up('e');
  expect((await state(page)).nest.eggs).toBe(6);expect((await state(page)).nest.saved).toBe(false);await expect(page.locator('#nest-result')).toContainText('this session');
});


test('touch meeting and nest choice work on a narrow screen with reduced motion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:700},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  await start(page);await place(page,PARTNER.x,PARTNER.z+1.2);await step(page,.1);
  const action=page.locator('#touch-action');await expect(action).toHaveText('Meet');await expect(action).toBeVisible();
  const box=(await action.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await step(page,2.1);await page.mouse.up();
  expect((await state(page)).partner.met).toBe(true);
  await feed(page);await place(page,HOME.x,HOME.z);await step(page,.1);await expect(action).toHaveText('Nest');
  const bounds=(await page.locator('#interaction').boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);
  const nestButton=(await action.boundingBox())!;await page.mouse.move(nestButton.x+nestButton.width/2,nestButton.y+nestButton.height/2);await page.mouse.down();await step(page,.1);await page.mouse.up();await step(page,3.1);
  expect((await state(page)).nest.eggs).toBe(6);expect((await state(page)).phase).toBe('won');await context.close();
});
