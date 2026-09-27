import * as T from 'three';
import type { buildSlug } from './world';

export type DeathCause='chop'|'mower'|'beer'|'poison'|'salt'|'dry';
type Piece={object:T.Group;velocity:T.Vector3;spin:T.Vector3};
export class DeathEffects {
  readonly group=new T.Group();
  private pieces:Piece[]=[];
  private ownedMaterials:T.Material[]=[];
  private splats:T.InstancedMesh;
  private drops:T.InstancedMesh;
  private droplets:{p:T.Vector3;v:T.Vector3;size:number;active:boolean}[]=[];
  private dummy=new T.Object3D();
  private age=0;
  private cause:DeathCause='dry';
  private exploded=false;
  private impactDelay=.58;
  private origin=new T.Vector3();
  private beerTarget=new T.Vector3();
  private angle=0;
  private splatCount=0;
  active=false;
  onImpact?:()=>void;
  constructor(private scene:T.Scene,private creature:ReturnType<typeof buildSlug>,private ground:(x:number,z:number)=>number){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#a12923';ctx.beginPath();for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=28+Math.random()*16;ctx.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r);}ctx.closePath();ctx.fill();for(let i=0;i<28;i++){const a=Math.random()*7,r=35+Math.random()*27;ctx.beginPath();ctx.ellipse(64+Math.cos(a)*r,64+Math.sin(a)*r,1+Math.random()*3,1+Math.random()*3,0,0,7);ctx.fill();}
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const material=new T.MeshPhysicalMaterial({map:tex,color:'#a43a2c',emissive:'#280400',emissiveIntensity:.35,roughness:.42,clearcoat:.4,transparent:true,alphaTest:.08,depthWrite:false});
    const geo=new T.PlaneGeometry(1,1);geo.rotateX(-Math.PI/2);
    this.splats=new T.InstancedMesh(geo,material,90);this.splats.count=0;this.splats.renderOrder=3;this.splats.receiveShadow=true;scene.add(this.splats);
    this.drops=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshPhysicalMaterial({color:'#8a1815',roughness:.25,clearcoat:.8}),100);this.drops.count=0;scene.add(this.drops);scene.add(this.group);
  }
  reset(){this.ownedMaterials.forEach(m=>m.dispose());this.ownedMaterials=[];for(const p of this.pieces)p.object.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();}});this.group.clear();this.pieces=[];this.droplets=[];this.splats.count=0;this.drops.count=0;this.splatCount=0;this.age=0;this.active=false;this.exploded=false;this.creature.slug.visible=true;this.creature.slug.rotation.z=0;this.creature.slug.scale.setScalar(1);}
  start(cause:DeathCause,impactDelay=.58,target?:T.Vector3){if(target)this.beerTarget.copy(target);this.impactDelay=impactDelay;this.age=0;this.cause=cause;this.active=true;this.exploded=false;this.origin.copy(this.creature.slug.position);this.angle=this.creature.slug.rotation.y;if((cause==='chop'||cause==='mower')&&impactDelay===0)this.burst();}
  private splat(p:T.Vector3,size:number){if(this.splatCount>=90)return;this.dummy.position.set(p.x,this.ground(p.x,p.z)+.012,p.z);this.dummy.rotation.set(0,Math.random()*7,0);this.dummy.scale.set(size,1,size*(.6+Math.random()*.7));this.dummy.updateMatrix();this.splats.setMatrixAt(this.splatCount++,this.dummy.matrix);this.splats.count=this.splatCount;this.splats.instanceMatrix.needsUpdate=true;}
  private burst(){
    this.exploded=true;this.creature.slug.visible=false;this.onImpact?.();
    const skin=this.creature.mantle.material as T.Material;
    const flesh=new T.MeshPhysicalMaterial({color:'#71251d',roughness:.42,clearcoat:.55,side:T.DoubleSide});
    this.ownedMaterials.push(flesh);
    const cuts=[-.71,-.23,.16,.86];
    for(let n=0;n<cuts.length-1;n++){
      const low=cuts[n],high=cuts[n+1],centre=(low+high)/2;
      const p:number[]=[],uv:number[]=[],indices:number[]=[];
      const rings=Math.max(6,Math.ceil((high-low)*42)),sides=40;
      for(let ring=0;ring<=rings;ring++){
        const z=T.MathUtils.lerp(low,high,ring/rings),t=T.MathUtils.clamp((.85-z)/1.55,0,1);
        const width=.012+.255*Math.pow(Math.sin(t*Math.PI*.91),.8),h=.015+.27*Math.pow(Math.sin(t*Math.PI*.85),1.1);
        for(let side=0;side<=sides;side++){
          const a=side/sides*Math.PI*2;
          p.push(Math.cos(a)*width,.055+(Math.sin(a)*.5+.5)*h-.16,z-centre);
          uv.push(side/sides,t);
          if(ring<rings&&side<sides){const i=ring*(sides+1)+side,j=i+sides+1;indices.push(i,i+1,j,j,i+1,j+1);}
        }
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
      const group=new T.Group(),part=new T.Mesh(geo,skin);part.castShadow=true;group.add(part);
      for(const z of [low,high]){const t=T.MathUtils.clamp((.85-z)/1.55,.01,.99),width=.012+.255*Math.pow(Math.sin(t*Math.PI*.91),.8),h=.015+.27*Math.pow(Math.sin(t*Math.PI*.85),1.1);const cap=new T.Mesh(new T.CircleGeometry(1,24),flesh);cap.position.set(0,.055+h*.5-.16,z-centre);cap.scale.set(width,h*.5,1);group.add(cap);}
      if(n===0){
        for(const feature of [...this.creature.eyes,...this.creature.feelers,this.creature.mouth]){
          const copy=feature.clone(true);
          copy.traverse(o=>{if(o instanceof T.Mesh)o.geometry=o.geometry.clone();});
          copy.position.y-=.16;copy.position.z-=centre;group.add(copy);
        }
      }
      group.position.copy(this.origin).add(new T.Vector3(0,.16,centre).applyAxisAngle(new T.Vector3(0,1,0),this.angle));group.rotation.y=this.angle;this.group.add(group);
      this.pieces.push({object:group,velocity:new T.Vector3((n-1)*.65+(Math.random()-.5)*.25,.35+Math.random()*.6,(Math.random()-.5)*.6).applyAxisAngle(new T.Vector3(0,1,0),this.angle),spin:new T.Vector3(Math.random()*2-1,Math.random()*2-1,(n-1)*2.5)});
    }
    for(let i=0;i<100;i++){const a=Math.random()*7,speed=.5+Math.random()*2.4;this.droplets.push({p:this.origin.clone().add(new T.Vector3((Math.random()-.5)*.4,.18,(Math.random()-.5)*.8)),v:new T.Vector3(Math.cos(a)*speed,.35+Math.random()*1.6,Math.sin(a)*speed),size:.007+Math.random()*.014,active:true});}
    this.drops.count=100;this.splat(this.origin,1.3);
  }
  update(dt:number){
    if(!this.active)return false;this.age+=dt;
    if(this.cause==='chop'||this.cause==='mower'){
      if(!this.exploded){
        const brace=T.MathUtils.smoothstep(this.age/Math.max(.001,this.impactDelay),0,1);
        this.creature.eyes.forEach(e=>e.scale.setScalar(1-brace*.65));
        this.creature.slug.scale.y=1-brace*.2;
        if(this.age>=this.impactDelay)this.burst();
      }
      for(const piece of this.pieces){piece.velocity.y-=dt*7.5;piece.object.position.addScaledVector(piece.velocity,dt);piece.object.rotation.x+=piece.spin.x*dt;piece.object.rotation.y+=piece.spin.y*dt;piece.object.rotation.z+=piece.spin.z*dt;const ground=this.ground(piece.object.position.x,piece.object.position.z)+.13;if(piece.object.position.y<ground){piece.object.position.y=ground;piece.velocity.y=Math.abs(piece.velocity.y)*.18;piece.velocity.x*=Math.exp(-dt*12);piece.velocity.z*=Math.exp(-dt*12);piece.spin.multiplyScalar(Math.exp(-dt*12));piece.object.scale.y=T.MathUtils.lerp(piece.object.scale.y,.78,1-Math.exp(-dt*12));}}
      this.droplets.forEach((drop,i)=>{if(drop.active){drop.v.y-=dt*9;drop.p.addScaledVector(drop.v,dt);if(drop.p.y<=this.ground(drop.p.x,drop.p.z)+.015){drop.active=false;this.splat(drop.p,.10+drop.size*7);}}this.dummy.position.copy(drop.p);this.dummy.rotation.set(0,0,0);this.dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),drop.v.clone().normalize());const s=drop.active?drop.size:0;this.dummy.scale.set(s*.7,s*1.7,s*.7);this.dummy.updateMatrix();this.drops.setMatrixAt(i,this.dummy.matrix);});this.drops.instanceMatrix.needsUpdate=true;
    }else if(this.cause==='beer'){
      const target=this.beerTarget;
      const pull=T.MathUtils.smoothstep(this.age/1.3,0,1);
      this.creature.slug.position.lerpVectors(this.origin,target,pull);
      const drunk=T.MathUtils.smoothstep(this.age,.5,1.5)*(1-T.MathUtils.smoothstep(this.age,3.5,4.5));
      this.creature.slug.rotation.z=Math.sin(this.age*7)*.24*drunk;
      this.creature.slug.rotation.y=this.angle+Math.sin(this.age*3)*.6*drunk;
      this.creature.slug.position.x+=Math.sin(this.age*5)*.09*drunk;
      this.creature.slug.position.y+=.07*Math.sin(this.age*8)*drunk-T.MathUtils.smoothstep(this.age,2.1,4.3)*.65;
      this.creature.eyes.forEach((e,i)=>{e.rotation.z=Math.sin(this.age*6+i)*.4*drunk;e.scale.setScalar(1-T.MathUtils.smoothstep(this.age,2,4)*.85);});
      this.creature.slug.scale.setScalar(1-T.MathUtils.smoothstep(this.age,1.2,3.8)*.35);
      if(this.age>4.3)this.creature.slug.visible=false;
      return this.age>5;
    }else{
      const shrink=Math.min(1,this.age/1.4);this.creature.slug.scale.y=1-shrink*.67;this.creature.slug.rotation.z=Math.sin(this.age*32)*.05*Math.exp(-this.age*2);this.creature.eyes.forEach(e=>e.scale.setScalar(1-shrink*.7));
    }
    return this.age>this.impactDelay+2.5;
  }
  get shake(){return (this.cause==='chop'||this.cause==='mower')?Math.exp(-Math.max(0,this.age-this.impactDelay)*8)*Number(this.exploded)*.12:0;}
  get drunkenRoll(){return this.active&&this.cause==='beer'?Math.sin(this.age*2.7)*.045*T.MathUtils.smoothstep(this.age,.5,1.4)*(1-T.MathUtils.smoothstep(this.age,3.8,4.8)):0;}
  get caption(){return this.cause==='poison'?"The poison takes hold. Your body goes still.":this.cause==='beer'?(this.age<1.3?"The sweet smell pulls you in…":this.age<2.5?"Dizzy. Losing your grip…":this.age<4.3?"Slipping under. You can't climb out.":"The beer goes still."):"";}
  get fragments(){return this.pieces.length;}
}
