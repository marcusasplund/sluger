import { STRIKE_IMPACT, STRIKE_DURATION } from "./game/raid";
import * as T from 'three';
import type { buildSlug } from './world';

type Leg={thigh:T.Object3D;calf:T.Object3D;foot:T.Object3D;side:number;offset:T.Vector3;rest:T.Quaternion;planted:T.Vector3;previous:number;a:number;b:number;ankle:number};
const axisY=new T.Vector3(0,1,0);

// World-space two-bone IK: the stance foot stays planted while the hips move over it.
function pointBone(bone:T.Object3D,child:T.Object3D,target:T.Vector3){
  const origin=bone.getWorldPosition(new T.Vector3());
  const from=child.getWorldPosition(new T.Vector3()).sub(origin).normalize();
  const to=target.clone().sub(origin).normalize();
  const rotation=new T.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  const parent=bone.parent!.getWorldQuaternion(new T.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(rotation));bone.updateWorldMatrix(false,true);
}
function worldRotate(bone:T.Object3D,axis:T.Vector3,angle:number){
  const q=new T.Quaternion().setFromAxisAngle(axis,angle).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);
}
export class GardenerLife {
  private legs:Leg[]=[];
  private arms:{bone:T.Object3D;side:number;elbow?:T.Object3D;hand?:T.Object3D}[]=[];
  private head?:T.Object3D;
  private spine?:T.Object3D;
  private hand?:T.Object3D;
  private previous=new T.Vector3();
  private phase=0;
  private motion=0;
  private baseY:number;
  private attack=-1;
  private strikeTarget = new T.Vector3();
  strikes=0;
  steps=0;
  onStep?: (position:T.Vector3,strength:number)=>void;
  constructor(private model:T.Object3D,private root:T.Object3D,private ground:(x:number,z:number)=>number){
    this.baseY=model.position.y;root.updateWorldMatrix(true,true);this.previous.copy(root.position);
    const rootQ=root.getWorldQuaternion(new T.Quaternion());
    const bone=(name:string)=>model.getObjectByName(T.PropertyBinding.sanitizeNodeName(name));
    for(const side of [-1,1]){
      const name=side<0?'L':'R';
      const thigh=bone(`Bip01 ${name} Thigh`),calf=bone(`Bip01 ${name} Calf`),foot=bone(`Bip01 ${name} Foot`);
      if(thigh&&calf&&foot){const hip=thigh.getWorldPosition(new T.Vector3()),knee=calf.getWorldPosition(new T.Vector3()),ankle=foot.getWorldPosition(new T.Vector3());
        const offset=root.worldToLocal(ankle.clone());
        this.legs.push({thigh,calf,foot,side,offset,rest:rootQ.clone().invert().multiply(foot.getWorldQuaternion(new T.Quaternion())),planted:ankle.clone(),previous:-1,a:hip.distanceTo(knee),b:knee.distanceTo(ankle),ankle:T.MathUtils.clamp(offset.y,.1,.3)});
      }
      const arm=bone(`Bip01 ${name} UpperArm`);if(arm)this.arms.push({bone:arm,side,elbow:bone(`Bip01 ${name} Forearm`),hand:bone(`Bip01 ${name} Hand`)});
    }
    this.head=bone('Bip01 Head');this.spine=bone('Bip01 Spine');this.hand=bone('Bip01 R Hand');
  }
  get boundLegs(){return this.legs.length;}
  strike(target:T.Vector3){this.attack=0;this.strikeTarget.copy(target);this.strikes++;}
  reset(){this.motion=0;this.phase=0;this.attack=-1;this.previous.copy(this.root.position);this.legs.forEach(l=>l.previous=-1);}
  update(dt:number,time:number,alert:number,target:T.Vector3,shovel:T.Object3D){
    const travel=this.root.position.distanceTo(this.previous);this.previous.copy(this.root.position);
    const speed=travel/Math.max(dt,.001);this.motion=T.MathUtils.lerp(this.motion,Math.min(1,speed/.4),1-Math.exp(-dt*10));
    this.phase+=Math.min(travel,.12)*Math.PI*2/1.5;if(this.attack>=0){this.attack+=dt;if(this.attack>STRIKE_DURATION)this.attack=-1;}
    const t=this.attack;
    const ease=(x:number)=>T.MathUtils.smoothstep(x,0,1);
    const lift=t<0?0:t<.38?ease(t/.38):t<STRIKE_IMPACT?1-ease((t-.38)/(STRIKE_IMPACT-.38)):0;
    const strike=t<.38?0:t<STRIKE_IMPACT?ease((t-.38)/(STRIKE_IMPACT-.38)):1-ease((t-STRIKE_IMPACT)/(STRIKE_DURATION-STRIKE_IMPACT));
    this.model.position.y=this.baseY-strike*.12+Math.cos(this.phase*2)*.025*this.motion+Math.sin(time*1.5)*.005;
    this.model.rotation.z=Math.sin(this.phase)*.018*this.motion;
    this.model.updateWorldMatrix(true,true);
    const forward=new T.Vector3(0,0,1).applyQuaternion(this.root.quaternion),right=new T.Vector3(1,0,0).applyQuaternion(this.root.quaternion);
    for(const leg of this.legs){
      const cycle=((this.phase/(Math.PI*2)+(leg.side>0?.5:0))%1+1)%1;
      const base=this.root.position.clone().addScaledVector(right,leg.offset.x);
      const footTarget=new T.Vector3();
      if(leg.previous<0||travel>.3){leg.planted.copy(base).addScaledVector(forward,.15);leg.planted.y=this.ground(leg.planted.x,leg.planted.z)+leg.ankle;}
      if(cycle<.6){
        if(leg.previous>=.6){leg.planted.copy(base).addScaledVector(forward,.38);leg.planted.y=this.ground(leg.planted.x,leg.planted.z)+leg.ankle;this.steps++;this.onStep?.(leg.planted,alert>.7?1:.55);}
        footTarget.copy(leg.planted);
      }else{
        const u=(cycle-.6)/.4,ease=u*u*(3-2*u);
        const landing=base.addScaledVector(forward,.38);landing.y=this.ground(landing.x,landing.z)+leg.ankle;
        footTarget.lerpVectors(leg.planted,landing,ease);footTarget.y+=Math.sin(u*Math.PI)*.18*this.motion;
      }
      leg.previous=cycle;
      const hip=leg.thigh.getWorldPosition(new T.Vector3());
      const direction=footTarget.clone().sub(hip);const distance=T.MathUtils.clamp(direction.length(),Math.abs(leg.a-leg.b)+.01,leg.a+leg.b-.008);direction.normalize();
      const bend=forward.clone().addScaledVector(direction,-forward.dot(direction)).normalize();
      const cosine=T.MathUtils.clamp((leg.a*leg.a+distance*distance-leg.b*leg.b)/(2*leg.a*distance),-1,1);
      const knee=hip.clone().addScaledVector(direction,cosine*leg.a).addScaledVector(bend,Math.sqrt(1-cosine*cosine)*leg.a);
      const ankle=hip.clone().addScaledVector(direction,distance);
      pointBone(leg.thigh,leg.calf,knee);pointBone(leg.calf,leg.foot,ankle);
      const q=this.root.getWorldQuaternion(new T.Quaternion()).multiply(leg.rest);
      leg.foot.quaternion.copy(leg.foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));leg.foot.updateWorldMatrix(false,true);
    }
    for(const arm of this.arms){const swing=Math.sin(this.phase+(arm.side>0?Math.PI:0))*.23*this.motion;worldRotate(arm.bone,right,swing+(arm.side>0?lift*.8-strike*.5:-strike*.3));}
    if(this.spine)worldRotate(this.spine,right,alert*.06+strike*.24-lift*.08);
    if(this.head){const local=this.root.worldToLocal(target.clone());const look=alert>.1?T.MathUtils.clamp(Math.atan2(local.x,local.z),-.65,.65):Math.sin(time*.65)*.16;worldRotate(this.head,axisY,look);worldRotate(this.head,right,alert>.3?.16:Math.sin(time*.8)*.025);}
    if(this.hand){
      const restGrip=this.root.worldToLocal(this.hand.getWorldPosition(new T.Vector3()));
      const aim=this.root.worldToLocal(this.strikeTarget.clone());
      const contact=new T.Vector3(aim.x,aim.y+.1,aim.z);
      // Lift slowly, accelerate into the cut, then recover with the blade low.
      const strikeGrip=contact.clone().add(new T.Vector3(.12,1.22,-.45));
      const raised=restGrip.clone().add(new T.Vector3(.05,.65,-.35));
      const grip=restGrip.clone().lerp(raised,lift).lerp(strikeGrip,strike);
      const direction=grip.clone().sub(contact).normalize();
      const impactQ=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction);
      const restQ=new T.Quaternion().setFromEuler(new T.Euler(-lift*.95,0,-.14));
      shovel.quaternion.copy(restQ).slerp(impactQ,strike);
      // The cutting edge is 1.47 units below the grip in the shovel geometry.
      const exactGrip=contact.clone().add(new T.Vector3(0,1.47,0).applyQuaternion(impactQ));
      grip.lerp(exactGrip,strike);
      shovel.position.copy(grip);
      const arm=this.arms.find(a=>a.side>0);
      if(t>=0&&arm?.elbow&&arm.hand){
        const goal=this.root.localToWorld(grip.clone());
        const shoulder=arm.bone.getWorldPosition(new T.Vector3());
        const elbow=arm.elbow.getWorldPosition(new T.Vector3());
        const hand=arm.hand.getWorldPosition(new T.Vector3());
        const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(hand);
        const dir=goal.clone().sub(shoulder),d=T.MathUtils.clamp(dir.length(),Math.abs(a-b)+.001,a+b-.001);dir.normalize();
        const bend=right.clone().addScaledVector(dir,-right.dot(dir)).normalize();
        const cos=T.MathUtils.clamp((a*a+d*d-b*b)/(2*a*d),-1,1);
        const joint=shoulder.clone().addScaledVector(dir,a*cos).addScaledVector(bend,a*Math.sqrt(1-cos*cos));
        pointBone(arm.bone,arm.elbow,joint);pointBone(arm.elbow,arm.hand,goal);
      }
    }
  }
}

