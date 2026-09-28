import * as T from 'three';
import type { Hatchling } from './game/young';
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
  readonly young:T.InstancedMesh;
  private youngEyes:T.InstancedMesh;
  private youngFeelers:T.InstancedMesh;
  private dummy=new T.Object3D();
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
    const youngBody=new T.SphereGeometry(1,20,12),positionsYoung=youngBody.attributes.position;
    for(let i=0;i<positionsYoung.count;i++){const z=positionsYoung.getZ(i),taper=1-Math.max(0,z)*.6;positionsYoung.setXYZ(i,positionsYoung.getX(i)*taper,positionsYoung.getY(i)*taper,z);}
    youngBody.computeVertexNormals();
    const youngSkin=new T.MeshStandardMaterial({color:'#947655',roughness:.52});
    this.young=new T.InstancedMesh(youngBody,youngSkin,6);
    this.youngFeelers=new T.InstancedMesh(new T.CylinderGeometry(.004,.007,.055,6),youngSkin,12);
    this.youngEyes=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshStandardMaterial({color:'#302b23',roughness:.65}),12);
    this.young.count=this.youngEyes.count=this.youngFeelers.count=0;this.young.frustumCulled=this.youngEyes.frustumCulled=this.youngFeelers.frustumCulled=false;
    this.young.receiveShadow=true;scene.add(this.young,this.youngEyes,this.youngFeelers);
    const dummy=new T.Object3D();
    this.eggs=new T.InstancedMesh(new T.SphereGeometry(1,12,8),this.eggMaterial,CLUTCH_SIZE*2);
    for(let i=0;i<CLUTCH_SIZE*2;i++){
      const angle=i*2.39996,r=.07*Math.sqrt(i),x=HOME.x+Math.cos(angle)*r,z=HOME.z+1.1+Math.sin(angle)*r;
      dummy.position.set(x,supportedHeight(x,z)+.07,z);dummy.rotation.set(0,i*.7,0);dummy.scale.set(.074+Math.sin(i)*.004,.063,.086+Math.cos(i)*.004);dummy.updateMatrix();this.eggs.setMatrixAt(i,dummy.matrix);
    }
    this.eggs.instanceMatrix.needsUpdate=true;this.eggs.castShadow=true;this.eggs.receiveShadow=true;scene.add(this.eggs);this.showNest(0);
  }
  showNest(clutches:number,appearing=0) { this.eggs.count=Math.min(CLUTCH_SIZE*2,clutches*CLUTCH_SIZE+appearing);this.eggs.visible=this.eggs.count>0; }
  showYoung(clutches:number){this.young.count=Math.min(6,clutches*CLUTCH_SIZE);this.youngEyes.count=this.youngFeelers.count=this.young.count*2;}
  reset() { this.response=0;this.creature.slug.rotation.set(0,Math.PI,0); }
  update(dt:number,time:number,player:Point,meeting:number,met:boolean,reduced:boolean,children?:Hatchling[]) {
    if(children){this.young.count=children.length;this.youngEyes.count=this.youngFeelers.count=children.length*2;}
    if(this.young.count>0){
      for(let i=0;i<this.young.count;i++){
        const t=reduced?0:time*.3,angle=i*2.4+t*.12,r=.22+(i%3)*.13;
        const child=children?.[i];
        const x=child?.x??HOME.x+Math.cos(angle)*r,z=child?.z??HOME.z+.7+Math.sin(angle)*r,y=supportedHeight(x,z)+.045;
        const facing=child?.angle??-angle;
        this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,facing,0);this.dummy.scale.set(.055,.04,.14*(1+Math.sin(t*5+i)*.035));this.dummy.updateMatrix();this.young.setMatrixAt(i,this.dummy.matrix);this.young.setColorAt(i,new T.Color(child?.fear ? '#f5b27a' : '#ffffff'));
        for(let side=0;side<2;side++){
          const lx=(side?1:-1)*.025,lz=-.09,ex=x+lx*Math.cos(facing)+lz*Math.sin(facing),ez=z+-lx*Math.sin(facing)+lz*Math.cos(facing);
          this.dummy.position.set(ex,y+.07,ez);this.dummy.scale.setScalar(.008);this.dummy.updateMatrix();this.youngEyes.setMatrixAt(i*2+side,this.dummy.matrix);
          this.dummy.position.y=y+.0425;this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.youngFeelers.setMatrixAt(i*2+side,this.dummy.matrix);
        }
      }
      if(this.young.instanceColor)this.young.instanceColor.needsUpdate=true;
      this.young.instanceMatrix.needsUpdate=this.youngEyes.instanceMatrix.needsUpdate=this.youngFeelers.instanceMatrix.needsUpdate=true;
    }
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
