import * as T from 'three';
import { buildSlug, supportedHeight } from './world';
import { animateSlug } from './life';
import { HOME, type Point } from './game/rules';
import { PARTNER, PARTNER_TRAIL, CLUTCH_SIZE, MEETING_SECONDS } from './game/partner';

// A second slug reuses the existing art/animation vocabulary. Trail and eggs are
// a static ribbon and instanced eggs; nothing is rebuilt in the frame loop.
export class PartnerScene {
  readonly creature;
  readonly trail: T.Mesh;
  readonly eggs: T.InstancedMesh;
  private eggMaterial = new T.MeshPhysicalMaterial({ color:'#ede7bf', roughness:.3, clearcoat:.7 });
  private response = 0;
  constructor(scene:T.Scene) {
    this.creature=buildSlug(scene);
    this.creature.slug.position.set(PARTNER.x,supportedHeight(PARTNER.x,PARTNER.z),PARTNER.z);
    this.creature.slug.rotation.y=Math.PI;
    this.creature.slug.scale.setScalar(.88);
    (this.creature.body.material as T.MeshPhysicalMaterial).color.set('#b49d67');
    (this.creature.mantle.material as T.MeshPhysicalMaterial).color.set('#b49d67');
    const samples: {x:number;z:number;angle:number}[]=[];
    for(let i=1;i<PARTNER_TRAIL.length;i++){
      const a=PARTNER_TRAIL[i-1],b=PARTNER_TRAIL[i],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/.19);
      for(let j=0;j<steps;j++){const u=j/steps;samples.push({x:T.MathUtils.lerp(a.x,b.x,u),z:T.MathUtils.lerp(a.z,b.z,u),angle:Math.atan2(b.x-a.x,b.z-a.z)});}
    }
    samples.push({...PARTNER,angle:samples[samples.length-1].angle});
    const positions:number[]=[],indices:number[]=[];
    samples.forEach((p,i)=>{
      const width=.035+Math.sin(i*1.7)*.006;
      for(const side of [-1,1]){
        const x=p.x+Math.cos(p.angle)*width*side,z=p.z-Math.sin(p.angle)*width*side;
        positions.push(x,supportedHeight(x,z)+.02,z);
      }
      if(i>0){const j=i*2;indices.push(j-2,j-1,j,j-1,j+1,j);}
    });
    const ribbon=new T.BufferGeometry();ribbon.setAttribute('position',new T.Float32BufferAttribute(positions,3));ribbon.setIndex(indices);ribbon.computeVertexNormals();
    const mat=new T.MeshPhysicalMaterial({color:'#dce6d2',emissive:'#819378',emissiveIntensity:.1,transparent:true,opacity:.48,roughness:.13,clearcoat:1,depthWrite:false,side:T.DoubleSide});
    this.trail=new T.Mesh(ribbon,mat);scene.add(this.trail);
    const dummy=new T.Object3D();
    this.eggs=new T.InstancedMesh(new T.SphereGeometry(1,12,8),this.eggMaterial,CLUTCH_SIZE*2);
    for(let i=0;i<CLUTCH_SIZE*2;i++){
      const angle=i*2.39996,r=.07*Math.sqrt(i),x=HOME.x+Math.cos(angle)*r,z=HOME.z+1.1+Math.sin(angle)*r;
      dummy.position.set(x,supportedHeight(x,z)+.07,z);dummy.rotation.set(0,i*.7,0);dummy.scale.set(.074+Math.sin(i)*.004,.063,.086+Math.cos(i)*.004);dummy.updateMatrix();this.eggs.setMatrixAt(i,dummy.matrix);
    }
    this.eggs.instanceMatrix.needsUpdate=true;this.eggs.castShadow=true;this.eggs.receiveShadow=true;scene.add(this.eggs);this.showNest(0);
  }
  showNest(clutches:number,appearing=0) { this.eggs.count=Math.min(CLUTCH_SIZE*2,clutches*CLUTCH_SIZE+appearing);this.eggs.visible=this.eggs.count>0; }
  reset() { this.response=0;this.creature.slug.rotation.set(0,Math.PI,0); }
  update(dt:number,time:number,player:Point,meeting:number,met:boolean,reduced:boolean) {
    const near=Math.hypot(player.x-PARTNER.x,player.z-PARTNER.z)<2.7;
    const target=near?Math.atan2(PARTNER.x-player.x,PARTNER.z-player.z):Math.PI;
    const root=this.creature.slug;
    root.rotation.y+=Math.atan2(Math.sin(target-root.rotation.y),Math.cos(target-root.rotation.y))*(1-Math.exp(-dt*3));
    const greeting=meeting>0&&!met;
    this.response=T.MathUtils.lerp(this.response,greeting?1:0,1-Math.exp(-dt*7));
    animateSlug(this.creature,time,dt,0,0,0,0,0);
    if(!reduced){
      root.rotation.z=Math.sin(meeting/MEETING_SECONDS*Math.PI*2)*this.response*.07;
      for(const eye of this.creature.eyes)eye.rotation.x-=this.response*(.25+Math.sin(time*4)*.12);
    } else root.rotation.z=0;
  }
}