export function animateSlug(creature:ReturnType<typeof buildSlug>,time:number,dt:number,motion:number,turn:number,chew:number,stress:number,satisfied=0){
  const u=creature.motion;
  u.time.value=time;u.activity.value=T.MathUtils.lerp(u.activity.value,motion,1-Math.exp(-dt*7));u.turn.value=T.MathUtils.lerp(u.turn.value,turn,1-Math.exp(-dt*4));
  const breath=Math.sin(time*2.1)*.008 + Math.sin(Math.min(1,satisfied/.7)*Math.PI)*.08;
  creature.mantle.scale.y=.16*(1+breath+Math.sin(time*16)*chew*.05);
  creature.mantle.position.y=.23+breath*.3+Math.sin(time*13)*chew*.013;
  creature.eyes.forEach((eye,i)=>{const retract=1-stress*.32;eye.scale.setScalar(retract);eye.rotation.x=Math.sin(time*1.4+i*.8)*.12+chew*.25-satisfied*.35;eye.rotation.z=(i?1:-1)*(.05+Math.sin(time*1.9+i)*.10);eye.rotation.y=Math.sin(time*.7+i*1.7)*.18+u.turn.value*.35;});
  creature.feelers.forEach((f,i)=>{f.rotation.z=(i?1:-1)*(.6+Math.sin(time*3+i)*.15);f.rotation.x=-1.1+Math.sin(time*4+i)*.12+chew*.1;});
  creature.mouth.scale.y=.016*(1+chew*(.5+.5*Math.sin(time*24))*1.8);
}
