import { PARTNER, nearPartnerTrail } from "./game/partner";
import { LETTUCE } from "./game/food";
import { HAZARD_SITES } from "./game/hazards";
import { LAWN, onLawn } from "./game/lawn";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { stoneKit, scatterStones } from "./stones";
import { FLOWERS, HOME, WATER, SALT, type Obstacle } from "./game/rules";

let seed = 781;
export function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
}
export function height(x:number,z:number) {
  let ground=.035*Math.sin(x*1.8+z)+.022*Math.cos(z*2.3-x*.8);
  for(const w of WATER){const r=Math.hypot(x-w.x,z-w.z)/w.radius;const basin=1-T.MathUtils.smoothstep(r,.72,1.18);ground=T.MathUtils.lerp(ground,-.065+.009*Math.sin(x*5+z*4),basin);}
  return ground;
}
export function supportedHeight(x:number,z:number){
  let y=height(x,z);
  for(let step=-9;step<9;step+=1.8){const dx=(x-Math.sin(step)*.18)/.85,dz=(z-step)/.52;if(dx*dx+dz*dz<.9)y=Math.max(y,.065);}
  return y;
}
const sphere = new T.SphereGeometry(1, 16, 12);
const box = new T.BoxGeometry(1, 1, 1);
export function material(color: string, roughness = 0.85) {
  return new T.MeshStandardMaterial({ color, roughness });
}
export function mesh(
  geo: T.BufferGeometry,
  mat: T.Material,
  parent: T.Object3D,
  p: number[],
  s = [1, 1, 1],
) {
  const m = new T.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function texture(kind: "soil" | "wood" | "skin" | "leaf") {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle =
    kind === "soil"
      ? "#514431"
      : kind === "wood"
        ? "#71614a"
        : kind === "skin"
          ? "#b17a41"
          : "#647d36";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 17000; i++) {
    const x = random() * 512,
      y = random() * 512,
      v = random();
    ctx.fillStyle = `rgba(${v > 0.5 ? "230,211,161" : "13,18,7"},${random() * 0.25})`;
    if (kind === "wood")
      ctx.fillRect(x, y, 0.5 + random() * 2, 8 + random() * 110);
    else {
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        0.5 + random() * (kind === "skin" ? 3 : 2),
        0.5 + random() * 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  if (kind === "leaf") {
    ctx.strokeStyle = "#b3ba6a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 13; i++) {
      const y = i * 40;
      ctx.beginPath();
      ctx.moveTo(0, y - 120);
      ctx.quadraticCurveTo(90, y - 15, 256, y + 60);
      ctx.quadraticCurveTo(390, y - 15, 512, y - 120);
      ctx.stroke();
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function leafGeometry(width = 0.35, length = 1, columns = 6, rows = 12) {
  const geo = new T.PlaneGeometry(1, 1, columns, rows),
    pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2,
      v = pos.getY(i) + 0.5;
    const w = Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.72);
    pos.setXYZ(
      i,
      u * width * w,
      v * length,
      Math.abs(u) * w * 0.075 - v * v * length * 0.42 + Math.sin(v * 9) * 0.025,
    );
  }
  geo.computeVertexNormals();
  return geo;
}
export function buildWorld(scene: T.Scene) {
  const originalChildren = new Set(scene.children);
  const soilTex = texture("soil");
  soilTex.repeat.set(24, 24);
  const soil = new T.MeshStandardMaterial({
    map: soilTex,
    bumpMap: soilTex,
    bumpScale: 0.11,
    roughness: 0.96,
    color: "#b0a18b",
  });
  const groundGeo = new T.PlaneGeometry(80, 80, 240, 240);
  groundGeo.rotateX(-Math.PI / 2);
  const p = groundGeo.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    p.setY(i, height(x, z));
    const path = Math.abs(x) < 1.6 || Math.abs(z - 7.5) < 0.75;
    const col = new T.Color(path ? "#b4a18a" : "#69733e");
    col.multiplyScalar(0.85 + random() * 0.15);
    colors.push(col.r, col.g, col.b);
  }
  groundGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  soil.vertexColors = true;
  mesh(groundGeo, soil, scene, [0, -0.04, 0]).castShadow = false;
  const loader = new T.TextureLoader();
  const loadTexture = (name: string, color = false) => {
    const t = loader.load("/textures/" + name + ".jpg");
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (color) t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  const woodTex = loadTexture("s_weathered_brown_planks_a", true);
  const woodNormal = loadTexture("s_weathered_brown_planks_n");
  const woodRough = loadTexture("s_weathered_brown_planks_r");
  const wood = new T.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    normalScale: new T.Vector2(0.7, 0.7),
    roughnessMap: woodRough,
    roughness: 0.92,
    color: "#a29a83",
  });
  const stones=stoneKit();
  const stone=stones.material;
  const terracotta = material("#a56143");
  const dark = material("#282b21");
  const green = material("#4a6030");
  const obstacles: Obstacle[] = [];
  // Fenced kitchen garden. The low edges are deliberately traversable by the slug.
  for (const x of [-11.8, 11.8])
    for (let z = -12; z < 13; z += 0.67)
      mesh(box, wood, scene, [x, 1.6, z], [0.17, 3.3 + random() * 0.15, 0.55]);
  for (let x = -12; x <= 12; x += 0.67)
    mesh(box, wood, scene, [x, 1.6, -12], [0.55, 3.3 + random() * 0.12, 0.17]);
  for (const x of [-11.6, 11.6])
    for (const y of [0.7, 2.3])
      mesh(box, wood, scene, [x, y, 0], [0.18, 0.15, 25]);
  for (const x of [-5.5, 5.5]) {
    for (const side of [-1, 1])
      mesh(box, wood, scene, [x + side * 3.1, 0.08, -1], [0.12, 0.16, 16]);
    for (const z of [-9, 7])
      mesh(box, wood, scene, [x, 0.08, z], [6.3, 0.16, 0.14]);
  }
  // Weathered, irregular flagstones: a chipped silhouette, rounded edges and scanned rock surfaces.
  let slabIndex=0;
  for(let z=-9;z<9;z+=1.8){
    const slab=mesh(stones.geometry(100+slabIndex++*7,14,true),stone,scene,[Math.sin(z)*.18,-.008,z],[1.05,1,.9]);
    slab.rotation.y=(random()-.5)*.35;
  }
  // A cottage anchors the skyline instead of an empty horizon.
  const house = new T.Group();
  house.position.set(2, 0, -20);
  scene.add(house);
  const siding = new T.MeshStandardMaterial({
    map: loadTexture("s_weathered_peeling_timber_a", true),
    normalMap: loadTexture("s_weathered_peeling_timber_n"),
    roughness: 0.9,
    color: "#b8bda8",
  });
  siding.map!.repeat.set(4, 2);
  siding.normalMap!.repeat.set(4, 2);
  mesh(box, siding, house, [0, 3, 0], [12, 6, 7]);
  const trim = material("#c4c0a3");
  for (const x of [-6, 6])
    mesh(box, trim, house, [x, 3, 3.55], [0.18, 6.1, 0.18]);
  mesh(box, trim, house, [0, 5.9, 3.6], [12.3, 0.22, 0.2]);
  mesh(box, trim, house, [0, 0.3, 3.6], [12.3, 0.32, 0.2]);
  for (const x of [-3.8, 0, 3.8])
    mesh(box, trim, house, [x, 1.55, 3.8], [2.3, 0.15, 0.45]);
  const roof = mesh(
    new T.ConeGeometry(1, 1, 4),
    material("#474942"),
    house,
    [0, 7, 0],
    [9.2, 3, 6.2],
  );
  roof.rotation.y = Math.PI / 4;
  for (const x of [-3.8, 0, 3.8]) {
    mesh(box, wood, house, [x, 3, 3.54], [2, 2.8, 0.16]);
    const glass = new T.MeshStandardMaterial({
      color: "#e7b679",
      emissive: "#edac53",
      emissiveIntensity: 1.3,
      roughness: 0.3,
    });
    mesh(box, glass, house, [x, 3, 3.64], [1.7, 2.5, 0.04]);
    mesh(box, wood, house, [x, 3, 3.7], [0.1, 2.5, 0.07]);
    mesh(box, wood, house, [x, 3, 3.7], [1.7, 0.1, 0.07]);
  }
  mesh(box, stone, house, [3, 8, -1], [0.9, 3, 1]);
  // Large trees, with hundreds of individual leafy clusters, behind the garden.
  const leavesTex = texture("leaf");
  const leafMat = new T.MeshStandardMaterial({
    map: leavesTex,
    color: "#9caf57",
    roughness: 0.88,
    side: T.DoubleSide,
  });
  // Baked leaf clusters keep distant canopies fine-grained at four triangles per cluster.
  const canopyCanvas = document.createElement("canvas");
  canopyCanvas.width = canopyCanvas.height = 256;
  const canopyCtx = canopyCanvas.getContext("2d")!;
  for (let i = 0; i < 45; i++) {
    const a = random() * Math.PI * 2,
      r = Math.sqrt(random()) * 100,
      x = 128 + Math.cos(a) * r,
      y = 128 + Math.sin(a) * r;
    canopyCtx.save();
    canopyCtx.translate(x, y);
    canopyCtx.rotate(a + random());
    canopyCtx.fillStyle = `hsl(${75 + random() * 25},${25 + random() * 25}%,${27 + random() * 24}%)`;
    canopyCtx.beginPath();
    canopyCtx.moveTo(0, -17);
    canopyCtx.bezierCurveTo(15, -3, 12, 9, 0, 19);
    canopyCtx.bezierCurveTo(-12, 7, -13, -5, 0, -17);
    canopyCtx.fill();
    canopyCtx.strokeStyle = "#a1ad6255";
    canopyCtx.lineWidth = 0.7;
    canopyCtx.beginPath();
    canopyCtx.moveTo(0, -13);
    canopyCtx.lineTo(0, 16);
    canopyCtx.stroke();
    canopyCtx.restore();
  }
  const canopyTexture = new T.CanvasTexture(canopyCanvas);
  canopyTexture.colorSpace = T.SRGBColorSpace;
  const canopyMat = new T.MeshStandardMaterial({
    map: canopyTexture,
    alphaTest: 0.5,
    side: T.DoubleSide,
    roughness: 1,
  });
  const treeGeo = new T.PlaneGeometry(1.6, 1.4);
  const treeLeaves = new T.InstancedMesh(treeGeo, canopyMat, 1260);
  treeLeaves.castShadow = true;
  scene.add(treeLeaves);
  const dummy = new T.Object3D();
  let ti = 0;
  for (const [x, z, size] of [
    [-14, -10, 1],
    [14, -14, 1.3],
    [-12, -22, 1.4],
    [16, 5, 1],
    [-16, 5, 1.2],
    [1, -28, 1.4],
  ]) {
    mesh(
      new T.CylinderGeometry(0.22 * size, 0.5 * size, 9 * size, 9),
      wood,
      scene,
      [x, 4.4 * size, z],
    );
    for (let j = 0; j < 7; j++) {
      const a = j * 2.4,
        radius = 1.6 + random() * 2.1;
      const branch = mesh(
        new T.CylinderGeometry(0.07, 0.17, 3.5, 7),
        wood,
        scene,
        [x + Math.cos(a) * 0.65, 7.1 * size, z + Math.sin(a) * 0.65],
      );
      branch.rotation.z = Math.cos(a) * 0.8;
      branch.rotation.x = Math.sin(a) * 0.8;
      for (let k = 0; k < 30; k++) {
        const az = random() * Math.PI * 2,
          r = Math.sqrt(random()) * 2.1;
        dummy.position.set(
          x + Math.cos(a) * radius + Math.cos(az) * r,
          (7 + random() * 2.4) * size,
          z + Math.sin(a) * radius + Math.sin(az) * r,
        );
        dummy.rotation.set(random() * Math.PI, random() * 6, random() * 3);
        dummy.scale.setScalar(1.2 + random() * 1.3);
        dummy.updateMatrix();
        treeLeaves.setMatrixAt(ti++, dummy.matrix);
      }
    }
  }
  // Instanced grass: shadow-receiving PBR blades, curved geometry, continuous wind.
  const grassGeo = leafGeometry(0.045, 0.8, 1, 5);
  const grassMat = new T.MeshStandardMaterial({
    color: "#698338",
    side: T.DoubleSide,
    roughness: 0.94,
  });
  const wind = { value: 0 },
    slugPos = { value: new T.Vector3() };
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.uniforms.uSlug = slugPos;
    shader.vertexShader =
      "uniform float uTime; uniform vec3 uSlug;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 root = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
      float bend = uv.y * uv.y;
      transformed.x += sin(uTime * 1.3 + root.x * .8 + root.z * .5) * .10 * bend;
      transformed.z += cos(uTime + root.x * .6) * .055 * bend;
      vec2 away = root.xz - uSlug.xz;
      float press = (1. - smoothstep(.1, .85, length(away))) * bend;
      transformed.xz += normalize(away + vec2(.001)) * press * .35;
      transformed.y -= press * .25;`,
    );
  };
  const grass = new T.InstancedMesh(grassGeo, grassMat, 24000);
  grass.receiveShadow = true;
  scene.add(grass);
  let gi = 0;
  for (let i = 0; i < 35000 && gi < 24000; i++) {
    const x = random() * 48 - 24,
      z = random() * 44 - 20;
    if (
      nearPartnerTrail(x,z,.16) || Math.hypot(x-PARTNER.x,z-PARTNER.z)<1 ||
      HAZARD_SITES.some(p=>Math.hypot(x-p.x,z-p.z)<.85) ||
      Math.abs(x) < 1.7 ||
      Math.abs(z - 7.5) < 0.7 ||
      [...FLOWERS,...LETTUCE].some((f) => Math.hypot(f.x - x, f.z - z) < 0.65) ||
      WATER.some((w) => Math.hypot(w.x - x, w.z - z) < w.radius + 0.2)
    )
      continue;
    dummy.position.set(x, height(x, z) - 0.045, z);
    dummy.rotation.set(
      (random() - 0.5) * 0.25,
      random() * 6.28,
      (random() - 0.5) * 0.3,
    );
    const tall = onLawn({x,z}) ? .13 : Math.abs(x) > 9 ? 1.6 : 0.55;
    dummy.scale.set(0.7 + random() * 0.6, tall * (0.45 + random() * 1.1), 1);
    dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix);
    grass.setColorAt(
      gi++,
      new T.Color().setHSL(
        0.21 + random() * 0.05,
        0.33 + random() * 0.2,
        0.34 + random() * 0.22,
      ),
    );
  }
  grass.count = gi;
  // Dense short turf uses one draw call and stays low enough to read the mower.
  const turfGeo=new T.PlaneGeometry(LAWN.right-LAWN.left,LAWN.front-LAWN.back,32,32);turfGeo.rotateX(-Math.PI/2);
  const turfPos=turfGeo.getAttribute('position'),turfColors:number[]=[];
  for(let i=0;i<turfPos.count;i++){
    const x=turfPos.getX(i)+(LAWN.left+LAWN.right)/2,z=turfPos.getZ(i)+(LAWN.front+LAWN.back)/2;
    turfPos.setXYZ(i,x,height(x,z)-.022,z);
    const shade=.8+.12*Math.sin(x*3)+random()*.12,c=new T.Color('#53652b').multiplyScalar(shade);turfColors.push(c.r,c.g,c.b);
  }
  turfGeo.setAttribute('color',new T.Float32BufferAttribute(turfColors,3));turfGeo.computeVertexNormals();
  const turfMat=new T.MeshStandardMaterial({color:'#8eaa65',vertexColors:true,roughness:1,map:soilTex,bumpMap:soilTex,bumpScale:.016});
  const turf=new T.Mesh(turfGeo,turfMat);turf.receiveShadow=true;scene.add(turf);
  const shortGrass=new T.InstancedMesh(grassGeo,grassMat,6500);shortGrass.receiveShadow=true;scene.add(shortGrass);
  for(let i=0;i<6500;i++){
    const x=LAWN.left+random()*(LAWN.right-LAWN.left),z=LAWN.back+random()*(LAWN.front-LAWN.back);
    dummy.position.set(x,height(x,z)-.023,z);dummy.rotation.set(0,random()*Math.PI*2,0);dummy.scale.set(.3+random()*.35,.08+random()*.14,.4);dummy.updateMatrix();shortGrass.setMatrixAt(i,dummy.matrix);
    shortGrass.setColorAt(i,new T.Color().setHSL(.22+random()*.035,.4,.24+random()*.16));
  }
  // Low hostas / cover. Broad sculpted leaves with veins, no billboard silhouettes.
  const coverPlants: T.Group[] = [];
  const broadLeaf = leafGeometry(0.36, 1.25);
  for (let i = 0; i < 95; i++) {
    const x = (i % 2 ? -1 : 1) * (2.8 + random() * 6),
      z = -9 + random() * 16;
    if (nearPartnerTrail(x,z,.55) || Math.hypot(x-PARTNER.x,z-PARTNER.z)<1.7 || HAZARD_SITES.some(p=>Math.hypot(x-p.x,z-p.z)<1.6) || onLawn({x,z}) || [...FLOWERS,...LETTUCE].some((f) => Math.hypot(f.x - x, f.z - z) < 1.05)) continue;
    const group = new T.Group();
    group.position.set(x, height(x, z), z);
    scene.add(group);
    coverPlants.push(group);
    for (let j = 0; j < 7; j++) {
      const l = mesh(broadLeaf, leafMat, group, [0, 0.04, 0]);
      l.rotation.set(-0.25 - random() * 0.65, j * 2.4, (random() - 0.5) * 0.2);
      l.scale.setScalar(0.6 + random() * 0.7);
    }
  }
  // Neutral vein detail keeps the pale lettuce colors from multiplying into dark green.
  const lettuceCanvas=document.createElement('canvas');lettuceCanvas.width=lettuceCanvas.height=512;
  const lettuceCtx=lettuceCanvas.getContext('2d')!;
  lettuceCtx.filter='grayscale(1) brightness(1.8)';
  lettuceCtx.drawImage(leafMat.map!.image as HTMLCanvasElement,0,0,512,512);
  lettuceCtx.filter='none';lettuceCtx.fillStyle='rgba(255,255,255,.35)';lettuceCtx.fillRect(0,0,512,512);
  const lettuceTexture=new T.CanvasTexture(lettuceCanvas);lettuceTexture.colorSpace=T.SRGBColorSpace;
  const lettuceMat=leafMat.clone();lettuceMat.map=lettuceTexture;lettuceMat.color.set('#ffffff');lettuceMat.roughness=.9;lettuceMat.vertexColors=true;
  const lettuceInner=lettuceMat.clone();
  const lettuceLeaf=(inner:boolean)=>{
    const geometry=leafGeometry(inner?.19:.3,inner?.34:.58);
    const uv=geometry.getAttribute('uv'),colors:number[]=[];
    const heart=new T.Color(inner?'#e5f4a4':'#bddb78'),pink=new T.Color(inner?'#f1c6b6':'#df8caa');
    for(let i=0;i<uv.count;i++){
      const edge=T.MathUtils.smoothstep(Math.abs(uv.getX(i)*2-1),.35,.95);
      const tip=T.MathUtils.smoothstep(uv.getY(i),.65,1);
      const color=heart.clone().lerp(pink,Math.max(edge,tip)*(inner?.35:.95));colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));return geometry;
  };
  const lettuce=LETTUCE.map(p=>{
    const group=new T.Group();group.position.set(p.x,height(p.x,p.z),p.z);scene.add(group);
    for(let i=0;i<18;i++){
      const a=i*2.39996,inner=i>=10,r=inner?.06:.18;
      const leaf=mesh(lettuceLeaf(inner),inner?lettuceInner:lettuceMat,group,[Math.sin(a)*r,.035,Math.cos(a)*r]);
      leaf.rotation.set(inner?-.18:-.65,a,Math.sin(i)*.12);
    }
    return group;
  });
  // Lilies: tapered petals with a spotted throat and strongly readable ivory blooms.
  const petalGeo = leafGeometry(0.24, 0.78);
  const petalTex = texture("leaf");
  petalTex.colorSpace = T.SRGBColorSpace;
  const petals = new T.MeshStandardMaterial({
    color: "#f4e4bd",
    roughness: 0.72,
    side: T.DoubleSide,
  });
  const flowers = FLOWERS.map((f, index) => {
    const group = new T.Group();
    group.position.set(f.x, height(f.x, f.z), f.z);
    scene.add(group);
    const stalk = mesh(
      new T.CylinderGeometry(0.018, 0.032, 1.75, 7),
      green,
      group,
      [0, 0.875, 0],
    );
    stalk.rotation.z = 0.04;
    for (let j = 0; j < 5; j++) {
      const l = mesh(leafGeometry(0.1, 0.67), leafMat, group, [
        0,
        0.22 + j * 0.23,
        0,
      ]);
      l.rotation.set(-0.5, j * 2.4, 0.3);
    }
    const bloom = new T.Group();
    bloom.position.set(-0.07, 1.72, 0);
    bloom.rotation.z = 0.15;
    group.add(bloom);
    for (let j = 0; j < 6; j++) {
      const petal = mesh(petalGeo, petals, bloom, [0, 0, 0]);
      petal.rotation.set(-1.1, (j * Math.PI) / 3, 0);
    }
    const pollen = material("#9a4b18");
    for (let j = 0; j < 6; j++) {
      const a = j * 1.047;
      const st = mesh(
        new T.CylinderGeometry(0.009, 0.01, 0.32, 5),
        green,
        bloom,
        [Math.sin(a) * 0.07, 0.12, Math.cos(a) * 0.07],
      );
      st.rotation.z = Math.sin(a) * 0.4;
      mesh(
        sphere,
        pollen,
        bloom,
        [Math.sin(a) * 0.13, 0.29, Math.cos(a) * 0.13],
        [0.026, 0.04, 0.022],
      );
    }
    group.userData.index = index;
    return group;
  });
  const stumps = FLOWERS.map(f => {
    const stump = mesh(new T.CylinderGeometry(.023, .033, .18, 7), green, scene,
      [f.x, height(f.x, f.z) + .09, f.z]);
    stump.visible = false;
    return stump;
  });
  // Pots, rocks, rotting timber and small mushrooms give the ground scale.
  for (const [x, z, r] of [
    [-9, 7.5, 0.8],
    [8.8, 3, 0.65],
    [-8.9, -3, 0.65],
    [9, -8, 0.75],
  ]) {
    const pot = new T.Group();
    pot.position.set(x, 0, z);
    scene.add(pot);
    mesh(
      new T.CylinderGeometry(r, r * 0.7, 1.15, 28, 1, true),
      terracotta,
      pot,
      [0, 0.57, 0],
    );
    const rim = mesh(
      new T.TorusGeometry(r, 0.065, 8, 32),
      terracotta,
      pot,
      [0, 1.12, 0],
    );
    rim.rotation.x = Math.PI / 2;
    mesh(
      new T.CylinderGeometry(r * 0.94, r * 0.94, 0.06, 24),
      dark,
      pot,
      [0, 0.96, 0],
    );
    obstacles.push({ x, z, radius: r });
  }
  scatterStones(scene,stones,height,random,obstacles);
  for (let i = 0; i < 24; i++) {
    const x = -7 + random() * 2,
      z = 7.3 + random() * 2;
    mesh(
      new T.CylinderGeometry(0.025, 0.04, 0.25, 8),
      material("#baa587"),
      scene,
      [x, 0.125, z],
    );
    mesh(
      new T.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      material("#b48149"),
      scene,
      [x, 0.23, z],
      [1, 0.65, 1],
    );
  }
  const log = mesh(
    new T.CylinderGeometry(0.37, 0.48, 3.3, 16),
    wood,
    scene,
    [-4, 0.32, 8.9],
  );
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.15;
  obstacles.push({ x: -4, z: 8.9, radius: 0.6 });
  // Salt is a granular white crescent, clearly separate from the drinkable puddles.
  const grains = new T.InstancedMesh(
    new T.IcosahedronGeometry(0.024, 0),
    material("#f0ece0"),
    540,
  );
  scene.add(grains);
  let si = 0;
  for (const s of SALT)
    for (let i = 0; i < 180; i++) {
      const a = random() * Math.PI * 2,
        r = Math.sqrt(random()) * s.radius;
      dummy.position.set(s.x + Math.cos(a) * r, 0.05, s.z + Math.sin(a) * r);
      dummy.rotation.set(random(), random(), random());
      dummy.scale.setScalar(0.6 + random());
      dummy.updateMatrix();
      grains.setMatrixAt(si++, dummy.matrix);
    }
  // Home: a shelter under an overturned terracotta pot.
  const homeMaterial = terracotta.clone();
  homeMaterial.transparent = true;
  homeMaterial.side = T.DoubleSide;
  const home = mesh(
    new T.CylinderGeometry(0.75, 0.93, 1.15, 32, 1, true),
    homeMaterial,
    scene,
    [HOME.x, 0.55, HOME.z + 1],
  );
  home.rotation.x = Math.PI / 2;
  const ring = mesh(
    new T.TorusGeometry(0.93, 0.07, 8, 40),
    homeMaterial,
    scene,
    [0, 0.55, HOME.z + 0.425],
  );
  ring.rotation.y = 0;
  const homeLight = new T.PointLight("#a9d495", 1.2, 3);
  homeLight.position.set(0, 0.4, HOME.z + 0.5);
  scene.add(homeLight);
  // String lights across the distant fence.
  const cable = new T.CatmullRomCurve3([
    new T.Vector3(-11, 3.8, -10),
    new T.Vector3(0, 2.9, -10),
    new T.Vector3(11, 3.8, -10),
  ]);
  mesh(new T.TubeGeometry(cable, 40, 0.013, 4, false), dark, scene, [0, 0, 0]);
  const bulbMat = new T.MeshStandardMaterial({
    color: "#ffe6a7",
    emissive: "#ffc574",
    emissiveIntensity: 3,
  });
  for (let i = 0; i < 13; i++) {
    const p = cable.getPoint(i / 12);
    mesh(sphere, bulbMat, scene, [p.x, p.y - 0.09, p.z], [0.07, 0.1, 0.07]);
    if (i % 3 === 0) {
      const l = new T.PointLight("#ffc680", 3, 5, 2);
      l.position.copy(p);
      scene.add(l);
    }
  }
  // Batch static meshes by material. Keep animated plants and instanced fields separate.
  function batch(parent: T.Object3D, candidates: T.Object3D[]) {
    const groups = new Map<T.Material, T.Mesh[]>();
    for (const obj of candidates)
      if (
        obj instanceof T.Mesh &&
        !(obj instanceof T.InstancedMesh) &&
        !Array.isArray(obj.material)
      ) {
        const list = groups.get(obj.material) ?? [];
        list.push(obj);
        groups.set(obj.material, list);
      }
    for (const [mat, items] of groups) {
      if (items.length < 2) continue;
      const parts = items.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        return g.applyMatrix4(m.matrix);
      });
      const geo = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (!geo) continue;
      const combined = new T.Mesh(geo, mat);
      combined.castShadow = true;
      combined.receiveShadow = true;
      items.forEach((m) => parent.remove(m));
      parent.add(combined);
    }
  }
  for (const group of coverPlants) {
    batch(group, [...group.children]);
    group.updateMatrix();
    for (const child of [...group.children])
      if (child instanceof T.Mesh) {
        child.applyMatrix4(group.matrix);
        scene.add(child);
      }
    scene.remove(group);
  }
  coverPlants.length = 0;
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n transformed.x += sin(uTime*1.2+position.x*.7+position.z)*uv.y*.025;",
    );
  };
  for (const group of flowers) {
    for (const child of group.children)
      if (child instanceof T.Group) batch(child, [...child.children]);
    batch(group, [...group.children]);
  }
  batch(
    scene,
    scene.children.filter(
      (c) => !originalChildren.has(c) && c !== home && c !== ring && !stumps.some(stump => stump === c),
    ),
  );
  return {
    flowers,
    lettuce,
    stumps,
    obstacles,
    wind,
    slugPos,
    soilTex,
    stoneWet:stones.wetness,
    coverPlants,
    home,
    homeMaterial,
    homeRing: ring,
    grass,
  };
}

export function buildSlug(scene: T.Scene) {
  const slug = new T.Group();
  scene.add(slug);
  const skin = texture("skin");
  skin.repeat.set(2, 4);
  const mat = new T.MeshPhysicalMaterial({
    color: "#aa6438",
    map: skin,
    bumpMap: skin,
    bumpScale: 0.038,
    roughness: 0.43,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  });
  // Single continuous, tapered body: tail at +Z, head at -Z.
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const segments = 64,
    sides = 40;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      z = 0.85 - t * 1.55;
    const width = 0.012 + 0.255 * Math.pow(Math.sin(t * Math.PI * 0.91), 0.8);
    const h = 0.015 + 0.27 * Math.pow(Math.sin(t * Math.PI * 0.85), 1.1);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      vertices.push(
        Math.cos(a) * width,
        0.055 + (Math.sin(a) * 0.5 + 0.5) * h,
        z,
      );
      uvs.push(j / sides, t);
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const motion={time:{value:0},activity:{value:0},turn:{value:0}};
  const bodyMat=mat.clone();
  const deform=`
    float rear=smoothstep(-.45,.8,position.z);
    float wave=sin(position.z*15.-uTime*9.);
    transformed.x *= 1.+wave*.07*uActivity;
    transformed.y += sin(position.z*15.-uTime*9.+.6)*.011*uActivity*smoothstep(.05,.25,position.y);
    transformed.z += sin(position.z*15.-uTime*9.)*.018*uActivity;
    transformed.x += rear*rear*(uTurn*.14+sin(uTime*2.-position.z*5.)*.023*uActivity);
  `;
  const inject=(shader:T.WebGLProgramParametersWithUniforms)=>{
    shader.uniforms.uTime=motion.time;shader.uniforms.uActivity=motion.activity;shader.uniforms.uTurn=motion.turn;
    shader.vertexShader='uniform float uTime;uniform float uActivity;uniform float uTurn;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+deform);
  };
  bodyMat.onBeforeCompile=inject;
  const body = mesh(geo, bodyMat, slug, [0, 0, 0]);
  body.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});body.customDepthMaterial.onBeforeCompile=inject;
  const mantle = mesh(sphere, mat, slug, [0, 0.23, -0.34], [0.245, 0.16, 0.34]);
  const foot = mesh(
    sphere,
    new T.MeshPhysicalMaterial({
      color: "#ae7b4a",
      roughness: 0.48,
      clearcoat: 0.7,
    }),
    slug,
    [0, 0.067, 0],
    [0.27, 0.06, 0.73],
  );
  const eyes: T.Group[] = [];
  const feelers:T.Mesh[]=[];
  for (const side of [-1, 1]) {
    const rig = new T.Group();
    rig.position.set(side * 0.14, 0.29, -0.53);
    slug.add(rig);
    eyes.push(rig);
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(),
      new T.Vector3(side * 0.07, 0.18, -0.06),
      new T.Vector3(side * 0.1, 0.32, -0.13),
    ]);
    mesh(new T.TubeGeometry(curve, 12, 0.025, 8, false), mat, rig, [0, 0, 0]);
    mesh(
      sphere,
      material("#201b12", 0.25),
      rig,
      [side * 0.1, 0.32, -0.13],
      [0.034, 0.036, 0.034],
    );
    const feeler = mesh(new T.CapsuleGeometry(0.018, 0.16, 4, 8), mat, slug, [
      side * 0.2,
      0.16,
      -0.67,
    ]);
    feelers.push(feeler);
    feeler.rotation.x = -1.1;
    feeler.rotation.z = side * 0.6;
  }
  // Breathing pore on the right of the mantle.
  mesh(
    sphere,
    material("#492a1a"),
    slug,
    [0.24, 0.25, -0.36],
    [0.008, 0.028, 0.037],
  );
  const mouth=mesh(sphere,material('#52271e'),slug,[0,.115,-.712],[.07,.016,.022]);
  return { slug, body, mantle, foot, eyes, feelers, mouth, motion };
}
