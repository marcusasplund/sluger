import * as T from 'three';
import {buildBeerTrap} from './beer-trap';
import {HAZARD_SITES,hazardLayout} from './game/hazards';
export class GardenHazards {
  beer:{x:number;z:number;radius:number}[]=[];
  poison:{x:number;z:number;radius:number}[]=[];
  private beerIds:number[]=[];
  private bowls:T.Group[]=[];
  private pellets:T.InstancedMesh;
  constructor(scene:T.Scene,private ground:(x:number,z:number)=>number){
    for(let i=0;i<3;i++)this.bowls.push(buildBeerTrap(scene,ground));
    this.pellets=new T.InstancedMesh(new T.CylinderGeometry(.016,.016,.065,5),new T.MeshStandardMaterial({color:'#247eb0',roughness:.9}),225);
    this.pellets.receiveShadow=true;this.pellets.frustumCulled=false;scene.add(this.pellets);this.reset();
  }
  reset(defended:"west"|"east"|null=null){
    const layout=hazardLayout(this.beerIds,Math.random,defended);this.beerIds=layout.beer;
    this.beer=layout.beer.map(i=>({...HAZARD_SITES[i],radius:1.2}));
    this.poison=layout.poison.map(i=>({...HAZARD_SITES[i],radius:.75}));
    this.bowls.forEach((b,i)=>{b.visible=i<this.beer.length;if(b.visible){const p=this.beer[i];b.position.set(p.x,this.ground(p.x,p.z),p.z);}});
    const dummy=new T.Object3D();let n=0;
    for(const area of this.poison)for(let i=0;i<75;i++){
      const a=i*2.39996,r=Math.sqrt((i+.5)/75)*area.radius,x=area.x+Math.cos(a)*r,z=area.z+Math.sin(a)*r;
      dummy.position.set(x,this.ground(x,z)+.025,z);dummy.rotation.set(Math.PI/2,i*1.7,.2*Math.sin(i));dummy.scale.setScalar(.8+(i%4)*.12);dummy.updateMatrix();this.pellets.setMatrixAt(n++,dummy.matrix);
    }
    this.pellets.count=n;this.pellets.instanceMatrix.needsUpdate=true;
  }
}
