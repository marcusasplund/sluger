import { LETTUCE } from "../src/game/food";
import { test, expect, type Page } from "@playwright/test";
import { FLOWERS, HOME, WATER, SALT } from "../src/game/rules";
const state = (page: Page) =>
  page.evaluate(() => (window as any).__sluger.state());
const place = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => (window as any).__sluger.place(x, z), [x, z]);
const step = (page: Page, seconds: number) =>
  page.evaluate((s) => (window as any).__sluger.step(s), seconds);
const safeGardener = (page: Page) =>
  page.evaluate(() => (window as any).__sluger.gardener(-10, -10, Math.PI));

test("playable evening: input, eating, cover, water, camera, pause, victory, reset and defeat", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?test");
  await expect(page.locator("#loading")).toBeHidden();
  await page.getByRole("button", { name: "Into the garden" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  const before = await state(page);
  await page.keyboard.down("w");
  await step(page, 0.5);
  await page.keyboard.up("w");
  expect((await state(page)).player.z).toBeLessThan(before.player.z - 0.5);
  await page.keyboard.press("Escape");
  const paused = await state(page);
  await step(page, 2);
  expect((await state(page)).time).toBe(paused.time);
  await page.getByRole("button", { name: "Continue the evening" }).click();
  await place(page, FLOWERS[0].x, FLOWERS[0].z);
  await safeGardener(page);
  await page.keyboard.down("Control");
  await step(page, 0.1);
  expect((await state(page)).hidden).toBe(true);
  await page.keyboard.up("Control");
  await page.keyboard.down("e");
  await step(page, 1.3);
  await page.keyboard.up("e");
  expect((await state(page)).eaten).toBe(1);
  await expect(page.locator("#count")).toHaveText("33");
  await page.evaluate(() => (window as any).__sluger.stats(20, 70));
  await place(page, WATER[0].x, WATER[0].z);
  await step(page, 2);
  expect((await state(page)).moisture).toBeGreaterThan(45);
  await place(page, SALT[0].x, SALT[0].z);
  const hp = (await state(page)).health;
  await step(page, 0.5);
  expect((await state(page)).health).toBeLessThan(hp - 10);
  await page.keyboard.press("v");
  await page.screenshot({ path: "artifacts/overview.png" });
  await page.keyboard.press("v");
  await page.getByRole("button", { name: "Open settings" }).click();
  expect((await state(page)).phase).toBe("paused");
  await page.getByLabel("Weather").selectOption("rain");
  await page.getByLabel("Quality").selectOption("low");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect((await state(page)).phase).toBe("playing");
  for (let i = 1; i < FLOWERS.length; i++) {
    await safeGardener(page);
    if (i === 5 || i === 7) {
      await place(page, 0, 0);
      for(let wait=0;wait<100;wait++) {
        const m=(await state(page)).mower;
        if(Math.hypot(m.x-FLOWERS[i].x,m.z-FLOWERS[i].z)>3.5)break;
        await safeGardener(page);await step(page,.5);
      }
    }
    await place(page, FLOWERS[i].x, FLOWERS[i].z);
    await page.keyboard.down("e");
    await step(page, 1.3);
    await page.keyboard.up("e");
  }
  expect((await state(page)).eaten).toBe(8);
  expect((await state(page)).phase).toBe("playing");
  await expect(page.locator("#objective-stage")).toHaveText("HOME IS OPEN · RISK MORE?");
  await expect(page.locator("#mission")).toContainText("More food, bigger reward");
  await page.screenshot({ path: "artifacts/return-home.png" });
  await place(page, HOME.x, HOME.z);
  await step(page, 0.1);
  expect((await state(page)).phase).toBe("won");
  await expect(page.locator("#result-title")).toHaveText("Full. And home.");
  await page.screenshot({ path: "artifacts/victory.png" });
  await page.getByRole("button", { name: "One more evening" }).click();
  const reset = await state(page);
  expect(reset.eaten).toBe(0);
  expect(reset.health).toBe(100);
  expect(reset.alert).toBe(0);
  await expect(page.locator("#objective-stage")).toHaveText("FIND FOOD · FILL YOUR BELLY");
  await expect(page.locator("#hud")).not.toHaveClass(/return-home/);
  await place(page, SALT[0].x, SALT[0].z);
  await safeGardener(page);
  await step(page, 7);
  expect((await state(page)).phase).toBe("lost");
  await expect(page.locator("#result-description")).toContainText("Salt");
  await page.getByRole("button", { name: "Try again" }).click();
  await place(page, 0, 0);
  await page.evaluate(() => (window as any).__sluger.gardener(0, -2, 0));
  await step(page, 1.4);
  expect((await state(page)).alert).toBeGreaterThan(0.5);
  await page.screenshot({ path: "artifacts/detection.png" });
  expect(errors).toEqual([]);
});

test("mobile controls, settings and layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?test");
  await expect(page.locator("#loading")).toBeHidden();
  await page.screenshot({ path: "artifacts/mobile-intro.png" });
  await page.getByRole("button", { name: "Into the garden" }).click();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByLabel("Weather")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "artifacts/mobile-game.png" });
});

