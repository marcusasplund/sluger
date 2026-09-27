import { BeerEscape } from "./game/beer";
import { FeedingVisuals } from "./feeding";
import { LETTUCE, FOOD, fullness, canGoHome } from "./game/food";
import { GardenHazards } from "./hazards";
import { poisonStep } from "./game/hazards";
import { RobotMower } from "./mower";
import { LAWN, onLawn, mowerHit } from "./game/lawn";
import { STRIKE_IMPACT, STRIKE_DURATION, raidReward } from "./game/raid";
import "./style.css";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { DeathEffects, type DeathCause } from "./death";
import { SoundDirector } from "./sound";
import { GardenerLife, animateSlug } from "./life";
import { Puddles } from "./puddles";
import { cloudLayer } from "./atmosphere";
import { buildWorld, buildSlug, height, supportedHeight, random, mesh, material } from "./world";
import {
  FLOWERS,
  HOME,
  WATER,
  SALT,
  PATROL,
  covered,
  distance,
  move,
  visible,
  survival,
} from "./game/rules";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<div class="cinema"></div>
<header class="topbar"><div class="brand">SLUGER<span>A SMALL LIFE. A BIG GARDEN.</span></div><div class="top-actions"><span id="fps">— FPS</span><button id="sound" aria-label="Enable sound" title="Sound">SOUND OFF</button><button id="settings-toggle" aria-label="Open settings">SETTINGS</button><button id="pause" aria-label="Pause game" hidden>Ⅱ</button></div></header>
<section id="intro" class="panel intro"><div class="eyebrow"><span></span> AN EVENING IN THE GARDEN</div><h1>Their garden.<br><em>Your dinner.</em></h1><p>You're small, hungry and not particularly welcome.<br>Fill up on lettuce and lilies. Risk more for a bigger feast.<br>Make it home before the evening claims you.</p><button id="start" class="primary">Into the garden <span>↗</span></button><div class="intro-controls"><span><kbd>W A S D</kbd> Crawl</span><span><kbd>E</kbd> Eat</span><span><kbd>Ctrl</kbd> Sneak</span></div><small>Headphones on. The world is bigger down here.</small><p id="intro-best"></p></section>
<div id="hud" hidden><section class="objective"><div class="eyebrow" id="objective-stage">FIND FOOD · FILL YOUR BELLY</div><div><strong id="count">0</strong><span>/ 100% FULL</span></div><p id="food-count">0/8 lilies · 0/4 lettuce</p><p id="mission">Lettuce for moisture. Lilies for points. Get full, then get home.</p></section><div id="alert"><span id="alert-label">THE GARDENER SUSPECTS SOMETHING</span><div><i id="alert-fill"></i></div></div><section class="vitals"><div class="state-line"><span id="cover">OUT IN THE OPEN</span><span id="time">00:00</span></div><label>MOISTURE <span id="moisture-text">100%</span></label><div class="meter"><i id="moisture"></i></div><label>HEALTH <span id="health-text">100%</span></label><div class="meter health"><i id="health"></i></div><p id="poison-status" role="status" hidden style="color:#8ed5de"></p><p>Hold <kbd>Shift</kbd> to slide faster</p></section><div class="map-wrap"><div class="map-title">THE GARDEN <span>N ↑</span></div><canvas id="map" width="180" height="180" aria-label="Map: lilies, water, salt, gardener and home"></canvas><div class="map-legend"><span>✳ Lily</span><span style="color:#b8dc72">● Lettuce</span><span>⌂ Home</span><span class="water-key">● Water</span><span style="color:#ff9859">● Mower</span><span style="color:#e3b255">● Beer</span><span style="color:#53b7e3">● Poison</span></div></div><div class="bottom-hint"><kbd>WASD</kbd> Crawl <b>·</b> <kbd>E</kbd> Eat <b>·</b> <kbd>Ctrl</kbd> Sneak <b>·</b> Drag to look around <b>·</b> <kbd>V</kbd> Camera <b>·</b> <kbd>Esc</kbd> Pause</div><div id="interaction"><span id="interaction-text"></span><div id="eat-track"><i id="eat-progress"></i></div></div><div id="beer-warning" role="status" hidden><strong id="beer-label"></strong><p id="beer-help"></p><meter id="beer-meter" min="0" max="2.4" value="2.4" aria-label="Time to escape"></meter></div><div id="toast" role="status" aria-live="polite"></div><div id="damage"></div></div>
<section id="settings" class="settings" hidden><div class="eyebrow">GARDEN ATMOSPHERE</div><h2>Light & mood</h2><label>Evening light <input id="sun" type="range" min="2" max="35" value="9"></label><label>Sun direction <input id="azimuth" type="range" min="0" max="360" value="290"></label><label>Weather <select id="weather"><option value="clear">After the rain</option><option value="rain">Gentle rain</option></select></label><label>Quality <select id="quality"><option value="high">High</option><option value="balanced" selected>Balanced</option><option value="low">Low</option></select></label><label>Volume <input id="volume" type="range" min="0" max="100" value="35"></label><p>Water restores moisture. Rain helps too.<br>Settings pause the game.</p><button id="settings-close">Back</button></section>
<section id="result" class="panel result" hidden><div class="eyebrow" id="result-tag">A LITTLE BREAK</div><h1 id="result-title">Under a leaf.</h1><p id="result-description">The garden is waiting.</p><div id="score-summary" hidden><div class="score-total"><strong id="score-total">0</strong> points</div><dl><div><dt id="food-score-label">Food</dt><dd id="food-score"></dd></div><div><dt>Risk bonus</dt><dd id="risk-score"></dd></div><div><dt>Health bonus</dt><dd id="health-score"></dd></div></dl><p id="bonus-rule"></p><p id="personal-best"></p></div><button id="resume" class="primary">Continue the evening <span>↗</span></button><button id="restart" class="secondary">Start over</button></section>
<div id="touch" hidden><div class="dpad"><button data-key="w" aria-label="Forward">↑</button><button data-key="a" aria-label="Left">←</button><button data-key="s" aria-label="Backward">↓</button><button data-key="d" aria-label="Right">→</button></div><div><button data-key="control">Sneak</button><button data-key="e">Eat</button></div></div>
<div class="loading" id="loading">A garden awakens<span></span></div>`;
const el = (id: string) => document.getElementById(id)!;
const show = (id: string, on: boolean) => (el(id).hidden = !on);
const scene = new T.Scene();
scene.background = new T.Color("#adbaa2");
scene.fog = new T.FogExp2("#acb39a", 0.022);
let renderer: T.WebGLRenderer;
try {
  renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch {
  el("loading").innerHTML =
    "WebGL could not start. Enable hardware acceleration in your browser and reload.";
  throw new Error("WebGL unavailable");
}
let quality = "balanced",
  postEnabled = false,
  autoResolution = true;
const balancedRatio = () =>
  Math.min(
    devicePixelRatio,
    1.5,
    Math.sqrt(2_000_000 / (innerWidth * innerHeight)),
  );
renderer.setPixelRatio(balancedRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.className = "world";
renderer.domElement.setAttribute("aria-label", "Sluger's garden");
app.prepend(renderer.domElement);
const camera = new T.PerspectiveCamera(
  58,
  innerWidth / innerHeight,
  0.045,
  160,
);
const sky = new Sky();
sky.scale.setScalar(150);
scene.add(sky);
sky.material.uniforms.turbidity.value = 3.2;
sky.material.uniforms.rayleigh.value = 1.5;
sky.material.uniforms.mieCoefficient.value = 0.004;
sky.material.uniforms.mieDirectionalG.value = 0.85;
const hemi = new T.HemisphereLight("#c6d5e3", "#5c5134", 1.65);
scene.add(hemi);
const sun = new T.DirectionalLight("#ffdab0", 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 75;
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00015;
sun.shadow.radius = 3;
scene.add(sun);
scene.add(sun.target);
const sunDirection = new T.Vector3();
let sunElevation = 9,
  sunAzimuth = 290,
  rainy = false;
const pmrem = new T.PMREMGenerator(renderer);
function lighting(regenerate = false) {
  sunDirection.setFromSphericalCoords(
    1,
    T.MathUtils.degToRad(90 - sunElevation),
    T.MathUtils.degToRad(sunAzimuth),
  );
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  sun.position.copy(sunDirection).multiplyScalar(35);
  sun.position.y = Math.max(8, sun.position.y);
  sun.intensity = rainy ? 1.1 : 3.2;
  hemi.intensity = rainy ? 1.5 : 1.65;
  scene.fog = new T.FogExp2(
    rainy ? "#899a91" : "#acb39a",
    rainy ? 0.023 : 0.009,
  );
  if (regenerate) {
    const envScene = new T.Scene();
    const envSky = sky.clone();
    envScene.add(envSky);
    const env = pmrem.fromScene(envScene, 0.05, 0.1, 200);
    const previous = scene.environment;
    scene.environment = env.texture;
    previous?.dispose();
    scene.environmentIntensity = 0.35;
  }
}
lighting(true);
const clouds = cloudLayer(scene);
const world = buildWorld(scene);
const mower = new RobotMower(scene, supportedHeight);
const hazards = new GardenHazards(scene, supportedHeight);
const puddles = new Puddles(scene,world.soilTex,height,sunDirection);
const creature = buildSlug(scene);
const { slug } = creature;
let slugActivity=0,slugTurn=0;
const sound=new SoundDirector();
const death=new DeathEffects(scene,creature,supportedHeight);
death.onImpact=()=>sound.chop();
renderer.info.autoReset = false;
let composer: EffectComposer | undefined;
function getComposer() {
  if (!composer) {
    composer = new EffectComposer(
      renderer,
      new T.WebGLRenderTarget(innerWidth, innerHeight, {
        type: T.HalfFloatType,
        samples: 2,
      }),
    );
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.12, 0.4, 3),
    );
    composer.addPass(new OutputPass());
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(innerWidth, innerHeight);
  }
  return composer;
}
renderer.shadowMap.autoUpdate = false;
let shadowElapsed = 1,
  hudElapsed = 0,
  slowWindows = 0,
  fastWindows = 0;
// Soft grounded contact shadow complements the directional shadow at macro scale.
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 64;
const sh = shadowCanvas.getContext("2d")!;
const gradient = sh.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, "rgba(0,0,0,.65)");
gradient.addColorStop(1, "rgba(0,0,0,0)");
sh.fillStyle = gradient;
sh.fillRect(0, 0, 64, 64);
const contact = new T.Mesh(
  new T.PlaneGeometry(0.95, 1.8),
  new T.MeshBasicMaterial({
    map: new T.CanvasTexture(shadowCanvas),
    transparent: true,
    depthWrite: false,
  }),
);
contact.rotation.x = -Math.PI / 2;
scene.add(contact);
// Bounded pool of glistening slime marks. Older marks shrink and disappear.
const trailMat = new T.MeshPhysicalMaterial({
  color: "#bcc4a1",
  roughness: 0.16,
  metalness: 0.15,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  clearcoat: 1,
});
const trail = new T.InstancedMesh(
  new T.CircleGeometry(0.18, 12),
  trailMat,
  180,
);
trail.instanceMatrix.setUsage(T.DynamicDrawUsage);
scene.add(trail);
trail.count = 0;
const trailPoints: { x: number; z: number; age: number; angle: number }[] = [];
const dummy = new T.Object3D();
let trailDistance = 0;
// The licensed Rocketbox character gives the distant human a real silhouette.
const human = new T.Group();
scene.add(human);
const placeholder = new T.Group();
human.add(placeholder);
mesh(
  new T.CapsuleGeometry(0.28, 0.95, 6, 10),
  material("#4b625c"),
  placeholder,
  [0, 1.4, 0],
);
mesh(
  new T.SphereGeometry(0.2, 12, 10),
  material("#c09876"),
  placeholder,
  [0, 2.15, 0],
);
const bootMat = material("#3a3528");
for (const x of [-0.18, 0.18]) {
  mesh(new T.CapsuleGeometry(0.1, 0.75, 4, 8), bootMat, placeholder, [
    x,
    0.5,
    0,
  ]);
}
let humanMixer: T.AnimationMixer | undefined;
let gardenerLife:GardenerLife|undefined;
new GLTFLoader().load(
  "/models/joe.glb",
  (gltf) => {
    const model = gltf.scene;
    const bounds = new T.Box3().setFromObject(model);
    const size = bounds.getSize(new T.Vector3());
    model.scale.setScalar(3.6 / size.y);
    model.position.y = -bounds.min.y * model.scale.y;
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    human.remove(placeholder);
    human.add(model);
    humanMixer = new T.AnimationMixer(model);
    const clip =
      gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];
    if (clip) humanMixer.clipAction(clip).play();
    humanMixer.update(0);
    gardenerLife=new GardenerLife(model,human,supportedHeight);
    gardenerLife.onStep=(p,strength)=>sound.step(p,slug.position,camera,strength);
  },
  undefined,
  () => {
    /* The procedural gardener remains playable if the optional model cannot load. */
  },
);
const shovel = new T.Group();
mesh(
  new T.CylinderGeometry(0.035, 0.04, 2, 8),
  material("#8e7248"),
  shovel,
  [0, 1, 0],
);
mesh(
  new T.SphereGeometry(1, 12, 10),
  material("#6d736e", 0.45),
  shovel,
  [0, 0.18, 0],
  [0.2, 0.3, 0.035],
);
shovel.children.forEach(child=>child.position.y-=1.35);
shovel.position.set(0.6, 1.35, 0.15);
shovel.rotation.z = -0.17;
human.add(shovel);
const lamp = new T.SpotLight("#ffdea0", 12, 8, 0.48, 0.65, 1.6);
lamp.position.set(0.45, 2.2, 0.25);
human.add(lamp);
human.add(lamp.target);
lamp.target.position.set(0, 0, 3.6);
const motesGeo = new T.BufferGeometry();
const motesArray = new Float32Array(210 * 3);
for (let i = 0; i < 210; i++) {
  motesArray[i * 3] = random() * 25 - 12.5;
  motesArray[i * 3 + 1] = 0.3 + random() * 6;
  motesArray[i * 3 + 2] = random() * 26 - 13;
}
motesGeo.setAttribute("position", new T.BufferAttribute(motesArray, 3));
const moteCanvas = document.createElement("canvas");
moteCanvas.width = moteCanvas.height = 32;
const mc = moteCanvas.getContext("2d")!,
  mg = mc.createRadialGradient(16, 16, 0, 16, 16, 16);
mg.addColorStop(0, "#fff6b7");
mg.addColorStop(0.18, "#ffeca2");
mg.addColorStop(1, "rgba(255,220,120,0)");
mc.fillStyle = mg;
mc.fillRect(0, 0, 32, 32);
const motes = new T.Points(
  motesGeo,
  new T.PointsMaterial({
    map: new T.CanvasTexture(moteCanvas),
    size: 0.07,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: T.AdditiveBlending,
  }),
);
scene.add(motes);
const rainGeo = new T.BufferGeometry(),
  rainArray = new Float32Array(900 * 6);
for (let i = 0; i < 900; i++) {
  const x = random() * 26 - 13,
    y = random() * 12,
    z = random() * 26 - 13;
  rainArray.set([x, y, z, x + 0.025, y - 0.22, z], i * 6);
}
rainGeo.setAttribute("position", new T.BufferAttribute(rainArray, 3));
const rain = new T.LineSegments(
  rainGeo,
  new T.LineBasicMaterial({
    color: "#c2d5d4",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
);
rain.visible = false;
scene.add(rain);
// A few moths circle the warm lamps.
const moths: T.Group[] = [];
for (let i = 0; i < 7; i++) {
  const g = new T.Group();
  for (const side of [-1, 1]) {
    const wing = mesh(new T.PlaneGeometry(0.09, 0.07), material("#dccdad"), g, [
      side * 0.04,
      0,
      0,
    ]);
    (wing.material as T.MeshStandardMaterial).side = T.DoubleSide;
  }
  scene.add(g);
  moths.push(g);
}

type Phase = "intro" | "playing" | "paused" | "dying" | "homecoming" | "won" | "lost";
let phase: Phase = "intro";
let pauseFrom:Phase="playing",deathReason="";
let debugView:{position:T.Vector3;target:T.Vector3}|undefined;
let time = 0,
  moisture = 100,
  health = 100,
  alert = 0,
  eat = 0,
  eaten = 0,
  patrol = 0,
  humanHeading = 0,
  invulnerable = 0,
  wasChasing = false;
const consumed = new Set<number>();
const consumedLettuce=new Set<number>();
let lettuceEaten=0, nearestLettuce=false, eatingTarget="";
const beerEscape = new BeerEscape();
const feeding = new FeedingVisuals(world.lettuce);
const mealProgress = new Map<string, number>();
const mouthPosition = new T.Vector3();
const homeStart = new T.Vector3();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let satisfied = 0, homeAge = 0, scoreAge = 0, shownScore = -1, beerHudAge = 0;
let homeReward = raidReward(0, 0), newBest = false;
const bestKey = 'sluger.personal-best.v1';
let personalBest = 0;
try { const saved = Number(localStorage.getItem(bestKey)); if (Number.isSafeInteger(saved) && saved > 0) personalBest = saved; } catch { /* Storage can be unavailable. */ }
el('intro-best').textContent = `Personal best · ${personalBest} points`;

const discovered = new Set<number>();
let investigation = -1, investigationTime = 0;
let lawnEntered = false;
let poison = 0;
let attackAge = -1, attackResolved = false;
const attackTarget = new T.Vector3();
const keys = new Set<string>();
let yaw = 0,
  pitch = 0.32,
  overview = false,
  dragging = false,
  lastX = 0,
  lastY = 0,
  toastUntil = 0;
let settingsPrevious: Phase = "intro";
let hidden = false;
let nearest = -1;
let elapsed = 0;
let frameCount = 0,
  fpsElapsed = 0;
let fps = 60;
const audio = [new Audio("/audio/wind.ogg"), new Audio("/audio/crickets.ogg")];
audio.forEach((a) => (a.loop = true));
let soundOn = true,
  volume = 0.35;
function syncAudio() {
  void sound.configure(soundOn,volume,!document.hidden&&!["intro","paused"].includes(phase));
  if(phase!=="playing")sound.mower(0,0,false);
  for (let i = 0; i < audio.length; i++) {
    audio[i].volume = volume * (i === 0 ? 0.18 : 0.32);
    if (soundOn && phase === "playing" && !document.hidden)
      void audio[i].play().catch(() => {});
    else audio[i].pause();
  }
  if(phase==="homecoming")sound.home();
  el("sound").textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  el("sound").setAttribute(
    "aria-label",
    soundOn ? "Mute sound" : "Enable sound",
  );
}
function toast(text: string) {
  el("toast").textContent = text;
  el("toast").classList.add("visible");
  toastUntil = elapsed + 3.5;
}
function reset() {
  (document.activeElement as HTMLElement)?.blur();
  hazards.reset(); poison=0;
  beerEscape.reset(); feeding.reset(); mealProgress.clear(); satisfied=0;homeAge=0;scoreAge=0;shownScore=-1;
  el('restart').textContent='Start over';
  slug.visible=true;slug.scale.set(1,1,1);show('beer-warning',false);show('score-summary',false);
  mower.reset(); lawnEntered = false;
  death.reset();sound.reset();debugView=undefined;el("damage").style.opacity="0";el("damage").style.background="";
  time = 0;
  moisture = 100;
  health = 100;
  alert = 0;
  eat = 0;
  eaten = 0;
  patrol = 1;
  humanHeading = Math.PI / 2;
  invulnerable = 0;
  wasChasing = false;
  consumed.clear();consumedLettuce.clear();lettuceEaten=0;eatingTarget="";
  world.lettuce.forEach(l=>{l.visible=true;l.rotation.z=0;});
  discovered.clear(); investigation = -1; investigationTime = 0;
  attackAge = -1; attackResolved = false;
  world.stumps.forEach(s => s.visible = false);
  world.flowers.forEach((f) => {
    f.visible = true;
    f.scale.setScalar(1);
  });
  slug.position.set(0, height(0, 7.6), 7.6);
  slug.rotation.set(0, 0, 0);
  human.position.set(PATROL[0].x, 0, PATROL[0].z);
  gardenerLife?.reset();
  yaw = 0;
  pitch = 0.32;
  trailPoints.length = 0;
  trail.count = 0;
  trailDistance = 0;
  searchTime = 0;
  targetMemory.set(0, 0, 0);
  keys.clear();
  phase = "playing";
  show("intro", false);
  show("result", false);
  show("settings", false);
  show("hud", true);
  show("pause", true);
  show("touch", matchMedia("(pointer: coarse)").matches);
  el("mission").textContent = "Lettuce for moisture. Lilies for points. Get full, then get home.";
  el("objective-stage").textContent = "FIND FOOD · FILL YOUR BELLY";
  el("hud").classList.remove("return-home");
  syncAudio();
  toast("Find pink-edged lettuce or white lilies. Hold E nearby to eat.");
  updateCamera(1, true);
}
function pause() {
  if (phase !== "playing"&&phase!=="dying"&&phase!=="homecoming") return;
  pauseFrom=phase;phase = "paused";
  keys.clear();
  show("result", true);
  el("result-tag").textContent = "A LITTLE BREAK";
  el("result-title").textContent = "Under a leaf.";
  el("result-description").textContent = "The garden can wait a while.";
  show("resume", true);show("score-summary",false);
  syncAudio();
  el("resume").focus();
}
function resume() {
  if (phase !== "paused") return;
  phase = pauseFrom;
  show("result", false);
  keys.clear();
  (document.activeElement as HTMLElement)?.blur();
  syncAudio();
}
function die(cause:DeathCause,reason:string,atImpact=false,target?:T.Vector3){
  if(phase!=="playing")return;
  phase="dying";deathReason=reason;keys.clear();show("interaction",false);death.start(cause, atImpact || cause === "mower" ? 0 : STRIKE_IMPACT,target);
  if(cause==="chop"){if(!atImpact){gardenerLife?.strike(slug.position);sound.swing();}}
  sound.beginDeath(cause);
  el("damage").style.opacity=".55";updateHud();syncAudio();
}
function beginHome() {
  if (phase !== 'playing') return;
  phase='homecoming';homeAge=0;homeStart.copy(slug.position);homeReward=raidReward(eaten,health,lettuceEaten);
  keys.clear();eat=0;beerEscape.reset();slug.rotation.z=0;
  show('interaction',false);show('beer-warning',false);show('touch',false);
  el('damage').style.opacity='0';el('alert').style.opacity='0';
  toast('Safe at last. Bringing your feast home.');sound.home();
}
function updateHome(dt:number) {
  homeAge+=dt;
  const u=Math.min(1,homeAge/1.6), ease=u*u*(3-2*u);
  slug.position.set(T.MathUtils.lerp(homeStart.x,HOME.x,ease),supportedHeight(HOME.x,HOME.z),T.MathUtils.lerp(homeStart.z,HOME.z+1.15,ease));
  const turn=Math.atan2(Math.sin(Math.PI-slug.rotation.y),Math.cos(Math.PI-slug.rotation.y));
  slug.rotation.y+=turn*(1-Math.exp(-dt*7));
  animateSlug(creature,elapsed,dt,.6,0,0,0);
  audio.forEach((a,i)=>a.volume=volume*(i===0?.18:.32)*(1-u));
  world.slugPos.value.copy(slug.position);
  if(u===1){slug.visible=false;finish(true);}
}
function updateScore(dt:number) {
  scoreAge+=dt;
  const value=Math.round(homeReward.total*(reducedMotion.matches?1:Math.min(1,scoreAge/1.4)));
  if(value!==shownScore){shownScore=value;el('score-total').textContent=String(value);}
}
function finish(won: boolean, reason = "") {
  phase = won ? "won" : "lost";
  keys.clear();
  show("result", true);
  show("resume", false);
  el("result-tag").textContent = won
    ? "THE EVENING IS YOURS"
    : "THE GARDEN WON THIS TIME";
  el("result-title").textContent = won
    ? "Full. And home."
    : death.fragments>0?"The evening ended here.":"A little setback.";
  el("result-description").textContent = won
    ? `${homeReward.rank} · ${eaten}/8 lilies and ${lettuceEaten}/4 lettuce brought home in ${formatTime(time)}.`
    : reason;
  el("restart").textContent = won ? "One more evening" : "Try again";
  syncAudio();
  show('score-summary',won);show('beer-warning',false);
  if(won){
    newBest=homeReward.total>personalBest;personalBest=Math.max(personalBest,homeReward.total);
    try { localStorage.setItem(bestKey,String(personalBest)); } catch { /* The current session still keeps the record. */ }
    el('intro-best').textContent=`Personal best · ${personalBest} points`;
    el('food-score-label').textContent=`Food · ${eaten} × 100 + ${lettuceEaten} × 40`;
    el('food-score').textContent=String(homeReward.food);
    el('risk-score').textContent=String(homeReward.bonus);
    el('health-score').textContent=`${Math.round(health)} × 2 = ${homeReward.survival}`;
    el('bonus-rule').textContent='Risk counts each lily as 1 and lettuce as 0.4. The amount above 3 is squared × 25, then rounded.';
    el('personal-best').textContent=`${newBest?'New personal best':'Personal best'} · ${personalBest} points`;
    scoreAge=0;shownScore=-1;updateScore(0);sound.win();
  }
  el("restart").focus();
}
function formatTime(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
el("start").onclick = reset;
el("restart").onclick = reset;
el("resume").onclick = resume;
el("pause").onclick = pause;
el("sound").onclick = () => {
  soundOn = !soundOn;
  syncAudio();
};
function closeSettings() {
  show("settings", false);
  phase = settingsPrevious;
  (document.activeElement as HTMLElement)?.blur();
  syncAudio();
}
el("settings-toggle").onclick = () => {
  if (!el("settings").hidden) {
    closeSettings();
    return;
  }
  settingsPrevious = phase;
  if (phase === "playing"||phase==="dying"||phase==="homecoming") phase = "paused";
  keys.clear();
  show("settings", true);
  syncAudio();
};
el("settings-close").onclick = closeSettings;
(el("sun") as HTMLInputElement).oninput = (e) => {
  sunElevation = +(e.target as HTMLInputElement).value;
  lighting();
};
(el("azimuth") as HTMLInputElement).oninput = (e) => {
  sunAzimuth = +(e.target as HTMLInputElement).value;
  lighting();
};
for (const id of ["sun", "azimuth"])
  el(id).addEventListener("change", () => lighting(true));
(el("weather") as HTMLSelectElement).onchange = (e) => {
  rainy = (e.target as HTMLSelectElement).value === "rain";
  rain.visible = rainy;
  lighting(true);
};
(el("volume") as HTMLInputElement).oninput = (e) => {
  volume = +(e.target as HTMLInputElement).value / 100;
  syncAudio();
};
(el("quality") as HTMLSelectElement).onchange = (e) => {
  const q = (e.target as HTMLSelectElement).value;
  quality = q;
  autoResolution = q === "balanced";
  postEnabled = q === "high";
  renderer.setPixelRatio(
    q === "high"
      ? Math.min(devicePixelRatio, 2)
      : q === "low"
        ? Math.min(devicePixelRatio, 1)
        : balancedRatio(),
  );
  renderer.shadowMap.enabled = q !== "low";
  renderer.shadowMap.needsUpdate = true;
  resize();
};
window.addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,select")) {
    if (e.key !== "Escape") return;
  }
  const k = e.key.toLowerCase();
  if (
    [
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
      "control",
    ].includes(k)
  )
    e.preventDefault();
  if (k === "escape") {
    if (!el("settings").hidden) closeSettings();
    else if (phase === "playing"||phase==="dying"||phase==="homecoming") pause();
    else resume();
    return;
  }
  if (phase !== "playing") return;
  if(["w","a","s","d","e","c","v"].includes(k)&&!e.metaKey)e.preventDefault();
  keys.add(k);
  if (k === "v" && !e.repeat) {
    overview = !overview;
    toast(overview ? "Overview" : "Ground view");
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
  syncAudio();
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointerup", () => (dragging = false));
renderer.domElement.addEventListener("pointercancel", () => (dragging = false));
renderer.domElement.addEventListener("pointermove", (e) => {
  if (dragging && phase === "playing") {
    yaw -= (e.clientX - lastX) * 0.005;
    pitch = T.MathUtils.clamp(pitch + (e.clientY - lastY) * 0.003, 0.12, 0.8);
  }
  lastX = e.clientX;
  lastY = e.clientY;
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-key]",
)) {
  const key = button.dataset.key!;
  button.onpointerdown = (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    keys.add(key);
  };
  button.onpointerup = () => keys.delete(key);
  button.onpointercancel = () => keys.delete(key);
}
function resize() {
  if (autoResolution)
    renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), balancedRatio()));
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setPixelRatio(renderer.getPixelRatio());
  composer?.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
const cameraTarget = new T.Vector3(),
  desired = new T.Vector3();
function updateCamera(dt: number, snap = false) {
  if(debugView){camera.position.copy(debugView.position);camera.lookAt(debugView.target);world.homeMaterial.opacity=1;return;}
  if (phase === "intro") {
    camera.position.set(4.3 + Math.sin(elapsed * 0.04) * 0.3, 1.75, 11.2);
    camera.lookAt(-0.3, 0.65, 3.6);
    return;
  }
  const r = overview ? 7 : 3.7,
    y = overview ? 6 : 1.0 + pitch * 2.1;
  cameraTarget.set(
    slug.position.x,
    slug.position.y + 0.3,
    slug.position.z - 0.15,
  );
  desired.set(
    slug.position.x + Math.sin(yaw) * r,
    slug.position.y + y,
    slug.position.z + Math.cos(yaw) * r,
  );
  desired.x = T.MathUtils.clamp(desired.x, -11, 11);
  desired.z = T.MathUtils.clamp(desired.z, -11, 12);
  camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-dt * 7));
  camera.lookAt(cameraTarget);
  const cameraLine = camera.position.clone().sub(cameraTarget);
  const along = T.MathUtils.clamp(
    world.home.position.clone().sub(cameraTarget).dot(cameraLine) /
      cameraLine.lengthSq(),
    0,
    1,
  );
  const near = world.home.position.distanceTo(
    cameraTarget.clone().addScaledVector(cameraLine, along),
  );
  // Keep the home landmark readable even when it sits between player and camera.
  const homeOpacity = T.MathUtils.lerp(0.3, 1, T.MathUtils.smoothstep(near, 0.65, 1.4));
  world.homeMaterial.opacity = snap ? homeOpacity : T.MathUtils.lerp(
    world.homeMaterial.opacity, homeOpacity, 1 - Math.exp(-dt * 8),
  );
}
function updatePlayer(dt: number) {
  const crouch = keys.has("control") || keys.has("c");
  hidden = crouch && covered(slug.position);
  let dx =
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft")),
    dz =
      Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup"));
  slugActivity=0;slugTurn=0;
  const moving = !!(dx || dz),
    sprint = keys.has("shift") && moisture > 4 && moving && !crouch;
  if (moving) {
    const norm = Math.hypot(dx, dz);
    dx /= norm;
    dz /= norm;
    const wx = dx * Math.cos(yaw) + dz * Math.sin(yaw),
      wz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const speed = (crouch ? 0.7 : sprint ? 2.65 : 1.45) * (beerEscape.exposure>0?.78:1);
    const next = move(
      slug.position,
      wx * dt * speed,
      wz * dt * speed,
      world.obstacles,
    );
    const moved = distance(next, slug.position);
    slugActivity=Math.min(1,moved/Math.max(dt,.001));
    slug.position.x = next.x;
    slug.position.z = next.z;
    const angle = Math.atan2(-wx, -wz);
    slugTurn=Math.atan2(Math.sin(angle-slug.rotation.y),Math.cos(angle-slug.rotation.y));
    slug.rotation.y +=
      Math.atan2(
        Math.sin(angle - slug.rotation.y),
        Math.cos(angle - slug.rotation.y),
      ) *
      (1 - Math.exp(-dt * 10));
    trailDistance += moved;
    if (trailDistance > 0.13) {
      trailDistance = 0;
      trailPoints.push({
        x: slug.position.x,
        z: slug.position.z,
        age: 0,
        angle: slug.rotation.y,
      });
      if (trailPoints.length > 180) trailPoints.shift();
    }
  }
  slug.position.y = supportedHeight(slug.position.x, slug.position.z);
  slug.scale.y = T.MathUtils.lerp(
    slug.scale.y,
    crouch ? 0.68 : 1,
    1 - Math.exp(-dt * 9),
  );

  const wet = rainy || WATER.some((w) => distance(w, slug.position) < w.radius);
  const salted = SALT.some((s) => distance(s, slug.position) < s.radius + 0.13);
  ({ moisture, health } = survival(moisture, health, dt, wet, sprint, salted));
  const exposed=hazards.poison.some(p=>distance(slug.position,p)<p.radius);
  sound.discomfort(salted,poison);
  const previousPoison=poison;
  ({poison,health}=poisonStep(poison,health,dt,exposed,WATER.some(w=>distance(w,slug.position)<w.radius)));
  if(exposed&&previousPoison===0){toast("Poison bait! Leave the blue pellets. A puddle washes the poison away.");}
  if(health<=0&&poison>0){die("poison","The blue bait poisoned you. Leave the pellets immediately and reach a puddle before the poison takes hold.");show("interaction",true);show("eat-track",false);return;}

  if (health <= 0){
    die(
      salted?"salt":"dry",
      salted
        ? "Salt dries out a slug fast. Stay away from the white grains."
        : "You dried out. Rest in a puddle and save your sprinting.",
    );return;}
  el("damage").style.background = poison>0 ? "radial-gradient(ellipse at center, transparent 40%, rgba(85,112,25,.7))" : "";
  el("damage").style.opacity = salted ? ".5" : poison>0 ? String(.15+poison*.4) : invulnerable > 0 ? ".25" : "0";
  let closest = Infinity;
  nearest = -1;
  FLOWERS.forEach((f, i) => {
    const d = distance(f, slug.position);
    if (!consumed.has(i) && d < closest) {
      closest = d;
      nearest = i;
    }
  });
  nearestLettuce=false;
  LETTUCE.forEach((f,i)=>{const d=distance(f,slug.position);if(!consumedLettuce.has(i)&&d<closest){closest=d;nearest=i;nearestLettuce=true;}});
  const canEat = closest < 0.95;
  const targetKey=canEat?`${nearestLettuce?'lettuce':'lily'}:${nearest}`:'';
  if(targetKey!==eatingTarget){
    if(eatingTarget.startsWith('lettuce:'))feeding.update(Number(eatingTarget.split(':')[1]),mealProgress.get(eatingTarget)??0,mouthPosition,false,time,reducedMotion.matches);
    eatingTarget=targetKey;eat=mealProgress.get(targetKey)??0;
  }
  const food=nearestLettuce?FOOD.lettuce:FOOD.lily;
  const edible=nearestLettuce?world.lettuce[nearest]:world.flowers[nearest];
  if (canEat && keys.has("e") && !moving) {
    eat += dt / food.seconds;
    mealProgress.set(targetKey,Math.min(1,eat));
    const angle=Math.atan2(slug.position.x-edible.position.x,slug.position.z-edible.position.z);
    slug.rotation.y+=Math.atan2(Math.sin(angle-slug.rotation.y),Math.cos(angle-slug.rotation.y))*(1-Math.exp(-dt*16));
    creature.mouth.getWorldPosition(mouthPosition);
    if(nearestLettuce)feeding.update(nearest,eat,mouthPosition,true,time,reducedMotion.matches);
    else {edible.rotation.z=reducedMotion.matches?0:Math.sin(time*28)*.06;edible.scale.setScalar(1-eat*.55);}
    if (eat >= 1) {
      const wasFull=canGoHome(eaten,lettuceEaten);
      if(nearestLettuce){consumedLettuce.add(nearest);lettuceEaten++;}
      else{consumed.add(nearest);eaten++;world.stumps[nearest].visible=true;}
      edible.visible=false;sound.eat();satisfied=.7;eat=0;mealProgress.delete(targetKey);
      moisture=Math.min(100,moisture+food.moisture);
      toast(!wasFull&&canGoHome(eaten,lettuceEaten)?"You're full! Head home, or risk more food for a bigger reward.":`${food.name==='lily'?'Lily':'Lettuce'} eaten. +${food.points} food points · +${food.moisture} moisture.`);
      if(canGoHome(eaten,lettuceEaten))el("hud").classList.add("return-home");
    }
  } else {
    if(canEat&&nearestLettuce)feeding.update(nearest,eat,mouthPosition,false,time,reducedMotion.matches);
  }
  show(
    "interaction",
    canEat ||
      wet ||
      salted ||
      hidden ||
      (canGoHome(eaten,lettuceEaten) && distance(slug.position, HOME) < 1.8),
  );
  el("interaction-text").innerHTML = salted
    ? "Salt! Get out of here."
    : canEat
      ? `<kbd>E</kbd> Hold to eat ${food.name} · +${food.points} pts · +${food.moisture} moisture`
      : wet
        ? "Wet soil. Moisture is returning."
        : hidden
          ? "You're hidden among the leaves."
          : "The pot. Home again.";
  show("eat-track", canEat);
  el("eat-progress").style.width = `${eat * 100}%`;
  if (canGoHome(eaten,lettuceEaten) && distance(slug.position, HOME) < 1.1) beginHome();
  world.slugPos.value.copy(slug.position);
  if(phase==="playing")sound.update(elapsed,alert,keys.has("e")&&eat>0,moving,wet);
}
function checkBeerTrap(dt:number){
  let trap=hazards.beer[0],range=Infinity;
  for(const candidate of hazards.beer){const d=distance(slug.position,candidate);if(d<range){trap=candidate;range=d;}}
  const previous=beerEscape.stage;
  const fatal=beerEscape.step(dt,range,trap.radius);
  if(beerEscape.stage==='danger'){
    if(previous!=='danger')sound.react('tipsy');
    // Weak attraction: ordinary crawling, even sneaking, can overcome it.
    if(range>.04){const next=move(slug.position,(trap.x-slug.position.x)/range*dt*.28,(trap.z-slug.position.z)/range*dt*.28,world.obstacles);slug.position.x=next.x;slug.position.z=next.z;}
  }
  slug.rotation.z=reducedMotion.matches?0:Math.sin(time*11)*.10*Math.min(1,beerEscape.exposure);
  const stage=beerEscape.stage;
  show('beer-warning',stage!=='clear');
  beerHudAge+=dt;
  if(previous!==stage||beerHudAge>=.1){
  beerHudAge=0;
  el('beer-warning').dataset.stage=stage;
  el('beer-label').textContent=stage==='danger'?`Slipping! ${beerEscape.remaining.toFixed(1)} s to get clear`:stage==='recovering'?'Back on firm ground': 'That sweet smell… beer bait';
  el('beer-help').textContent=stage==='danger'?'Hold WASD / arrows away from the bowl. Shift helps.':stage==='recovering'?'Keep crawling away while the dizziness fades.':'It draws you toward the rim. Keep your distance.';
  (el('beer-meter') as HTMLMeterElement).value=beerEscape.remaining;
  }
  if(fatal){health=0;die('beer','You lingered at the rim and drowned. When you feel dizzy, hold movement away from the bowl; Shift helps.',false,new T.Vector3(trap.x,supportedHeight(trap.x,trap.z),trap.z));show('beer-warning',false);show('interaction',true);show('eat-track',false);}
}
function updateMower(dt:number) {
  mower.update(dt);
  const offset=mower.root.position.clone().sub(slug.position),range=offset.length();
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  sound.mower(range,offset.normalize().dot(right),true);
  if(onLawn(slug.position)&&!lawnEntered){lawnEntered=true;toast("Robot mower! Short grass won't hide you. Watch its route and stay clear of the deck.");}
  if(mowerHit(slug.position,mower.previous,mower.root.position)){
    health=0;die("mower","The mower caught you under its deck. Wait for it to pass, then cross behind it. Sneaking won't protect you on short grass.",true);
  }
}
const targetMemory = new T.Vector3();
let searchTime = 0;
function updateHuman(dt: number) {
  const spotted = visible(
    human.position,
    humanHeading,
    slug.position,
    hidden,
    world.obstacles,
  );
  alert = T.MathUtils.clamp(
    alert + dt * (spotted ? (hidden ? 0.26 : 0.58) : -0.24),
    0,
    1,
  );
  if (spotted) {
    targetMemory.copy(slug.position);
    searchTime = 3;
  } else searchTime = Math.max(0, searchTime - dt);
  const chasing = alert > 0.7;
  if (chasing && !wasChasing) toast("You've been spotted! Take cover in the leaves.");
  wasChasing = chasing;
  if (!spotted && !chasing && attackAge < 0) {
    if (investigation < 0) {
      for (const i of consumed) {
        if (!discovered.has(i) && distance(human.position, FLOWERS[i]) < 4.5 &&
          visible(human.position, humanHeading, FLOWERS[i], false, world.obstacles)) {
          discovered.add(i); investigation = i; investigationTime = 5;
          toast("He found an eaten stem. He's searching that bed.");
          break;
        }
      }
    } else {
      investigationTime -= dt;
      if (investigationTime <= 0) { investigation = -1; patrol = (patrol + 1) % PATROL.length; }
    }
  }
  const tracking = (spotted || alert > 0.08) && searchTime > 0;
  const target = tracking ? targetMemory : investigation >= 0 ? FLOWERS[investigation] : PATROL[patrol];
  const d = distance(target, human.position);
  if (d < 0.3 && !chasing && investigation < 0) patrol = (patrol + 1) % PATROL.length;
  if (d > (tracking || investigation >= 0 ? .8 : .12) && attackAge < 0) {
    const dx = (target.x - human.position.x) / d,
      dz = (target.z - human.position.z) / d;
    humanHeading = Math.atan2(dx, dz);
    const next = move(
      human.position,
      dx * dt * (chasing ? 1.65 : 0.68),
      dz * dt * (chasing ? 1.65 : 0.68),
      world.obstacles,
      0.45,
    );
    human.position.x = next.x;
    human.position.z = next.z;
    human.rotation.y = humanHeading;
    human.position.y = height(next.x, next.z) + Math.sin(time * 5) * 0.014;
  }
  invulnerable = Math.max(0, invulnerable - dt);
  if (attackAge < 0 && chasing && distance(slug.position, human.position) < 1.05 && invulnerable <= 0) {
    attackAge = 0; attackResolved = false; attackTarget.copy(slug.position);
    gardenerLife?.strike(attackTarget); sound.swing();
    toast("Spade up — move!");
  }
  if (attackAge >= 0) {
    attackAge += dt;
    if (!attackResolved && attackAge >= STRIKE_IMPACT) {
      attackResolved = true;
      if (distance(slug.position, attackTarget) < .65 && distance(slug.position, human.position) < 1.5) {
        health = Math.max(0, health - 36);
        invulnerable = 1.8;
        if (health <= 0) die("chop", "The spade caught you. Move as he raises it, before the blade comes down.", true);
        else { sound.chop(); sound.hurt(); toast("A glancing hit! Find cover."); }
      } else toast("Missed you. Keep moving!");
    }
    if (attackAge >= STRIKE_DURATION) attackAge = -1;
  }
}
const map = el("map") as HTMLCanvasElement,
  mapCtx = map.getContext("2d")!;
function drawMap() {
  const c = mapCtx;
  c.clearRect(0, 0, 180, 180);
  const px = (x: number) => 90 + x * 6.5,
    pz = (z: number) => 85 + z * 6.5;
  c.fillStyle = "#647b4829";
  c.fillRect(32, 22, 40, 109);
  c.fillRect(109, 22, 40, 109);
  c.strokeStyle = "#d9dbc221";
  c.strokeRect(14, 10, 153, 151);
  const dot = (p: { x: number; z: number }, color: string, r: number) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(px(p.x), pz(p.z), r, 0, 7);
    c.fill();
  };
  c.fillStyle="#92ab5938";
  c.fillRect(px(LAWN.left),pz(LAWN.back),(LAWN.right-LAWN.left)*6.5,(LAWN.front-LAWN.back)*6.5);
  c.fillStyle="#e6a167";c.font="8px sans-serif";c.fillText("LAWN",px(LAWN.left),pz(LAWN.back)-3);
  dot(mower.root.position,"#ff9859",4);
  hazards.beer.forEach(t=>dot(t,"#e3b255",3));
  hazards.poison.forEach(t=>dot(t,"#53b7e3",3));
  WATER.forEach((w) => dot(w, "#87b8c0", 3));
  SALT.forEach((s) => dot(s, "#d19076", 2.5));
  FLOWERS.forEach((f, i) => {
    if (!consumed.has(i)) dot(f, "#e5d7a4", 3);
  });
  if (canGoHome(eaten,lettuceEaten)) {
    c.save();
    c.strokeStyle = "#d8efad";
    c.lineWidth = 1.5;
    c.setLineDash([3, 4]);
    c.beginPath();
    c.moveTo(px(slug.position.x), pz(slug.position.z));
    c.lineTo(px(HOME.x), pz(HOME.z));
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(px(HOME.x), pz(HOME.z), 7 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#e8f4d0";
    c.font = "9px sans-serif";
    c.textAlign = "center";
    c.fillText("HOME", px(HOME.x), pz(HOME.z) - 12);
    c.restore();
  }
  LETTUCE.forEach((f,i)=>{if(!consumedLettuce.has(i))dot(f,"#b8dc72",3);});
  dot(HOME, "#a9cc83", 4);
  dot(human.position, "#dc9872", 4);
  c.save();
  c.translate(px(slug.position.x), pz(slug.position.z));
  c.rotate(slug.rotation.y);
  c.fillStyle = "#fff4d1";
  c.beginPath();
  c.moveTo(0, -5);
  c.lineTo(3, 4);
  c.lineTo(-3, 4);
  c.closePath();
  c.fill();
  c.restore();
}
function updateHud() {
  show("poison-status",poison>0);
  el("poison-status").textContent=`POISONED ${Math.ceil(poison*100)}% · FIND WATER`;

  if (canGoHome(eaten,lettuceEaten)) {
    el("objective-stage").textContent = eaten === FLOWERS.length && lettuceEaten === LETTUCE.length ? "FULL FEAST · GET HOME" : "HOME IS OPEN · RISK MORE?";
    el("mission").textContent = `${raidReward(eaten, health, lettuceEaten).total} points if you get home. ${Math.ceil(distance(slug.position, HOME))} m to the pot.${eaten + lettuceEaten < FLOWERS.length + LETTUCE.length ? " More food, bigger reward." : " Bring the feast home!"}`;
  }
  el("count").textContent = String(fullness(eaten,lettuceEaten));
  el("food-count").textContent = `${eaten}/8 lilies · ${lettuceEaten}/4 lettuce`;
  if(!canGoHome(eaten,lettuceEaten))el("mission").textContent=`${3-eaten-lettuceEaten} more meals to fill your belly. Lettuce is quick and restores moisture.`;
  el("time").textContent = formatTime(time);
  el("moisture").style.width = `${moisture}%`;
  el("health").style.width = `${health}%`;
  el("moisture-text").textContent = `${Math.ceil(moisture)}%`;
  el("health-text").textContent = `${Math.ceil(health)}%`;
  el("cover").textContent = hidden
    ? "HIDDEN IN THE LEAVES"
    : alert > 0.7
      ? "SPOTTED — FIND COVER"
      : covered(slug.position)
        ? "CTRL · SNEAK TO HIDE"
        : onLawn(slug.position) ? "SHORT GRASS · NO COVER" : "OUT IN THE OPEN";
  el("cover").classList.toggle("safe", hidden);
  el("alert").style.opacity = alert > 0.05 ? "1" : "0";
  el("alert-fill").style.width = `${alert * 100}%`;
  el("alert-label").textContent =
    alert > 0.7 ? "SPOTTED — TAKE COVER" : "THE GARDENER SUSPECTS SOMETHING";
  if(phase==='homecoming'||phase==='won'){
    el('objective-stage').textContent='SAFE AT HOME';
    el('mission').textContent='Your feast is safe. Take a breath.';
  }
  drawMap();
}
const manualReview = import.meta.env.DEV && new URLSearchParams(location.search).has('test') && new URLSearchParams(location.search).has('review');
let last = performance.now();
slug.position.set(1.7, 0, 7);
human.position.set(0, 0, -8);
function animate(now: number) {
  requestAnimationFrame(animate);
  const frameDelta = (now - last) / 1000;
  const dt = manualReview ? 0 : Math.min(frameDelta, 0.05);
  last = now;
  elapsed += dt;
  frameCount++;
  fpsElapsed += frameDelta;
  if (fpsElapsed >= 1) {
    fps = Math.round(frameCount / fpsElapsed);
    el("fps").textContent = `${fps} FPS`;
    frameCount = 0;
    fpsElapsed = 0;
    if (autoResolution && !document.hidden && phase === "playing" && time > 3) {
      slowWindows = fps < 54 ? slowWindows + 1 : 0;
      fastWindows = fps >= 59 ? fastWindows + 1 : 0;
      const ratio = renderer.getPixelRatio();
      if (slowWindows >= 2 && ratio > 0.7) {
        renderer.setPixelRatio(Math.max(0.7, ratio - 0.1));
        resize();
        slowWindows = 0;
      } else if (fastWindows >= 10 && ratio < balancedRatio()) {
        renderer.setPixelRatio(Math.min(balancedRatio(), ratio + 0.05));
        resize();
        fastWindows = 0;
      }
    }
  }
  if (phase === "playing") {
    time += dt;
    updatePlayer(dt);
    if (phase === "playing") updateHuman(dt);
    if (phase === "playing") updateMower(dt);
    if (phase === "playing") checkBeerTrap(dt);
    hudElapsed += dt;
    if (hudElapsed > 0.1) {
      updateHud();
      hudElapsed = 0;
    }
  }
  if(phase==='homecoming')updateHome(dt);
  if(phase==='won')updateScore(dt);
  if(phase==='playing')satisfied=Math.max(0,satisfied-dt);
  if(phase==="dying"){
    sound.deathUpdate(dt);
    if(death.update(dt))finish(false,deathReason);
    if(death.caption)el("interaction-text").textContent=death.caption;
  }
  if (phase === "playing" || phase === "intro" || phase==="dying") {
    humanMixer?.update(dt);
    gardenerLife?.update(dt,elapsed,phase==='playing'?alert:0,slug.position,shovel);
    if(phase!=="dying")animateSlug(creature,elapsed,dt,phase==='playing'?slugActivity:0,slugTurn,keys.has("e")&&eat>0?1:0,alert,reducedMotion.matches?0:satisfied);
  }
  // Ambient animation remains calm on menus, while all gameplay freezes.
  clouds.position.x = -12 + Math.sin(elapsed * 0.008) * 2;
  world.wind.value = elapsed;
  world.stoneWet.value=T.MathUtils.lerp(world.stoneWet.value,rainy?1:0,1-Math.exp(-dt*.5));
  puddles.update(elapsed,slug.position,rainy);
  world.flowers.forEach((f, i) => {
    if (!(!nearestLettuce && nearest === i && eat > 0))
      f.rotation.z = Math.sin(elapsed * 1.3 + i) * 0.025;
  });
  for (let i = 0; i < world.coverPlants.length; i++)
    world.coverPlants[i].rotation.z = Math.sin(elapsed * 1.2 + i) * 0.022;
  contact.position.set(
    slug.position.x,
    slug.position.y + 0.006,
    slug.position.z,
  );
  contact.rotation.z = -slug.rotation.y;
  if (phase === "playing") for (const p of trailPoints) p.age += dt;
  trail.count = trailPoints.length;
  trailPoints.forEach((p, i) => {
    const fade = Math.max(0, 1 - p.age / 35);
    dummy.position.set(p.x, height(p.x, p.z) + 0.012, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, p.angle);
    dummy.scale.set(fade, fade * 1.8, 1);
    dummy.updateMatrix();
    trail.setMatrixAt(i, dummy.matrix);
  });
  trail.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < 210; i++) {
    motesArray[i * 3] += 0.009 * Math.sin(elapsed + i) * dt;
    motesArray[i * 3 + 1] += 0.015 * Math.cos(elapsed * 0.4 + i) * dt;
  }
  motesGeo.attributes.position.needsUpdate = true;
  moths.forEach((m, i) => {
    m.position.set(
      Math.sin(elapsed * 0.7 + i) * 1.7 + (i - 3) * 2,
      3 + Math.sin(elapsed + i) * 0.2,
      -9 + Math.cos(elapsed + i) * 0.5,
    );
    m.rotation.y = elapsed + i;
    m.children.forEach(
      (w, j) => (w.rotation.y = Math.sin(elapsed * 28) * (j ? 1 : -1)),
    );
  });
  if (rainy) {
    for (let i = 0; i < 900; i++) {
      rainArray[i * 6 + 1] -= dt * 5;
      rainArray[i * 6 + 4] -= dt * 5;
      if (rainArray[i * 6 + 1] < 0) {
        rainArray[i * 6 + 1] = 12;
        rainArray[i * 6 + 4] = 11.78;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  if (elapsed > toastUntil) el("toast").classList.remove("visible");
  updateCamera(dt);
  if(phase==="dying"&&!matchMedia("(prefers-reduced-motion: reduce)").matches){camera.position.x+=Math.sin(elapsed*87)*death.shake;camera.position.y+=Math.cos(elapsed*73)*death.shake*.5;}
  renderer.info.reset();
  shadowElapsed += dt;
  if (shadowElapsed > (quality === "high" ? 1 / 60 : 1 / 24)) {
    renderer.shadowMap.needsUpdate = true;
    shadowElapsed = 0;
  }
  if(phase==="dying"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)camera.rotation.z+=death.drunkenRoll;
  puddles.renderReflection(renderer,camera,elapsed,quality);
  if (postEnabled) getComposer().render();
  else renderer.render(scene, camera);
}
requestAnimationFrame(animate);
show("loading", false);
syncAudio();

// Dev-only state access for deterministic integration tests; removed from production by Vite.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test")) {
  Object.assign(window, {
    __sluger: {
      state: () => ({
        phase,
        time,
        moisture,
        health,
        alert,
        eaten, lettuceEaten, fullness:fullness(eaten,lettuceEaten),
        discovered: [...discovered], investigation, attackAge,
        reward: raidReward(eaten, health, lettuceEaten),
        eat, beer:{stage:beerEscape.stage,exposure:beerEscape.exposure,remaining:beerEscape.remaining},
        personalBest, homeAge, score:shownScore,
        feeding:{remainingLeaves:feeding.remainingLeaves,satisfied},
        hidden,
        hazards: {beer:hazards.beer,poison:hazards.poison}, poison,
        mower: { x:mower.root.position.x,z:mower.root.position.z,moving:mower.moving },
        player: { x: slug.position.x, z: slug.position.z },
        human: { x: human.position.x, z: human.position.z },
        fps,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        pixelRatio: renderer.getPixelRatio(),
        reflectionUpdates:puddles.reflectionUpdates,
        soundReactions:{...sound.reactions},soundEvents:sound.events,soundReady:sound.ready,fragments:death.fragments,gardenerSteps:gardenerLife?.steps??0,gardenerLegs:gardenerLife?.boundLegs??0,
        animation:{activity:creature.motion.activity.value,turn:creature.motion.turn.value},
      }),
      profile: (settings: {
        bloom?: boolean;
        shadows?: boolean;
        grass?: boolean;
        ratio?: number;
        reflections?:boolean;
      }) => {
        autoResolution = false;
        if(settings.reflections!==undefined)puddles.reflectionsEnabled=settings.reflections;
        if (settings.bloom !== undefined) postEnabled = settings.bloom;
        if (settings.shadows !== undefined)
          renderer.shadowMap.enabled = settings.shadows;
        if (settings.grass !== undefined) world.grass.visible = settings.grass;
        if (settings.ratio !== undefined) {
          renderer.setPixelRatio(settings.ratio);
          resize();
        }
      },
      view:(position:number[],target:number[])=>{debugView={position:new T.Vector3(...position as [number,number,number]),target:new T.Vector3(...target as [number,number,number])};},
      kill:(cause:DeathCause)=>{health=0;die(cause,"A fatal blow from the spade.");},
      place: (x: number, z: number) => {
        slug.position.set(x, supportedHeight(x, z), z);
      },
      gardener: (x: number, z: number, heading: number) => {
        human.position.set(x, 0, z);
        humanHeading = heading;human.rotation.y=heading;
      },
      stats: (m: number, h: number) => {
        moisture = m;
        health = h;
      },
      step: (seconds: number) => {
        for (let t = 0; t < seconds && (phase === "playing"||phase==="dying"||phase==="homecoming"||phase==="won"); t += 1 / 60) {
          if(phase==='homecoming'){updateHome(1/60);continue;}
          if(phase==='won'){updateScore(1/60);continue;}
          if(phase==="dying"){sound.deathUpdate(1/60);if(death.update(1/60))finish(false,deathReason);continue;}
          elapsed+=1/60;
          time += 1 / 60;
          updatePlayer(1 / 60);
          if (phase === "playing") updateHuman(1 / 60);
          if (phase === "playing") updateMower(1 / 60);
          if (phase === "playing") checkBeerTrap(1/60);
        }
        updateHud();
      },
    },
  });
}

// Manual fixtures for the shared AO Browser: dev-only, opt-in, no production UI.
if(manualReview) {
  const panel=document.createElement('div');panel.id='review-controls';
  panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:20;background:#13251c;padding:8px;display:flex;gap:8px;flex-wrap:wrap;max-width:95vw';
  const api=(window as unknown as {__sluger:{step:(s:number)=>void}}).__sluger;
  const button=(name:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;panel.append(b);};
  const setup=()=>{reset();human.position.set(-10,0,-10);humanHeading=Math.PI;};
  button('Review beer',()=>{setup();const t=hazards.beer[0];slug.position.set(t.x+.7,supportedHeight(t.x+.7,t.z),t.z);debugView={position:new T.Vector3(t.x+2,1.7,t.z+2.5),target:new T.Vector3(t.x,.2,t.z)};});
  button('Review lettuce',()=>{setup();const p=LETTUCE[0];slug.position.set(p.x,supportedHeight(p.x,p.z+.7),p.z+.7);debugView={position:new T.Vector3(p.x+1.3,1.25,p.z+2),target:new T.Vector3(p.x,.2,p.z)};});
  button('Review home',()=>{setup();eaten=3;slug.position.set(0,supportedHeight(0,9),9);debugView={position:new T.Vector3(2,1.8,7),target:new T.Vector3(0,.4,10)};});
  button('Toggle E',()=>{keys.has('e')?keys.delete('e'):keys.add('e');});
  button('Toggle retreat',()=>{keys.has('s')?keys.delete('s'):keys.add('s');});
  button('Step 0.2 s',()=>api.step(.2));button('Step 1 s',()=>api.step(1));
  document.body.append(panel);
}
