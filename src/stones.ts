import { GARDEN_ROCKS } from './game/layout';
import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER, type Obstacle } from './game/rules';

function hash(x:number,y:number,z:number){const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);}
function noise(x:number,y:number,z:number){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);const lerp=T.MathUtils.lerp;return lerp(lerp(lerp(hash(ix,iy,iz),hash(ix+1,iy,iz),u),lerp(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),u),v),lerp(lerp(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),u),lerp(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),u),v),w);}

// Fracture planes establish the silhouette; weathering softens the edges.
// The scans supply the small-scale information, not thousands of extra triangles.
function rockGeometry(seed:number,detail:number,slab=false){
  const raw=new T.IcosahedronGeometry(1,detail);raw.deleteAttribute('normal');raw.deleteAttribute('uv');
  const g=mergeVertices(raw,.0001);raw.dispose();const p=g.getAttribute('position');
  const planes=Array.from({length:8},(_,i)=>{const a=hash(i,seed,1)*Math.PI*2,ny=(hash(i,seed,3)-.5)*.9;return new T.Vector4(Math.cos(a),ny,Math.sin(a),.64+hash(i,seed,4)*.25);});
  const colors:number[]=[],uv:number[]=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);let r=1;
    for(const plane of planes){const dot=x*plane.x+y*plane.y+z*plane.z;if(dot>.01){const cut=plane.w/dot,k=.10,h=Math.max(k-Math.abs(r-cut),0)/k;r=Math.min(r,cut)-h*h*k*.25;}}
    const broad=noise(x*2.8+seed,y*2.8,z*2.8)-.5;
    const fine=noise(x*9+seed,y*9,z*9)-.5;
    r+=broad*.13+fine*.022;
    let px=x*r,py=y*r,pz=z*r;
    if(slab){px*=.90;pz*=.66;py=Math.sign(py)*Math.pow(Math.abs(py),.16)*.079+(noise(px*7+seed,0,pz*7)-.5)*.014;}
    else {py*=.72+.18*hash(seed,7,1);pz*=.77+.3*hash(seed,8,2);py=Math.max(py,-.59);}
    p.setXYZ(i,px,py,pz);
    const cavity=.78+.22*T.MathUtils.smoothstep(y,-.65,.35);colors.push(cavity,cavity,cavity);uv.push(px,pz);
  }
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function stoneKit(){
  const loader=new T.TextureLoader();
  const load=(suffix:string,color=false)=>{const t=loader.load(`/textures/rock_boulder_dry_${suffix}_2k.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;return t;};
  const diffuse=load('diff',true),normal=load('nor_gl'),arm=load('arm');
  const wetness={value:0};
  const material=new T.MeshStandardMaterial({map:diffuse,normalMap:normal,roughnessMap:arm,aoMap:arm,roughness:1,metalness:0,color:'#c3c6c3',vertexColors:true});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStoneWet=wetness;
    shader.vertexShader='varying vec3 vStonePosition; varying vec3 vStoneNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
      vStoneNormal=normalize(inverseTransformDirection(transformedNormal,viewMatrix));`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 stonePosition=vec4(position,1.);
      #ifdef USE_INSTANCING
        stonePosition=instanceMatrix*stonePosition;
      #endif
      vStonePosition=(modelMatrix*stonePosition).xyz;`);
    shader.fragmentShader=`varying vec3 vStonePosition; varying vec3 vStoneNormal; uniform float uStoneWet;
      float stoneWaterDamp(vec2 center,float innerRadius,float outerRadius){
        float shore=1.-smoothstep(innerRadius,outerRadius,distance(vStonePosition.xz,center));
        float low=1.-smoothstep(.035,.3,vStonePosition.y);
        return shore*low;
      }
      vec3 stoneWeights(){vec3 w=pow(abs(normalize(vStoneNormal)),vec3(4.));return w/max(dot(w,vec3(1.)),.0001);}
      vec4 stoneSample(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.zy)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 stoneP=vStonePosition*1.65;
      vec3 stoneW=stoneWeights();
      float wet=uStoneWet*.4;
      ${WATER.map(w=>`wet=max(wet,stoneWaterDamp(vec2(${w.x.toFixed(3)},${w.z.toFixed(3)}),${(w.radius*.75).toFixed(3)},${(w.radius*1.5).toFixed(3)}));`).join('\n')}
      vec3 stoneColor=stoneSample(map,stoneP,stoneW).rgb;
      stoneColor*=mix(vec3(1.),vec3(.48,.53,.56),wet);
      float contact=mix(.67,1.,smoothstep(-.025,.13,vStonePosition.y));
      diffuseColor.rgb*=stoneColor*contact;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      vec3 stoneArm=stoneSample(roughnessMap,stoneP,stoneW).rgb;
      float roughnessFactor=mix(clamp(stoneArm.g,.62,.98),.26,wet*.8);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 nx=texture2D(normalMap,stoneP.zy).xyz*2.-1.;
      vec3 ny=texture2D(normalMap,stoneP.xz).xyz*2.-1.;
      vec3 nz=texture2D(normalMap,stoneP.xy).xyz*2.-1.;
      vec3 perturb=vec3(0.,nx.y,nx.x)*stoneW.x+vec3(ny.x,0.,ny.y)*stoneW.y+vec3(nz.x,nz.y,0.)*stoneW.z;
      vec3 worldNormal=normalize(vStoneNormal+perturb*.65);
      normal=normalize((viewMatrix*vec4(worldNormal,0.)).xyz);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=mix(1.,stoneArm.r,.7);');
  };
  material.customProgramCacheKey=()=> 'sluger-scanned-stone-v1';
  return {material,wetness,geometry:rockGeometry};
}

export function scatterStones(scene:T.Scene,kit:ReturnType<typeof stoneKit>,ground:(x:number,z:number)=>number,random:()=>number,obstacles:Obstacle[]){
  const dummy=new T.Object3D();
  // Six different silhouettes share one set of maps. No distant LOD switches.
  for(let variant=0;variant<6;variant++){
    const batch=new T.InstancedMesh(kit.geometry(17+variant*13,variant<3?2:1),kit.material,180);batch.receiveShadow=true;scene.add(batch);
    for(let i=0;i<180;i++){
      const x=random()*23-11.5,z=random()*23-11.5,size=.014+Math.pow(random(),2)*.075;
      dummy.position.set(x,ground(x,z)+size*.16,z);dummy.rotation.set((random()-.5)*.7,random()*Math.PI*2,(random()-.5)*.6);dummy.scale.set(size*(.8+random()*.6),size,size);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);
      const tone=.7+random()*.5;batch.setColorAt(i,new T.Color(tone*(.92+random()*.12),tone,tone*(.94+random()*.10)));
    }
  }
  const shapes=Array.from({length:6},(_,i)=>kit.geometry(71+i*17,10));
  const positions:number[][]=[];
  for(let i=0;i<24;i++)positions.push([(i%2?-1:1)*(8.8+random()*1.8),random()*20-10,.27+random()*.24]);
  positions.push(...GARDEN_ROCKS);
  positions.forEach(([x,z,size],i)=>{
    const rock=new T.Mesh(shapes[i%shapes.length],kit.material);rock.position.set(x,ground(x,z)+size*.34,z);rock.scale.setScalar(size);rock.rotation.y=random()*Math.PI*2;rock.castShadow=rock.receiveShadow=true;scene.add(rock);obstacles.push({x,z,radius:size*.76});
  });
}
