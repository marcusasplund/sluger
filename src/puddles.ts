import * as T from 'three';
import { WATER } from './game/rules';

const LEVEL = .018;
const vertexShader = `
  uniform mat4 reflectionMatrix;
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec4 vReflection;
  #include <fog_pars_vertex>
  void main(){
    vec4 world = modelMatrix * vec4(position,1.);
    vWorld = world.xyz; vLocal = uv;
    vReflection = reflectionMatrix * world;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const fragmentShader = `
  uniform sampler2D reflectionMap;
  uniform sampler2D bedMap;
  uniform vec3 eye, sunDirection, sunColor;
  uniform float time, rainy, reflectionReady;
  uniform vec4 ripples[10];
  varying vec3 vWorld;
  varying vec2 vLocal;
  varying vec4 vReflection;
  #include <common>
  #include <fog_pars_fragment>
  void main(){
    vec2 p = vWorld.xz;
    // Millimetre-scale capillary waves. Independent directions avoid a moving texture look.
    vec2 slope = vec2(
      sin(dot(p,vec2(14.,9.))+time*.8)*.003 + sin(dot(p,vec2(-27.,18.))-time*1.2)*.002,
      cos(dot(p,vec2(11.,-16.))-time*.7)*.003 + sin(dot(p,vec2(32.,13.))+time*1.5)*.002
    );
    for(int i=0;i<10;i++){
      vec2 delta=p-ripples[i].xy;
      float age=time-ripples[i].z;
      float d=length(delta);
      float radius=age*.65;
      float ring=d-radius;
      float envelope=exp(-ring*ring/ .008)*exp(-age*1.3)*step(0.,age)*step(age,3.);
      slope += delta/max(d,.001)*cos(ring*65.)*envelope*ripples[i].w;
    }
    vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
    vec3 viewDir=normalize(eye-vWorld);
    float ndv=max(dot(normal,viewDir),.001);
    float fresnel=.0204+.9796*pow(1.-ndv,5.);
    vec2 projected=vReflection.xy/vReflection.w;
    vec2 distortion=normal.xz*.032;
    vec3 reflection=texture2D(reflectionMap,clamp(projected+distortion,.002,.998)).rgb;
    reflection=mix(vec3(.36,.47,.52),reflection,reflectionReady);
    float edge=1.-smoothstep(.84,1.,vLocal.y);
    // The visible real ground and gravel transmit through the clear shallows.
    // A displaced soil sample supplies a subtle refracted sediment colour, without another scene pass.
    vec2 bottomUv=vec2(vWorld.x/80.+.5,.5-vWorld.z/80.)*24.+normal.xz*.06;
    vec3 sediment=texture2D(bedMap,bottomUv).rgb*vec3(.46,.51,.38);
    float depth=(1.-vLocal.y*vLocal.y)*.075;
    float absorption=(1.-exp(-depth*3.5/max(ndv,.25)))*.48;
    float alpha=clamp(fresnel+(1.-fresnel)*absorption,.025,.97)*edge;
    vec3 halfDir=normalize(viewDir+sunDirection);
    float sunGlint=pow(max(dot(normal,halfDir),0.),1700.)*2.2;
    vec3 light=(reflection*fresnel+sediment*absorption*(1.-fresnel))/max(fresnel+absorption*(1.-fresnel),.001);
    light+=sunColor*sunGlint;
    // Surface tension catches light at the contact line; never a white foam outline.
    light+=sunColor*pow(max(dot(reflect(-sunDirection,normal),viewDir),0.),90.)*smoothstep(.75,.95,vLocal.y)*.10;
    gl_FragColor=vec4(light,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function outline(a:number, seed:number) {
  return .89+.065*Math.sin(a*3+seed)+.035*Math.sin(a*7-seed*2)+.018*Math.sin(a*13+seed);
}
function puddleGeometry(radius:number, seed:number, rim=false, ground?:(x:number,z:number)=>number, cx=0,cz=0) {
  const pos:number[]=[],uv:number[]=[],indices:number[]=[];
  const rings=rim?6:14,segments=96;
  for(let row=0;row<=rings;row++)for(let col=0;col<=segments;col++){
    const a=col/segments*Math.PI*2, t=row/rings;
    const r=radius*outline(a,seed)*(rim?.95+t*.19:t);
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    pos.push(x,rim?ground!(x+cx,z+cz)+.008:LEVEL,z);uv.push(col/segments,t);
  }
  for(let row=0;row<rings;row++)for(let col=0;col<segments;col++){
    const i=row*(segments+1)+col,j=i+segments+1;indices.push(i,i+1,j,j,i+1,j+1);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export class Puddles {
  readonly group = new T.Group();
  readonly material:T.ShaderMaterial;
  readonly reflection = new T.WebGLRenderTarget(512,512,{type:T.HalfFloatType,depthBuffer:true,samples:2});
  private mirror = new T.PerspectiveCamera();
  private matrix = new T.Matrix4();
  private plane = new T.Plane(new T.Vector3(0,1,0),-LEVEL);
  private clip = new T.Vector4();
  private q = new T.Vector4();
  private view = new T.Vector3();
  private normal = new T.Vector3(0,1,0);
  private frustum = new T.Frustum();
  private vp = new T.Matrix4();
  private bounds=WATER.map(w=>new T.Sphere(new T.Vector3(w.x,LEVEL,w.z),w.radius));
  private ripples=Array.from({length:10},()=>new T.Vector4(0,0,-100,0));
  private index=0;
  private lastReflection=-10;
  private lastWake=-10;
  private lastRain=-10;
  private oldPosition=new T.Vector3();
  reflectionUpdates=0;
  enabled=true;
  reflectionsEnabled=true;

  constructor(private scene:T.Scene,soil:T.Texture,ground:(x:number,z:number)=>number,sun:T.Vector3){
    this.material=new T.ShaderMaterial({
      vertexShader,fragmentShader,transparent:true,depthWrite:false,fog:true,
      uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),reflectionMap:{value:this.reflection.texture},bedMap:{value:soil},reflectionMatrix:{value:this.matrix},eye:{value:new T.Vector3()},sunDirection:{value:sun},sunColor:{value:new T.Color('#fff0c9')},time:{value:0},rainy:{value:0},reflectionReady:{value:0},ripples:{value:this.ripples}}
    });
    const edgeCanvas=document.createElement('canvas');edgeCanvas.width=4;edgeCanvas.height=128;const ctx=edgeCanvas.getContext('2d')!;
    const fade=ctx.createLinearGradient(0,0,0,128);fade.addColorStop(0,'black');fade.addColorStop(.45,'#444');fade.addColorStop(1,'#aaa');ctx.fillStyle=fade;ctx.fillRect(0,0,4,128);
    const rimMaterial=new T.MeshPhysicalMaterial({color:'#363324',roughness:.3,clearcoat:.6,transparent:true,alphaMap:new T.CanvasTexture(edgeCanvas),opacity:.5,depthWrite:false});
    WATER.forEach((w,i)=>{
      const surface=new T.Mesh(puddleGeometry(w.radius,i*2.3),this.material);surface.position.set(w.x,0,w.z);surface.renderOrder=4;this.group.add(surface);
      const rim=new T.Mesh(puddleGeometry(w.radius,i*2.3,true,ground,w.x,w.z),rimMaterial);rim.position.set(w.x,0,w.z);rim.receiveShadow=true;scene.add(rim);
      // A small half-submerged leaf adds an immediate scale cue.
      const shape=new T.Shape();shape.moveTo(0,-.12);shape.bezierCurveTo(.11,-.02,.09,.08,0,.15);shape.bezierCurveTo(-.07,.08,-.08,-.03,0,-.12);
      const leaf=new T.Mesh(new T.ShapeGeometry(shape,12),new T.MeshStandardMaterial({color:i%2?'#6f582c':'#8a692d',roughness:.38,side:T.DoubleSide}));leaf.rotation.x=-Math.PI/2;leaf.rotation.z=i*2;leaf.position.set(w.x+.24,LEVEL+.002,w.z-.18);scene.add(leaf);
    });
    scene.add(this.group);
  }
  private ripple(x:number,z:number,time:number,strength:number){this.ripples[this.index].set(x,z,time,strength);this.index=(this.index+1)%this.ripples.length;}
  update(time:number,player:T.Vector3,rainy:boolean){
    this.material.uniforms.time.value=time;this.material.uniforms.rainy.value=Number(rainy);
    const moving=player.distanceToSquared(this.oldPosition)>.00001;
    if(moving&&time-this.lastWake>.18&&WATER.some(w=>Math.hypot(player.x-w.x,player.z-w.z)<w.radius*.95)){
      this.ripple(player.x,player.z,time,.042);this.lastWake=time;
    }
    if(rainy&&time-this.lastRain>.13){const w=WATER[this.index%WATER.length],angle=time*13.7,r=w.radius*.65*Math.abs(Math.sin(time*3.3));this.ripple(w.x+Math.cos(angle)*r,w.z+Math.sin(angle)*r,time,.018);this.lastRain=time;}
    this.oldPosition.copy(player);
  }
  renderReflection(renderer:T.WebGLRenderer,camera:T.PerspectiveCamera,time:number,quality:string){
    this.group.visible=this.enabled;if(!this.enabled)return;
    this.material.uniforms.eye.value.copy(camera.position);
    if(!this.reflectionsEnabled||time-this.lastReflection<1/(quality==='high'?30:18))return;
    camera.updateMatrixWorld();this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.vp);
    if(!this.bounds.some(b=>b.center.distanceTo(camera.position)<13&&this.frustum.intersectsSphere(b)))return;
    this.lastReflection=time;
    const size=quality==='high'?1024:quality==='low'?384:768;if(this.reflection.width!==size)this.reflection.setSize(size,size);
    this.mirror.position.copy(camera.position);this.mirror.position.y=2*LEVEL-camera.position.y;
    camera.getWorldDirection(this.view);this.view.reflect(this.normal).add(this.mirror.position);
    this.mirror.up.copy(camera.up).reflect(this.normal);this.mirror.lookAt(this.view);this.mirror.far=camera.far;this.mirror.updateMatrixWorld();this.mirror.projectionMatrix.copy(camera.projectionMatrix);
    // Crop the reflected frustum to the water's projected footprint. The texture's
    // pixels describe the puddles, rather than mostly unused sky and garden.
    let left=1,right=-1,bottom=1,top=-1;
    for(const b of this.bounds){if(!this.frustum.intersectsSphere(b)||b.center.distanceTo(camera.position)>13)continue;
      for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const p=new T.Vector3(b.center.x+Math.cos(a)*b.radius,LEVEL,b.center.z+Math.sin(a)*b.radius).project(this.mirror);left=Math.min(left,p.x);right=Math.max(right,p.x);bottom=Math.min(bottom,p.y);top=Math.max(top,p.y);}
    }
    left=Math.max(-1,left-.08);right=Math.min(1,right+.08);bottom=Math.max(-1,bottom-.08);top=Math.min(1,top+.08);
    if(right-left>.01&&top-bottom>.01){const crop=new T.Matrix4().set(2/(right-left),0,0,-(right+left)/(right-left),0,2/(top-bottom),0,-(top+bottom)/(top-bottom),0,0,1,0,0,0,0,1);this.mirror.projectionMatrix.premultiply(crop);}
    this.matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(this.mirror.projectionMatrix).multiply(this.mirror.matrixWorldInverse);
    // Oblique near-plane clipping removes soil and geometry below the waterline.
    const plane=this.plane.clone().applyMatrix4(this.mirror.matrixWorldInverse);this.clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const e=this.mirror.projectionMatrix.elements;this.q.set((Math.sign(this.clip.x)+e[8])/e[0],(Math.sign(this.clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);this.clip.multiplyScalar(2/this.clip.dot(this.q));e[2]=this.clip.x;e[6]=this.clip.y;e[10]=this.clip.z+1-.001;e[14]=this.clip.w;
    const target=renderer.getRenderTarget(),shadowUpdate=renderer.shadowMap.needsUpdate,xr=renderer.xr.enabled;
    this.group.visible=false;renderer.shadowMap.needsUpdate=false;renderer.xr.enabled=false;
    try{renderer.setRenderTarget(this.reflection);renderer.clear();renderer.render(this.scene,this.mirror);this.material.uniforms.reflectionReady.value=1;this.reflectionUpdates++;}
    finally{renderer.setRenderTarget(target);renderer.shadowMap.needsUpdate=shadowUpdate;renderer.xr.enabled=xr;this.group.visible=true;}
  }
}
