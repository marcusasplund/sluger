import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1728,height:1117},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/?test');await page.locator('#loading').waitFor({state:'hidden'});await page.waitForTimeout(2000);
await page.screenshot({path:'artifacts/intro.png'});await page.getByRole('button',{name:'Into the garden'}).click();await page.waitForTimeout(1000);
await page.screenshot({path:'artifacts/gameplay.png'});
async function measure(label){const r=await page.evaluate(()=>new Promise(resolve=>{let start=performance.now(),last=start;const intervals=[];const frame=now=>{intervals.push(now-last);last=now;if(now-start>3000){intervals.sort((a,b)=>a-b);resolve({fps:Math.round(intervals.length*1000/(now-start)),p95:intervals[Math.floor(intervals.length*.95)],state:window.__sluger.state()});}else requestAnimationFrame(frame);};requestAnimationFrame(frame);}));console.log(JSON.stringify({label,...r}));return{label,...r};}
const results=[];results.push(await measure('path, balanced, 1728×1117 @ DPR 2'));
await page.evaluate(()=>{window.__sluger.place(-5,4);window.__sluger.gardener(10,-10,0);});await page.keyboard.down('w');results.push(await measure('moving through dense planting'));await page.keyboard.up('w');await page.keyboard.down('Control');await page.waitForTimeout(200);await page.screenshot({path:'artifacts/cover.png'});await page.keyboard.up('Control');
await page.keyboard.press('v');await page.waitForTimeout(300);await page.screenshot({path:'artifacts/overview.png'});await page.keyboard.press('v');
await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Weather').selectOption('rain');await page.getByRole('button',{name:'Back',exact:true}).click();results.push(await measure('rain, balanced'));await page.screenshot({path:'artifacts/rain.png'});
await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Quality').selectOption('high');await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForTimeout(1000);await page.screenshot({path:'artifacts/high.png'});
console.log(JSON.stringify({errors}));await writeFile('artifacts/performance.json',JSON.stringify({results,errors},null,2));await browser.close();
