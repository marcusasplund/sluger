import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const version of ['baseline','updated']) for(const size of [{width:1440,height:1000,dpr:1},{width:1728,height:1117,dpr:2}]) {
  const page=await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:size.dpr});
  await page.addInitScript(()=>{let seed=12345;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(`http://127.0.0.1:${version==='baseline'?5180:5179}/?test`);
  await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(()=>{window.__sluger.place(0,7);window.__sluger.gardener(-10,-10,Math.PI);});
  await page.waitForTimeout(3000);
  const metrics=await page.evaluate(()=>new Promise(resolve=>{
    const times=[],calls=[];let start=performance.now(),last=start;
    function frame(now){times.push(now-last);calls.push(window.__sluger.state().calls);last=now;if(now-start>=5000){times.sort((a,b)=>a-b);resolve({fps:times.length*1000/(now-start),median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],over20ms:times.filter(t=>t>20).length,drawCallsMin:Math.min(...calls),drawCallsMax:Math.max(...calls),frames:times.length,state:window.__sluger.state()});}else requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
  }));
  results.push({version,...size,...metrics});console.log(JSON.stringify(results.at(-1)));await page.close();
}
writeFileSync('artifacts/feel-performance.json',JSON.stringify(results,null,2));await browser.close();