test("three lilies unlock a voluntary escape and eaten stems attract investigation", async ({ page }) => {
  await page.goto("/?test");
  await page.getByRole("button", { name: "Into the garden" }).click();
  for (let i = 0; i < 3; i++) {
    await safeGardener(page);
    await place(page, FLOWERS[i].x, FLOWERS[i].z);
    await page.keyboard.down("e");
    await step(page, 1.3);
    await page.keyboard.up("e");
    if (i === 1) {
      await place(page, HOME.x, HOME.z);
      await step(page, .1);
      expect((await state(page)).phase).toBe("playing");
    }
  }
  await expect(page.locator("#objective-stage")).toHaveText("HOME IS OPEN · RISK MORE?");
  await place(page, 10, 10);
  await page.evaluate(([x,z]) => (window as any).__sluger.gardener(x,z-1.5,0), [FLOWERS[0].x,FLOWERS[0].z]);
  await step(page, .1);
  expect((await state(page)).discovered).toContain(0);
  expect((await state(page)).investigation).toBe(0);
  await place(page, HOME.x, HOME.z);
  await step(page, .1);
  expect((await state(page)).phase).toBe("won");
  await expect(page.locator("#result-description")).toContainText("3/8 lilies");
  await expect(page.locator("#result-description")).toContainText("points");
  await page.getByRole("button", { name: "One more evening" }).click();
  expect((await state(page)).discovered).toEqual([]);
});

test("spade has a dodge window and fatal impact precedes the defeat screen", async ({ page }) => {
  const errors:string[]=[];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/?test");
  await page.getByRole("button", { name: "Into the garden" }).click();
  await place(page, 0, 2);
  await page.evaluate(() => (window as any).__sluger.gardener(0,1.2,0));
  await step(page, 1.35);
  expect((await state(page)).attackAge).toBeGreaterThanOrEqual(0);
  expect((await state(page)).health).toBe(100);
  await place(page, 4, 2);
  await step(page, .7);
  expect((await state(page)).health).toBe(100);
  await safeGardener(page);
  await page.evaluate(() => (window as any).__sluger.kill("chop"));
  expect((await state(page)).phase).toBe("dying");
  expect((await state(page)).fragments).toBe(0);
  await step(page, .7);
  expect((await state(page)).fragments).toBe(3);
  expect((await state(page)).phase).toBe("dying");
  await step(page, 3);
  expect((await state(page)).phase).toBe("lost");
  await page.getByRole("button", { name: "Try again" }).click();
  expect((await state(page)).fragments).toBe(0);
  expect((await state(page)).attackAge).toBe(-1);
  expect(errors).toEqual([]);
});

