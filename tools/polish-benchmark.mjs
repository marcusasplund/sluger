import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1728,height:1117},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5179/?test');await page.getByRole('button',{name:'Into the garden'}).click();await page.waitForTimeout(1800);
const results=[];
for(const scenario of ['walking','lawn warning','companion']){
  await page.evaluate(s=>{const g=window.__sluger;g.gardener(-10,-10,Math.PI);if(s==='walking')g.place(0,6);else if(s==='lawn warning'){g.place(3,-5);g.view([2.6,1.4,-2],[5,.2,-6]);}else{g.place(-6,-3.4);g.view([-4,1.5,-2.1],[-6,.3,-4]);}},scenario);
  if(scenario==='walking')await page.keyboard.down('w');
  await page.waitForTimeout(800);
  const metrics=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];const start=performance.now();let last=start;function frame(now){intervals.push(now-last);last=now;if(now-start>=3000){intervals.sort((a,b)=>a-b);resolve({fps:intervals.length*1000/(now-start),p95:intervals[Math.floor(intervals.length*.95)],state:window.__sluger.state()});}else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
  await page.keyboard.up('w');results.push({scenario,...metrics});await page.screenshot({path:`artifacts/polish-${scenario.replaceAll(' ','-')}.png`});console.log(JSON.stringify(results.at(-1)));
}
await writeFile('artifacts/polish-performance.json',JSON.stringify({results,errors},null,2));await browser.close();if(errors.length)throw new Error(errors.join('\n'));
