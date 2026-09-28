import assert from 'node:assert/strict';
import {test,expect} from '@playwright/test';
import {gardenLayout,trailClear,GARDEN_ROCKS} from '../src/game/layout';
import {FLOWERS,HOME,distance} from '../src/game/rules';
import {LETTUCE} from '../src/game/food';
import {HAZARD_SITES,hazardLayout} from '../src/game/hazards';
import {onLawn} from '../src/game/lawn';
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};

test('generated gardens keep hazards, water, food and companion safely separated across 300 seeds',()=>{
  const partners=new Set<string>(),waters=new Set<string>(),salts=new Set<string>();
  for(let seed=0;seed<300;seed++){
    const layout=gardenLayout(seeded(seed));
    partners.add(JSON.stringify(layout.partner));waters.add(JSON.stringify(layout.water));salts.add(JSON.stringify(layout.salt));
    assert.equal((layout.water).length,3);assert.equal((layout.salt).length,3);
    assert.ok((layout.water[0].z)>=(2.4));
    assert.ok((layout.water[1].z)>=(-2.4));assert.ok((layout.water[1].z)<=(1.2));
    assert.ok((layout.water[2].z)<=(-4.4));
    const areas=[...layout.water,...layout.salt,{...layout.partner,radius:.8}];
    for(const [i,a] of areas.entries()){
      assert.equal(onLawn(a),false);assert.ok(Math.abs(a.x)-a.radius>1.05);
      assert.ok((distance(a,HOME))>(2.5));
      for(const b of areas.slice(i+1))assert.ok((distance(a,b))>(a.radius+b.radius+.24));
      for(const p of HAZARD_SITES)assert.ok((distance(a,p))>(a.radius+1.44));
      for(const p of [...FLOWERS,...LETTUCE])assert.ok((distance(a,p))>(a.radius+.79));
      for(const [x,z,r] of GARDEN_ROCKS)assert.ok((distance(a,{x,z}))>(a.radius+r*.76+.24));
    }
    assert.deepEqual(layout.trail.at(-1),layout.partner);
    for(const p of layout.trail){
      assert.equal(onLawn(p),false);
      for(const h of HAZARD_SITES)assert.ok((distance(p,h))>(1.65));
    }
    for(const salt of layout.salt)assert.equal(trailClear(salt,layout.trail),true);
  }
  assert.ok((partners.size)>(30));assert.ok((waters.size)>(100));assert.ok((salts.size)>(100));
});

test('constant random sources terminate and seeded generation is reproducible',()=>{
  for(const random of [()=>0,()=>.5,()=>.999999])expect(gardenLayout(random).salt).toHaveLength(3);
  expect(gardenLayout(seeded(123))).toEqual(gardenLayout(seeded(123)));
});

test('a fresh garden relocates landmarks, retries preserve them, and rendered water and salt match gameplay',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?test&review');await page.getByRole('button',{name:'Into the garden'}).click();
  const state=()=>page.evaluate(()=>(window as any).__sluger.state());
  const before=(await state()).garden;
  await page.evaluate(()=>{const d=(window as any).__sluger,p=d.state().garden.water[0];d.gardener(-10,-10,Math.PI);d.stats(20,100);d.place(p.x,p.z);d.step(2);d.view([p.x+1.6,1.5,p.z+2],[p.x,0,p.z]);document.getElementById('review-controls')!.hidden=true;});
  expect((await state()).moisture).toBeGreaterThan(40);
  await page.screenshot({path:'artifacts/random-puddle.png'});
  await page.evaluate(()=>{const d=(window as any).__sluger,p=d.state().garden.salt[0];d.place(p.x,p.z);d.step(.5);});
  expect((await state()).health).toBeLessThan(90);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start over',exact:true}).click();
  expect((await state()).garden).toEqual(before);
  const partner=(await state()).partner.position;
  await page.evaluate(p=>{const d=(window as any).__sluger;d.gardener(-10,-10,Math.PI);d.place(p.x,p.z+.7);d.view([p.x+2,1.5,p.z+2],[p.x,.2,p.z]);},partner);
  await page.keyboard.down('e');await page.evaluate(()=>(window as any).__sluger.step(2.1));await page.keyboard.up('e');
  expect((await state()).partner.met).toBe(true);
  await page.screenshot({path:'artifacts/random-companion.png'});
  await page.reload();expect((await state()).garden).not.toEqual(before);
  expect(errors).toEqual([]);
});


test('defended beds still get randomized poison without overlapping beer',()=>{
  for(const side of ['west','east'] as const){
    const variants=new Set<string>();
    for(let seed=0;seed<50;seed++){
      const layout=hazardLayout([],seeded(seed),side);
      expect(layout.poison).toHaveLength(3);
      expect(layout.poison.some(i=>layout.beer.includes(i))).toBe(false);
      const preferred=HAZARD_SITES.map((p,i)=>({p,i})).filter(({p,i})=>!layout.beer.includes(i)&&(side==='west'?p.x<0:p.x>0));
      expect(layout.poison.filter(i=>preferred.some(p=>p.i===i))).toHaveLength(Math.min(3,preferred.length));
      variants.add([...layout.poison].sort().join(','));
    }
    expect(variants.size).toBeGreaterThan(3);
  }
});