test("robot mower patrols the lawn, pauses, kills on contact and resets", async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?test');
  await page.getByRole('button',{name:'Into the garden'}).click();
  const initial=(await state(page)).mower;
  await step(page,2);
  const moved=(await state(page)).mower;
  expect(moved.z).toBeGreaterThan(initial.z+.5);
  await page.keyboard.press('Escape');
  const pausedMower=(await state(page)).mower;
  await step(page,2);
  expect((await state(page)).mower).toEqual(pausedMower);
  await page.getByRole('button',{name:'Continue the evening'}).click();
  await safeGardener(page);
  await place(page,3,-5);
  await page.keyboard.down('Control');await step(page,.1);
  expect((await state(page)).hidden).toBe(false);
  await page.keyboard.up('Control');
  await page.evaluate(()=>{const g=(window as any).__sluger;const m=g.state().mower;g.place(m.x,m.z);});
  await step(page,.05);
  expect((await state(page)).phase).toBe('dying');
  expect((await state(page)).fragments).toBe(3);
  await step(page,3);
  await expect(page.locator('#result-description')).toContainText('mower');
  await page.getByRole('button',{name:'Try again'}).click();
  expect((await state(page)).mower.x).toBe(4);
  expect((await state(page)).mower.z).toBe(-8);
  expect(errors).toEqual([]);
});

test("beer trap pulls in the slug, pauses the drowning sequence and resets cleanly", async ({page}) => {
  await page.goto('/?test');await page.getByRole('button',{name:'Into the garden'}).click();
  await safeGardener(page);
  const trap=(await state(page)).hazards.beer[0];
  await place(page,trap.x+1.4,trap.z);await step(page,.1);
  expect((await state(page)).phase).toBe('playing');
  await place(page,trap.x+1,trap.z);await step(page,.7);
  expect((await state(page)).phase).toBe('dying');
  expect((await state(page)).player.x).toBeLessThan(trap.x+.8);
  expect((await state(page)).fragments).toBe(0);
  await page.keyboard.press('Escape');const paused=(await state(page)).player;
  await step(page,3);expect((await state(page)).player).toEqual(paused);
  await page.getByRole('button',{name:'Continue the evening'}).click();
  await step(page,5);expect((await state(page)).phase).toBe('lost');
  await expect(page.locator('#result-description')).toContainText('drowned');
  await page.getByRole('button',{name:'Try again'}).click();
  expect((await state(page)).phase).toBe('playing');expect((await state(page)).health).toBe(100);
});

test("hazards change between rounds and poison persists until washed away", async ({page})=>{
  await page.goto('/?test');await page.getByRole('button',{name:'Into the garden'}).click();
  await safeGardener(page);
  const layout=(await state(page)).hazards;
  expect(layout.beer.length).toBeGreaterThanOrEqual(2);expect(layout.beer.length).toBeLessThanOrEqual(3);
  expect(layout.poison).toHaveLength(2);
  const bait=layout.poison[0];await place(page,bait.x,bait.z);await step(page,.7);
  expect((await state(page)).poison).toBeGreaterThan(.4);
  await expect(page.locator('#poison-status')).toBeVisible();
  await place(page,0,0);const hp=(await state(page)).health;await step(page,.7);
  expect((await state(page)).health).toBeLessThan(hp);
  await place(page,WATER[0].x,WATER[0].z);await step(page,2);
  expect((await state(page)).poison).toBe(0);
  await expect(page.locator('#poison-status')).toBeHidden();
  await place(page,bait.x,bait.z);await page.evaluate(()=>(window as any).__sluger.stats(100,4));await step(page,2);
  expect((await state(page)).phase).toBe('dying');await step(page,4);
  await expect(page.locator('#result-description')).toContainText('poisoned');
  await page.getByRole('button',{name:'Try again'}).click();
  expect((await state(page)).poison).toBe(0);
  expect((await state(page)).hazards.beer).not.toEqual(layout.beer);
});

