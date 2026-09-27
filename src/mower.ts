import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOWER_ROUTE } from './game/lawn';

export class RobotMower {
  readonly root=new T.Group();
  private wheels:T.Mesh[]=[];
  private target=1;
  private heading=0;
  private turnPause=0;
  readonly previous=new T.Vector3();
  moving=false;
  constructor(scene:T.Scene,private ground:(x:number,z:number)=>number){
    const shell=new T.MeshStandardMaterial({color:'#bf5426',roughness:.43,metalness:.12});
    const dark=new T.MeshStandardMaterial({color:'#202728',roughness:.72});
    const rubber=new T.MeshStandardMaterial({color:'#111715',roughness:.95});
    const add=(geo:T.BufferGeometry,mat:T.Material,pos:number[],scale=[1,1,1])=>{
      const m=new T.Mesh(geo,mat);m.position.set(...pos as [number,number,number]);m.scale.set(...scale as [number,number,number]);m.castShadow=m.receiveShadow=true;this.root.add(m);return m;
    };
    add(new T.SphereGeometry(1,24,12),shell,[0,.36,0],[.57,.26,.73]);
    add(new T.BoxGeometry(1.06,.17,1.27),dark,[0,.22,0]);
    add(new T.BoxGeometry(.42,.035,.4),dark,[0,.595,-.06]);
    add(new T.BoxGeometry(.18,.045,.1),new T.MeshStandardMaterial({color:'#b9241a'}),[0,.62,-.1]);
    const glow=new T.MeshStandardMaterial({color:'#abebb8',emissive:'#4a9a65',emissiveIntensity:1.5});
    add(new T.BoxGeometry(.24,.035,.03),glow,[0,.46,.65]);
    for(const x of [-.56,.56]){
      const wheel=add(new T.CylinderGeometry(.23,.23,.14,16),rubber,[x,.23,-.25]);wheel.rotation.z=Math.PI/2;this.wheels.push(wheel);
      for(let i=0;i<12;i++){
        const tread=new T.Mesh(new T.BoxGeometry(.15,.035,.08),rubber);
        const a=i/12*Math.PI*2;tread.position.set(Math.cos(a)*.23,0,Math.sin(a)*.23);tread.rotation.y=-a;wheel.add(tread);
      }
    }
    add(new T.SphereGeometry(.1,10,8),rubber,[0,.1,.45]);
    for(let i=0;i<5;i++)add(new T.BoxGeometry(.34,.012,.025),dark,[0,.56,-.3-i*.045]);
    // Charging plate and guide cable mark the safe edge of the mowing area.
    const dock=new T.Group();dock.position.set(8.05,ground(8.05,-8.45),-8.45);scene.add(dock);
    const base=new T.Mesh(new T.BoxGeometry(.9,.045,1.05),dark);base.position.y=.025;dock.add(base);
    const post=new T.Mesh(new T.BoxGeometry(.9,.35,.14),dark);post.position.set(0,.17,-.5);dock.add(post);
    // Batch static casing details; only the two wheels need independent transforms.
    for(const wheel of this.wheels){
      const parts=[wheel.geometry];
      for(const child of wheel.children){if(child instanceof T.Mesh){child.updateMatrix();parts.push(child.geometry.clone().applyMatrix4(child.matrix));}}
      const combined=mergeGeometries(parts);if(combined){wheel.geometry=combined;wheel.clear();}
    }
    const groups=new Map<T.Material,T.Mesh[]>();
    for(const child of this.root.children){if(child instanceof T.Mesh&&!this.wheels.includes(child)&&!Array.isArray(child.material)){
      const list=groups.get(child.material)??[];list.push(child);groups.set(child.material,list);
    }}
    for(const [mat,items] of groups){if(items.length<2)continue;
      const parts=items.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
      const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
      if(geometry){const combined=new T.Mesh(geometry,mat);combined.castShadow=combined.receiveShadow=true;items.forEach(m=>this.root.remove(m));this.root.add(combined);}
    }
    scene.add(this.root);this.reset();
  }
  reset(){this.target=1;this.heading=0;this.turnPause=.35;this.moving=false;this.root.position.set(MOWER_ROUTE[0].x,this.ground(MOWER_ROUTE[0].x,MOWER_ROUTE[0].z),MOWER_ROUTE[0].z);this.root.rotation.set(0,0,0);this.previous.copy(this.root.position);}
  update(dt:number){
    this.previous.copy(this.root.position);this.moving=false;
    if(this.turnPause>0){this.turnPause-=dt;return;}
    const target=MOWER_ROUTE[this.target],dx=target.x-this.root.position.x,dz=target.z-this.root.position.z;
    const distance=Math.hypot(dx,dz),desired=Math.atan2(dx,dz);
    const turn=Math.atan2(Math.sin(desired-this.heading),Math.cos(desired-this.heading));
    this.heading+=T.MathUtils.clamp(turn,-dt*2.8,dt*2.8);this.root.rotation.y=this.heading;
    if(Math.abs(turn)>.07)return;
    if(distance<.035){this.target=(this.target+1)%MOWER_ROUTE.length;this.turnPause=.18;return;}
    const travel=Math.min(distance,dt*1.9);this.root.position.x+=dx/distance*travel;this.root.position.z+=dz/distance*travel;
    this.root.position.y=this.ground(this.root.position.x,this.root.position.z);this.moving=true;
    this.wheels.forEach(w=>w.rotation.x-=travel/.23);
  }
}
