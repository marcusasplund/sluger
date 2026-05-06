import './style.css';
import * as THREE from 'three';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

// ── Renderer ───────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#8aaa8a', 0.022);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.5, 7);

const timer = new THREE.Timer();

// ── Procedural textures ────────────────────────────────────────
function createBladeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, '#1a4a0e');
  g.addColorStop(0.3, '#2d6b1a');
  g.addColorStop(0.6, '#4a8c2a');
  g.addColorStop(0.85, '#6aad3d');
  g.addColorStop(1.0, '#8bc34a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  // midrib
  ctx.strokeStyle = 'rgba(30,80,20,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(32, 256); ctx.lineTo(32, 0); ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBladeAlpha(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 256); ctx.lineTo(56, 256);
  ctx.lineTo(48, 192); ctx.lineTo(42, 128); ctx.lineTo(36, 64); ctx.lineTo(32, 0);
  ctx.lineTo(28, 64); ctx.lineTo(22, 128); ctx.lineTo(16, 192);
  ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// ── Weather system ─────────────────────────────────────────────
type WeatherState = 'clear' | 'cloudy' | 'rainy';

const weather = {
  current: 'clear' as WeatherState,
  nextChangeAt: 10 + Math.random() * 10,
  targetFog: 0.022, currentFog: 0.022,
  targetLight: 1.6, currentLight: 1.6,
  targetHemi: 2.0, currentHemi: 2.0,
  targetCloudCover: 0.15, currentCloudCover: 0.15,
  targetSkyBright: 1.0, currentSkyBright: 1.0,
  targetRain: 0, currentRain: 0,
};

function setWeatherTargets(state: WeatherState) {
  weather.current = state;
  switch (state) {
    case 'clear':
      weather.targetFog = 0.018; weather.targetLight = 1.6; weather.targetHemi = 2.0;
      weather.targetCloudCover = 0.15; weather.targetSkyBright = 1.0; weather.targetRain = 0;
      break;
    case 'cloudy':
      weather.targetFog = 0.035; weather.targetLight = 0.8; weather.targetHemi = 1.2;
      weather.targetCloudCover = 0.65; weather.targetSkyBright = 0.5; weather.targetRain = 0;
      break;
    case 'rainy':
      weather.targetFog = 0.055; weather.targetLight = 0.5; weather.targetHemi = 0.8;
      weather.targetCloudCover = 0.85; weather.targetSkyBright = 0.3; weather.targetRain = 0.55;
      break;
  }
}

const weatherStates: WeatherState[] = ['clear', 'cloudy', 'rainy'];

function updateWeather(delta: number, elapsed: number) {
  if (elapsed > weather.nextChangeAt) {
    const next = weatherStates[Math.floor(Math.random() * weatherStates.length)];
    setWeatherTargets(next);
    weather.nextChangeAt = elapsed + 12 + Math.random() * 15;
  }
  const lerp = 1 - Math.pow(0.3, delta);
  weather.currentFog += (weather.targetFog - weather.currentFog) * lerp;
  weather.currentLight += (weather.targetLight - weather.currentLight) * lerp;
  weather.currentHemi += (weather.targetHemi - weather.currentHemi) * lerp;
  weather.currentCloudCover += (weather.targetCloudCover - weather.currentCloudCover) * lerp;
  weather.currentSkyBright += (weather.targetSkyBright - weather.currentSkyBright) * lerp;
  weather.currentRain += (weather.targetRain - weather.currentRain) * lerp;

  (scene.fog as THREE.FogExp2).density = weather.currentFog;
  sunLight.intensity = weather.currentLight;
  hemiLight.intensity = weather.currentHemi;
  skyMat.uniforms.brightness.value = weather.currentSkyBright;
  skyMat.uniforms.cloudCover.value = weather.currentCloudCover;
  rainMaterial.opacity = weather.currentRain;

  const fogCol = new THREE.Color().lerpColors(
    new THREE.Color('#a8cca8'), new THREE.Color('#6a7a6a'), 1 - weather.currentSkyBright,
  );
  (scene.fog as THREE.FogExp2).color.copy(fogCol);
}

// ── Sky dome ───────────────────────────────────────────────────
const skyVert = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const skyFrag = `
uniform float brightness, cloudCover, time;
varying vec3 vWorldPos;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x_=2.0*fract(p*C.www)-1.0;vec3 h=abs(x_)-0.5;
  vec3 ox=floor(x_+0.5);vec3 a0=x_-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
void main(){
  vec3 dir=normalize(vWorldPos);float el=dir.y;
  vec3 zen=mix(vec3(0.15,0.2,0.35),vec3(0.35,0.55,0.9),brightness);
  vec3 hor=mix(vec3(0.3,0.32,0.34),vec3(0.72,0.82,0.92),brightness);
  vec3 gnd=vec3(0.15,0.2,0.12);
  vec3 sky=el>0.0?mix(hor,zen,pow(el,0.5)):mix(hor,gnd,pow(-el,0.4));
  if(el>0.0){
    vec2 uv=dir.xz/(dir.y+0.1)*2.0;
    float n1=snoise(uv*0.8+time*0.015)*0.5+0.5;
    float n2=snoise(uv*1.6+time*0.025)*0.5+0.5;
    float n3=snoise(uv*3.2+time*0.035)*0.5+0.5;
    float cloud=n1*0.6+n2*0.3+n3*0.1;
    float thr=1.0-cloudCover;
    cloud=smoothstep(thr,thr+0.25,cloud);
    vec3 cc=mix(vec3(0.55,0.58,0.62),vec3(0.95),brightness);
    sky=mix(sky,cc,cloud*0.85);
  }
  gl_FragColor=vec4(sky,1.0);
}`;
const skyMat = new THREE.ShaderMaterial({
  vertexShader: skyVert, fragmentShader: skyFrag,
  uniforms: { brightness: { value: 1.0 }, cloudCover: { value: 0.15 }, time: { value: 0 } },
  side: THREE.BackSide, depthWrite: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 32), skyMat);
scene.add(skyDome);

// ── Lighting ───────────────────────────────────────────────────
const hemiLight = new THREE.HemisphereLight('#b7d7ff', '#2a3a1e', 2.0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ffe8c0', 1.6);
sunLight.position.set(6, 12, 4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.setScalar(2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 30;
sunLight.shadow.camera.left = -12;
sunLight.shadow.camera.right = 12;
sunLight.shadow.camera.top = 12;
sunLight.shadow.camera.bottom = -12;
scene.add(sunLight);

// ── Ground ─────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: '#1a3010', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── Garden bed ─────────────────────────────────────────────────
const gardenBed = new THREE.Mesh(
  new THREE.BoxGeometry(7, 0.4, 5),
  new THREE.MeshStandardMaterial({ color: '#4a3624', roughness: 0.95 }),
);
gardenBed.position.set(0, 0.2, -1.5);
gardenBed.castShadow = true;
gardenBed.receiveShadow = true;
scene.add(gardenBed);

// ── Instanced grass ────────────────────────────────────────────
const grassVert = `
precision mediump float;
attribute vec3 offset;
attribute vec4 orientation;
attribute float halfRootAngleSin;
attribute float halfRootAngleCos;
attribute float stretch;
uniform float time, bladeHeight;
uniform vec3 slugPosition;
varying vec2 vUv;
varying float frc;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x_=2.0*fract(p*C.www)-1.0;vec3 h=abs(x_)-0.5;
  vec3 ox=floor(x_+0.5);vec3 a0=x_-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
vec3 rotateVec(vec3 v,vec4 q){return 2.0*cross(q.xyz,v*q.w+cross(q.xyz,v))+v;}
vec4 slerp(vec4 v0,vec4 v1,float t){
  normalize(v0);normalize(v1);
  float d=dot(v0,v1);
  if(d<0.0){v1=-v1;d=-d;}
  if(d>0.9995){vec4 r=t*(v1-v0)+v0;normalize(r);return r;}
  float t0=acos(d);float th=t0*t;
  float st=sin(th);float st0=sin(t0);
  float s0=cos(th)-d*st/st0;float s1=st/st0;
  return s0*v0+s1*v1;
}
void main(){
  frc=position.y/bladeHeight;
  float noise=1.0-(snoise(vec2(time-offset.x/50.0,time-offset.z/50.0)));
  vec4 dir=vec4(0.0,halfRootAngleSin,0.0,halfRootAngleCos);
  dir=slerp(dir,orientation,frc);
  vec3 vPos=vec3(position.x,position.y+position.y*stretch,position.z);
  vPos=rotateVec(vPos,dir);
  float ha=noise*0.15;
  vPos=rotateVec(vPos,normalize(vec4(sin(ha),0.0,-sin(ha),cos(ha))));
  // Slug interaction
  vec2 toSlug=offset.xz-slugPosition.xz;
  float sd=length(toSlug);
  float influence=smoothstep(1.8,0.0,sd)*frc;
  if(sd>0.001){
    vec2 pd=normalize(toSlug);
    vPos.xz+=pd*influence*0.7;
    vPos.y-=influence*0.2;
  }
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(offset+vPos,1.0);
}`;
const grassFrag = `
precision mediump float;
uniform sampler2D map;
uniform sampler2D alphaMap;
uniform vec3 tipColor, bottomColor;
varying vec2 vUv;
varying float frc;
void main(){
  float alpha=texture2D(alphaMap,vUv).r;
  if(alpha<0.15)discard;
  vec4 col=texture2D(map,vUv);
  col=mix(vec4(tipColor,1.0),col,frc);
  col=mix(vec4(bottomColor,1.0),col,frc);
  gl_FragColor=col;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function multiplyQuat(a: THREE.Vector4, b: THREE.Vector4) {
  const x = a.x*b.w + a.y*b.z - a.z*b.y + a.w*b.x;
  const y = -a.x*b.z + a.y*b.w + a.z*b.x + a.w*b.y;
  const z = a.x*b.y - a.y*b.x + a.z*b.w + a.w*b.z;
  const w = -a.x*b.x - a.y*b.y - a.z*b.z + a.w*b.w;
  a.set(x, y, z, w);
}

function createGrass(): THREE.ShaderMaterial {
  const COUNT = 20000, AREA = 32, BW = 0.1, BH = 0.8, JOINTS = 5;
  const bladeTex = createBladeTexture();
  const bladeAlpha = createBladeAlpha();
  const base = new THREE.PlaneGeometry(BW, BH, 1, JOINTS);
  base.translate(0, BH / 2, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  geo.instanceCount = COUNT;

  const offsets = new Float32Array(COUNT * 3);
  const orientations = new Float32Array(COUNT * 4);
  const stretches = new Float32Array(COUNT);
  const sinArr = new Float32Array(COUNT);
  const cosArr = new Float32Array(COUNT);
  const q0 = new THREE.Vector4(), q1 = new THREE.Vector4();

  for (let i = 0; i < COUNT; i++) {
    let ox = Math.random() * AREA - AREA / 2;
    const oz = Math.random() * AREA - AREA / 2;
    // Skip garden bed
    if (Math.abs(ox) < 4 && oz > -4.5 && oz < 1.0) {
      ox = (Math.random() > 0.5 ? 1 : -1) * (4.5 + Math.random() * 11);
    }
    offsets[i * 3] = ox; offsets[i * 3 + 1] = 0; offsets[i * 3 + 2] = oz;

    let angle = Math.PI - Math.random() * 2 * Math.PI;
    sinArr[i] = Math.sin(0.5 * angle);
    cosArr[i] = Math.cos(0.5 * angle);
    q0.set(0, Math.sin(angle / 2), 0, Math.cos(angle / 2)).normalize();

    angle = Math.random() * 0.5 - 0.25;
    q1.set(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)).normalize();
    multiplyQuat(q0, q1);

    angle = Math.random() * 0.5 - 0.25;
    q1.set(0, 0, Math.sin(angle / 2), Math.cos(angle / 2)).normalize();
    multiplyQuat(q0, q1);

    orientations[i * 4] = q0.x; orientations[i * 4 + 1] = q0.y;
    orientations[i * 4 + 2] = q0.z; orientations[i * 4 + 3] = q0.w;
    stretches[i] = i < COUNT / 3 ? Math.random() * 1.8 : Math.random();
  }

  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('orientation', new THREE.InstancedBufferAttribute(orientations, 4));
  geo.setAttribute('stretch', new THREE.InstancedBufferAttribute(stretches, 1));
  geo.setAttribute('halfRootAngleSin', new THREE.InstancedBufferAttribute(sinArr, 1));
  geo.setAttribute('halfRootAngleCos', new THREE.InstancedBufferAttribute(cosArr, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: grassVert, fragmentShader: grassFrag,
    uniforms: {
      bladeHeight: { value: BH }, map: { value: bladeTex }, alphaMap: { value: bladeAlpha },
      time: { value: 0 },
      tipColor: { value: new THREE.Color(0.1, 0.55, 0.1) },
      bottomColor: { value: new THREE.Color(0.0, 0.08, 0.0) },
      slugPosition: { value: new THREE.Vector3(0, 0, 3) },
    },
    side: THREE.DoubleSide, toneMapped: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mat;
}

const grassMat = createGrass();

// ── Lily flowers ───────────────────────────────────────────────
function createPetalGeom(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.09, 0.1, 0.13, 0.28, 0.07, 0.42);
  s.bezierCurveTo(0.02, 0.47, -0.02, 0.47, -0.07, 0.42);
  s.bezierCurveTo(-0.13, 0.28, -0.09, 0.1, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, -y * y * 1.6);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function createLeafGeom(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.06, 0.08, 0.08, 0.2, 0.03, 0.35);
  s.bezierCurveTo(0, 0.38, -0.03, 0.35, -0.03, 0.35);
  s.bezierCurveTo(-0.08, 0.2, -0.06, 0.08, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setZ(i, -y * y * 0.8);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function createLily(c1: string, c2: string): THREE.Group {
  const lily = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: '#3a6e2a', roughness: 0.9 });

  // Curved stem
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, 0.3, 0.01),
    new THREE.Vector3(-0.01, 0.6, -0.01), new THREE.Vector3(0.01, 0.85, 0),
  ]);
  const stemMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 6, false), stemMat);
  stemMesh.castShadow = true;
  lily.add(stemMesh);

  // 6 petals, alternating outer/inner
  const petalG = createPetalGeom();
  const outerMat = new THREE.MeshStandardMaterial({ color: c1, roughness: 0.65, side: THREE.DoubleSide });
  const innerMat = new THREE.MeshStandardMaterial({ color: c2, roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const inner = i % 2 === 1;
    const p = new THREE.Mesh(petalG, inner ? innerMat : outerMat);
    p.position.set(0, 0.85, 0);
    p.rotation.y = (i / 6) * Math.PI * 2;
    p.rotation.x = inner ? -0.5 : -0.35;
    p.scale.setScalar(inner ? 0.78 : 1);
    p.castShadow = true;
    lily.add(p);
  }

  // Center + stamens
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#e8d44d', roughness: 0.6 }),
  );
  center.position.set(0, 0.88, 0);
  lily.add(center);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const st = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4),
      new THREE.MeshStandardMaterial({ color: '#8a7a30' }),
    );
    st.position.set(Math.cos(a) * 0.04, 0.93, Math.sin(a) * 0.04);
    st.rotation.z = Math.cos(a) * 0.3; st.rotation.x = Math.sin(a) * 0.3;
    lily.add(st);
    const anther = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 6, 6),
      new THREE.MeshStandardMaterial({ color: '#c4640a' }),
    );
    anther.position.set(Math.cos(a) * 0.06, 1.02, Math.sin(a) * 0.06);
    lily.add(anther);
  }

  // Leaves on stem
  const leafG = createLeafGeom();
  for (let i = 0; i < 2; i++) {
    const lf = new THREE.Mesh(leafG, stemMat);
    lf.position.set(0, 0.2 + i * 0.25, 0);
    lf.rotation.y = i * Math.PI * 0.7; lf.rotation.z = 0.4;
    lf.scale.setScalar(0.6); lf.castShadow = true;
    lily.add(lf);
  }
  return lily;
}

const lilyColors: [string, string][] = [
  ['#e85d75', '#f7a0b0'], ['#f0f0f0', '#ffe8a0'],
  ['#d44d8a', '#f090c0'], ['#ff8844', '#ffcc88'],
];

const plants: THREE.Group[] = [];
const plantPositions = [
  [-2.2, 0.4, -1.8], [0.2, 0.4, -0.7],
  [2.1, 0.4, -2.4], [-1.1, 0.4, 0.1],
];
plantPositions.forEach(([x, y, z], i) => {
  const [c1, c2] = lilyColors[i % lilyColors.length];
  const lily = createLily(c1, c2);
  lily.position.set(x, y, z);
  lily.scale.setScalar(0.9 + i * 0.05);
  plants.push(lily);
  scene.add(lily);
});

// ── Danger zone ────────────────────────────────────────────────
const dangerZone = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.8, 32),
  new THREE.MeshBasicMaterial({ color: '#ff6a3d', transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
);
dangerZone.rotation.x = -Math.PI / 2;
dangerZone.position.set(2.8, 0.02, 2.2);
scene.add(dangerZone);

// ── Slug ───────────────────────────────────────────────────────
const slug = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 24, 16),
  new THREE.MeshStandardMaterial({ color: '#9c5823', roughness: 0.85, metalness: 0.05 }),
);
body.scale.set(1.5, 0.7, 1);
body.position.y = 0.25;
body.castShadow = true;
slug.add(body);

const tail = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16), body.material);
tail.scale.set(1.2, 0.5, 0.9);
tail.position.set(-0.7, 0.2, 0);
tail.castShadow = true;
slug.add(tail);

const slimeTrail = new THREE.Mesh(
  new THREE.CircleGeometry(0.4, 24),
  new THREE.MeshStandardMaterial({ color: '#8ce7c5', transparent: true, opacity: 0.28 }),
);
slimeTrail.rotation.x = -Math.PI / 2;
slimeTrail.position.set(-0.7, 0.01, 0);
slug.add(slimeTrail);

const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#111' });
const eyeStalkGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 8);
const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);

const eyeRigLeft = new THREE.Group();
eyeRigLeft.position.set(0.38, 0.48, -0.16);
slug.add(eyeRigLeft);
const eyeRigRight = new THREE.Group();
eyeRigRight.position.set(0.38, 0.48, 0.16);
slug.add(eyeRigRight);

const leftStalk = new THREE.Mesh(eyeStalkGeo, body.material);
leftStalk.position.y = 0.2; leftStalk.castShadow = true;
eyeRigLeft.add(leftStalk);
const rightStalk = new THREE.Mesh(eyeStalkGeo, body.material);
rightStalk.position.y = 0.2; rightStalk.castShadow = true;
eyeRigRight.add(rightStalk);

const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
leftEye.position.y = 0.42;
eyeRigLeft.add(leftEye);
const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
rightEye.position.y = 0.42;
eyeRigRight.add(rightEye);

slug.position.set(0, 0, 3);
scene.add(slug);

// ── Human (more detailed) ──────────────────────────────────────
const human = new THREE.Group();
const hBodyMat = new THREE.MeshStandardMaterial({ color: '#4a5d6e', roughness: 0.9 });
const hSkinMat = new THREE.MeshStandardMaterial({ color: '#d8b08e', roughness: 0.85 });
const hPantsMat = new THREE.MeshStandardMaterial({ color: '#3a4a35', roughness: 0.92 });
const hBootMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.95 });
const hHairMat = new THREE.MeshStandardMaterial({ color: '#4a3525', roughness: 0.95 });
const hHatMat = new THREE.MeshStandardMaterial({ color: '#c4a965', roughness: 0.95 });

// Torso
const hTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 8, 12), hBodyMat);
hTorso.position.y = 1.15; hTorso.castShadow = true;
human.add(hTorso);

// Head + hair + hat
const hHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), hSkinMat);
hHead.position.y = 1.72; hHead.castShadow = true;
human.add(hHead);
const hHair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hHairMat);
hHair.position.y = 1.76; hHair.castShadow = true;
human.add(hHair);
const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 16), hHatMat);
hatBrim.position.y = 1.88; hatBrim.castShadow = true;
human.add(hatBrim);
const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.14, 12), hHatMat);
hatTop.position.y = 1.94; hatTop.castShadow = true;
human.add(hatTop);

// Arms
function makeArm(side: number): THREE.Group {
  const arm = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 6, 8), hBodyMat);
  upper.position.y = -0.15; upper.castShadow = true; arm.add(upper);
  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 6, 8), hSkinMat);
  lower.position.y = -0.42; lower.castShadow = true; arm.add(lower);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), hSkinMat);
  hand.position.y = -0.58; hand.castShadow = true; arm.add(hand);
  arm.position.set(side * 0.26, 1.35, 0);
  arm.rotation.z = side * 0.15;
  return arm;
}
const humanLeftArm = makeArm(-1);
const humanRightArm = makeArm(1);
human.add(humanLeftArm);
human.add(humanRightArm);

// Legs
function makeLeg(side: number): THREE.Group {
  const leg = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 6, 8), hPantsMat);
  upper.position.y = -0.16; upper.castShadow = true; leg.add(upper);
  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 6, 8), hPantsMat);
  lower.position.y = -0.48; lower.castShadow = true; leg.add(lower);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), hBootMat);
  boot.position.set(0, -0.68, 0.03); boot.castShadow = true; leg.add(boot);
  leg.position.set(side * 0.1, 0.74, 0);
  return leg;
}
const humanLeftLeg = makeLeg(-1);
const humanRightLeg = makeLeg(1);
human.add(humanLeftLeg);
human.add(humanRightLeg);

// Shovel
const shovel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.025, 0.03, 1.1, 6),
  new THREE.MeshStandardMaterial({ color: '#8c6843', roughness: 0.9 }),
);
shovel.position.set(0.26, 0.9, 0.15); shovel.rotation.z = -0.15; shovel.castShadow = true;
human.add(shovel);
const shovelBlade = new THREE.Mesh(
  new THREE.BoxGeometry(0.2, 0.22, 0.03),
  new THREE.MeshStandardMaterial({ color: '#8a9199', roughness: 0.5, metalness: 0.3 }),
);
shovelBlade.position.set(0.26, 0.38, 0.15); shovelBlade.castShadow = true;
human.add(shovelBlade);

// Detection cone
const detectionCone = new THREE.Mesh(
  new THREE.ConeGeometry(1.8, 3.6, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: '#ffd56a', transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
);
detectionCone.rotation.x = Math.PI / 2;
detectionCone.position.set(0, 0.3, -1.8);
human.add(detectionCone);

human.position.set(-4.2, 0, -3.4);
scene.add(human);

// ── Rain ───────────────────────────────────────────────────────
const RAIN_COUNT = 4000;
const rainPositions = new Float32Array(RAIN_COUNT * 3);
const rainSpeeds = new Float32Array(RAIN_COUNT);
for (let i = 0; i < RAIN_COUNT; i++) {
  rainPositions[i * 3] = Math.random() * 40 - 20;
  rainPositions[i * 3 + 1] = Math.random() * 15;
  rainPositions[i * 3 + 2] = Math.random() * 40 - 20;
  rainSpeeds[i] = 8 + Math.random() * 6;
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMaterial = new THREE.PointsMaterial({
  color: '#aaccee', size: 0.06, transparent: true, opacity: 0,
  depthWrite: false, sizeAttenuation: true,
});
const rain = new THREE.Points(rainGeo, rainMaterial);
scene.add(rain);

function updateRain(delta: number) {
  if (weather.currentRain < 0.01) return;
  const pos = rainGeo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < RAIN_COUNT; i++) {
    arr[i * 3 + 1] -= rainSpeeds[i] * delta;
    arr[i * 3] += delta * 0.5; // slight wind drift
    if (arr[i * 3 + 1] < 0) {
      arr[i * 3] = slug.position.x + Math.random() * 30 - 15;
      arr[i * 3 + 1] = 10 + Math.random() * 5;
      arr[i * 3 + 2] = slug.position.z + Math.random() * 30 - 15;
    }
  }
  pos.needsUpdate = true;
}

// ── Game state & patrol ────────────────────────────────────────
const patrolPoints = [
  new THREE.Vector3(-4.2, 0, -3.4), new THREE.Vector3(3.8, 0, -3.1),
  new THREE.Vector3(3.2, 0, 2.4), new THREE.Vector3(-3.9, 0, 2.7),
];
let patrolIndex = 0;
const humanForward = new THREE.Vector3(0, 0, -1);

const keys = new Set<string>();
const slugBounds = 6.5;
let eatenPlants = 0;
let isEyeViewEnabled = false;
let lastMoveDirection = new THREE.Vector3(0, 0, -1);
let gameState: 'playing' | 'won' | 'lost' = 'playing';

// ── HUD ────────────────────────────────────────────────────────
const hud = document.createElement('div');
hud.className = 'hud';
hud.innerHTML = `
  <h1>sluger</h1>
  <p>WASD / pilar: kryp</p>
  <p>V: växla snigelperspektiv</p>
  <p>Ät liljor genom att nudda dem.</p>
  <p>Undvik kokande vatten och människan med spaden.</p>
  <p class="status">Liljor uppätna: 0 / ${plants.length}</p>
`;
app.appendChild(hud);
const status = hud.querySelector<HTMLParagraphElement>('.status');

// ── Input ──────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keys.add(key);
  if (key === 'v' && !e.repeat) {
    isEyeViewEnabled = !isEyeViewEnabled;
    hud.classList.toggle('eye-mode', isEyeViewEnabled);
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Update functions ───────────────────────────────────────────
function updateSlug(delta: number) {
  if (gameState !== 'playing') return;
  const dir = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) dir.z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dir.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) dir.x -= 1;
  if (keys.has('d') || keys.has('arrowright')) dir.x += 1;
  if (dir.lengthSq() > 0) {
    dir.normalize();
    lastMoveDirection = dir.clone();
    slug.position.addScaledVector(dir, 2.1 * delta);
    slug.rotation.y = Math.atan2(dir.x, dir.z);
  }
  slug.position.x = THREE.MathUtils.clamp(slug.position.x, -slugBounds, slugBounds);
  slug.position.z = THREE.MathUtils.clamp(slug.position.z, -slugBounds, slugBounds);
  const wiggle = Math.sin(timer.getElapsed() * 8) * 0.04;
  body.position.y = 0.25 + wiggle;
  tail.position.y = 0.2 - wiggle * 0.5;

  // Pass slug position to grass shader
  grassMat.uniforms.slugPosition.value.copy(slug.position);
}

function updateEyes() {
  const toDanger = dangerZone.position.clone().sub(slug.position);
  const dangerDist = toDanger.length();
  const hasNearbyDanger = dangerDist < 3.5;
  const look = hasNearbyDanger ? toDanger.normalize() : lastMoveDirection.clone();
  const baseYaw = Math.atan2(look.x, look.z) - slug.rotation.y;
  const scan = Math.sin(timer.getElapsed() * 1.8) * 0.45;
  const alert = hasNearbyDanger ? 0.55 : 0.2;
  const pitch = hasNearbyDanger ? -0.2 : -0.05;
  eyeRigLeft.rotation.set(pitch, baseYaw - alert - scan, -0.15);
  eyeRigRight.rotation.set(pitch, baseYaw + alert + scan, 0.15);
}

function updatePlants() {
  if (gameState !== 'playing') return;
  plants.forEach((plant) => {
    if (!plant.visible) return;
    if (plant.position.distanceTo(slug.position) < 0.85) {
      plant.visible = false;
      eatenPlants += 1;
    }
  });
  if (status) {
    if (eatenPlants === plants.length) {
      gameState = 'won';
      status.textContent = 'Alla liljor uppätna. Trädgården är förstörd!';
      status.classList.add('win');
    } else {
      status.textContent = `Liljor uppätna: ${eatenPlants} / ${plants.length}`;
    }
  }
}

function updateDanger() {
  const distance = dangerZone.position.distanceTo(slug.position);
  if (!status) return;
  if (gameState === 'playing' && distance < 0.78) {
    gameState = 'lost';
    status.textContent = 'Du blev kokt. Snigelkvällen är över.';
    status.classList.remove('win');
    status.classList.add('lose');
  } else if (gameState === 'playing' && !status.classList.contains('win')) {
    status.classList.remove('lose');
  }
}

function updateHuman(delta: number) {
  const target = patrolPoints[patrolIndex];
  const movement = target.clone().sub(human.position);
  movement.y = 0;

  const isMoving = movement.lengthSq() >= 0.05;
  if (!isMoving) {
    patrolIndex = (patrolIndex + 1) % patrolPoints.length;
  } else {
    movement.normalize();
    human.position.addScaledVector(movement, delta * 1.05);
    human.lookAt(human.position.x + movement.x, 1.2, human.position.z + movement.z);
  }

  // Walking animation
  const walkCycle = Math.sin(timer.getElapsed() * 5) * (isMoving ? 0.35 : 0);
  humanLeftLeg.rotation.x = walkCycle;
  humanRightLeg.rotation.x = -walkCycle;
  humanLeftArm.rotation.x = -walkCycle * 0.5;
  humanRightArm.rotation.x = walkCycle * 0.5;

  humanForward.set(0, 0, -1).applyQuaternion(human.quaternion).normalize();
  (detectionCone.material as THREE.MeshBasicMaterial).opacity = gameState === 'playing' ? 0.14 : 0.06;

  if (gameState !== 'playing' || !status) return;
  const toSlug = slug.position.clone().sub(human.position);
  const dist = toSlug.length();
  const toSlugDir = toSlug.normalize();
  const angle = humanForward.angleTo(toSlugDir);
  if (dist < 4.2 && angle < 0.58) {
    gameState = 'lost';
    status.textContent = 'Människan såg dig. Spaden kom först.';
    status.classList.remove('win');
    status.classList.add('lose');
    (detectionCone.material as THREE.MeshBasicMaterial).opacity = 0.26;
  }
}

function updateCamera() {
  if (isEyeViewEnabled) return;
  const t = new THREE.Vector3(slug.position.x, 4.5, slug.position.z + 7);
  camera.position.lerp(t, 0.05);
  camera.lookAt(slug.position.x, 0.6, slug.position.z - 0.2);
}

// ── Eye cameras ────────────────────────────────────────────────
const leftEyeCamera = new THREE.PerspectiveCamera(95, 1, 0.01, 30);
leftEyeCamera.position.set(0, 0.42, 0);
leftEyeCamera.rotation.order = 'YXZ';
eyeRigLeft.add(leftEyeCamera);

const rightEyeCamera = new THREE.PerspectiveCamera(95, 1, 0.01, 30);
rightEyeCamera.position.set(0, 0.42, 0);
rightEyeCamera.rotation.order = 'YXZ';
eyeRigRight.add(rightEyeCamera);

function renderEyeViews() {
  const iw = Math.floor(window.innerWidth * 0.35);
  const ih = Math.floor(window.innerHeight * 0.35);
  const m = 18;
  renderer.clearDepth();
  renderer.setScissorTest(true);
  renderer.setViewport(m, m, iw, ih);
  renderer.setScissor(m, m, iw, ih);
  renderer.render(scene, leftEyeCamera);
  renderer.clearDepth();
  renderer.setViewport(window.innerWidth - iw - m, m, iw, ih);
  renderer.setScissor(window.innerWidth - iw - m, m, iw, ih);
  renderer.render(scene, rightEyeCamera);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
}

// ── Main loop ──────────────────────────────────────────────────
function animate() {
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.1);
  const elapsed = timer.getElapsed();

  // Update grass time + weather
  grassMat.uniforms.time.value = elapsed * 0.25;
  skyMat.uniforms.time.value = elapsed;
  updateWeather(delta, elapsed);
  updateRain(delta);

  updateSlug(delta);
  updateEyes();
  updateHuman(delta);
  updatePlants();
  updateDanger();
  updateCamera();

  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  renderer.clear();
  renderer.render(scene, camera);
  if (isEyeViewEnabled) renderEyeViews();

  requestAnimationFrame(animate);
}

animate();