test("lettuce is fast, restores moisture and can fill a whole meal without lilies",async({page})=>{
  await page.goto('/?test');await page.getByRole('button',{name:'Into the garden'}).click();
  await page.evaluate(()=>(window as any).__sluger.stats(30,100));
  for(let i=0;i<3;i++){
    await safeGardener(page);await place(page,LETTUCE[i].x,LETTUCE[i].z);
    await page.keyboard.down('e');await step(page,.75);await page.keyboard.up('e');
    expect((await state(page)).lettuceEaten).toBe(i+1);
  }
  const fed=await state(page);expect(fed.eaten).toBe(0);expect(fed.fullness).toBe(100);expect(fed.moisture).toBeGreaterThan(95);
  expect(fed.reward.food).toBe(120);expect(fed.discovered).toEqual([]);
  await place(page,HOME.x,HOME.z);await step(page,.1);expect((await state(page)).phase).toBe('won');
  await expect(page.locator('#result-description')).toContainText('3/4 lettuce');
  await page.getByRole('button',{name:'One more evening'}).click();expect((await state(page)).lettuceEaten).toBe(0);expect((await state(page)).fullness).toBe(0);
});

test("switching food does not carry over chewing progress and mixed food unlocks home",async({page})=>{
  await page.goto('/?test');await page.getByRole('button',{name:'Into the garden'}).click();await safeGardener(page);
  await place(page,FLOWERS[0].x,FLOWERS[0].z);await page.keyboard.down('e');await step(page,.7);
  await place(page,LETTUCE[0].x,LETTUCE[0].z);await step(page,.1);expect((await state(page)).lettuceEaten).toBe(0);
  await step(page,.6);await page.keyboard.up('e');
  for(let i=0;i<2;i++){await safeGardener(page);await place(page,FLOWERS[i].x,FLOWERS[i].z);await page.keyboard.down('e');await step(page,1.3);await page.keyboard.up('e');}
  expect((await state(page)).fullness).toBe(100);expect((await state(page)).reward.food).toBe(240);
  await place(page,HOME.x,HOME.z);await step(page,.1);expect((await state(page)).phase).toBe('won');
});

test("reaction audio renders audible unclipped vocals and respects mute",async({page})=>{
  await page.goto('/?test');await page.getByRole('button',{name:'Into the garden'}).click();
  const levels=await page.evaluate(async()=>{
    const {creatureVoice}=await import('/src/voice.ts' as string);
    const result=[];
    for(const kind of ['spade','salt','poison','noticed','tipsy','drown']){
      const ctx=new OfflineAudioContext(1,96000,48000);
      creatureVoice(ctx,ctx.destination,kind,()=>{});
      const data=(await ctx.startRendering()).getChannelData(0);
      let peak=0,power=0;for(const v of data){peak=Math.max(peak,Math.abs(v));power+=v*v;}
      result.push({kind,peak,rms:Math.sqrt(power/data.length)});
    }
    return result;
  });
  for(const level of levels){expect(level.rms,level.kind).toBeGreaterThan(.001);expect(level.peak,level.kind).toBeLessThan(.95);}
  await safeGardener(page);await place(page,SALT[0].x,SALT[0].z);await step(page,.3);
  expect((await state(page)).soundReactions.salt).toBe(1);
  await step(page,.2);expect((await state(page)).soundReactions.salt).toBe(1);
  await page.getByRole('button',{name:'Mute sound',exact:true}).click();
  const bait=(await state(page)).hazards.poison[0];await place(page,bait.x,bait.z);await step(page,.5);
  expect((await state(page)).soundReactions.poison??0).toBe(0);
  await page.getByRole('button',{name:'Enable sound',exact:true}).click();await step(page,.1);
  expect((await state(page)).soundReactions.poison).toBe(1);
  const trap=(await state(page)).hazards.beer[0];await place(page,trap.x+1,trap.z);await step(page,.1);
  expect((await state(page)).soundReactions.tipsy).toBe(1);
  await step(page,2.7);expect((await state(page)).soundReactions.drown).toBe(1);
});
