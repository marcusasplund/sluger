import {test,expect} from '@playwright/test';
import {PartnerJourney,readNest,saveNest,PARTNER,PARTNER_TRAIL,nearPartnerTrail} from '../src/game/partner';

test('meeting is optional, interruptible and succeeds once at different frame rates',()=>{
  for(const hz of [30,60,144]){
    const p=new PartnerJourney();expect(p.canNest(3,0,100)).toBe(false);
    p.meet(.6,true,true,false);p.meet(.1,true,true,true);expect(p.meeting).toBe(0);
    let successes=0;for(let i=0;i<3*hz;i++)successes+=Number(p.meet(1/hz,true,true,false));
    expect(successes).toBe(1);expect(p.met).toBe(true);
    p.reset();expect(p.met).toBe(false);expect(p.discovered).toBe(false);
  }
});
test('nest requires meeting, full meal and moisture; a clutch can only be laid once',()=>{
  const p=new PartnerJourney();p.meet(2,true,true,false);
  expect(p.lay(0,2,100)).toBe(0);expect(p.lay(0,3,44.99)).toBe(0);
  expect(p.lay(0,3,45)).toBe(6);expect(p.lay(8,4,100)).toBe(0);
  p.reset();expect(p.laid).toBe(false);expect(p.canNest(8,4,100)).toBe(false);
});
test('nest storage rejects malformed saves and tolerates blocked persistence',()=>{
  for(const value of ['null','{}','oops','{"clutches":-1}','{"clutches":1.5}','{"clutches":"2"}','{"clutches":10000000000}'])expect(readNest({getItem:()=>value})).toBe(0);
  expect(readNest({getItem:()=>'{"clutches":2}'})).toBe(2);
  expect(readNest({getItem:()=>{throw Error('blocked');}})).toBe(0);
  expect(saveNest({setItem:()=>{throw Error('blocked');}},1)).toBe(false);
  let saved='';expect(saveNest({setItem:(_key,value)=>{saved=value;}},3)).toBe(true);expect(JSON.parse(saved).clutches).toBe(3);
});
test('trail can be discovered between waypoints and reaches the companion',()=>{
  const a=PARTNER_TRAIL[0],b=PARTNER_TRAIL[1];expect(nearPartnerTrail((a.x+b.x)/2,(a.z+b.z)/2,.1)).toBe(true);
  expect(nearPartnerTrail(PARTNER.x,PARTNER.z,.1)).toBe(true);expect(nearPartnerTrail(8,-4,.5)).toBe(false);
});
