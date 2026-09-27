import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const scenario of ['companion','saved eggs']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.addInitScript(()=>localStorage.setItem('sluger.nest.v1','{"clutches":1}'));
  await page.goto('http://127.0.0.1:5179/?test');await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(s=>{window.__sluger.gardener(-10,-10,Math.PI);if(s==='companion'){window.__sluger.place(-6,-3.4);window.__sluger.view([-4,1.5,-2.1],[-6,.3,-4]);}else {window.__sluger.place(0,8.2);window.__sluger.view([2,1.8,7],[0,.2,10]);}},scenario);
  await page.keyboard.down('Control');await page.waitForTimeout(3000);
  if(scenario==='companion')await page.keyboard.down('e');
  const metrics=await page.evaluate(()=>new Promise(resolve=>{const times=[];const start=performance.now();let last=start;function frame(now){times.push(now-last);last=now;if(now-start>=5000){times.sort((a,b)=>a-b);resolve({fps:times.length*1000/(now-start),p95:times[Math.floor(times.length*.95)],frames:times.length,over20ms:times.filter(t=>t>20).length,state:window.__sluger.state()});}else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
  results.push({scenario,...metrics});console.log(JSON.stringify(results.at(-1)));await page.close();
}
writeFileSync('artifacts/partner-performance.json',JSON.stringify(results,null,2));await browser.close();
