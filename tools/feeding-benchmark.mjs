import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5179/?test');await page.getByRole('button',{name:'Into the garden'}).click();
await page.waitForTimeout(2000);
const frames=[];
for(let i=0;i<8;i++){
  await page.evaluate(()=>{document.getElementById('restart').click();window.__sluger.place(-4.7,5);window.__sluger.gardener(-10,-10,Math.PI);});
  await page.waitForTimeout(250);await page.keyboard.down('e');
  const sample=await page.evaluate(()=>new Promise(resolve=>{let last=performance.now();const samples=[];function frame(now){const state=window.__sluger.state();if(state.lettuceEaten>0){resolve(samples);return;}samples.push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);}));
  await page.keyboard.up('e');frames.push(...sample.slice(1));
}
frames.sort((a,b)=>a-b);
const result={scenario:'8 actual lettuce meals, E held, first RAF after keydown excluded',width:1440,height:1000,dpr:1,frames:frames.length,fps:frames.length*1000/frames.reduce((a,b)=>a+b,0),median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],over20ms:frames.filter(t=>t>20).length};
console.log(JSON.stringify(result));writeFileSync('artifacts/feeding-performance.json',JSON.stringify(result,null,2));await browser.close();
