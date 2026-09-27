import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One draw call per lettuce. Cache rest positions once; only the active meal's
// small position buffer changes. No geometry/material creation during gameplay.
export class FeedingVisuals {
  private meals;
  private mouth = new T.Vector3();
  constructor(plants: T.Group[]) {
    this.meals = plants.map(plant => {
      const leaves=plant.children.filter((c):c is T.Mesh=>c instanceof T.Mesh);
      const parts=leaves.map(leaf=>{leaf.updateMatrix();return leaf.geometry.toNonIndexed().applyMatrix4(leaf.matrix);});
      const geometry=mergeGeometries(parts);
      const spans=parts.map((p,i)=>({start:parts.slice(0,i).reduce((n,g)=>n+g.attributes.position.count,0),count:p.attributes.position.count}));
      const mesh=new T.Mesh(geometry,leaves[0].material);mesh.castShadow=true;mesh.receiveShadow=true;
      const base=new Float32Array(geometry.attributes.position.array);
      for(const leaf of leaves){plant.remove(leaf);leaf.geometry.dispose();}
      parts.forEach(p=>p.dispose());plant.add(mesh);
      (geometry.attributes.position as T.BufferAttribute).setUsage(T.DynamicDrawUsage);
      return {plant,mesh,base,spans,remaining:18,lastProgress:-1,wasChewing:false};
    });
  }
  update(index:number,progress:number,mouth:T.Vector3,chewing:boolean,time:number,reduced:boolean) {
    const meal=this.meals[index];
    if(!chewing&&!meal.wasChewing&&progress===meal.lastProgress)return;
    meal.lastProgress=progress;meal.wasChewing=chewing;
    meal.plant.updateWorldMatrix(true,false);this.mouth.copy(mouth);meal.plant.worldToLocal(this.mouth);
    const bite=Math.floor(Math.min(1,progress)*12)/12;
    const pos=meal.mesh.geometry.attributes.position;
    const array=pos.array as Float32Array;
    meal.remaining=0;
    for(let i=0;i<meal.spans.length;i++){
      const {start,count}=meal.spans[i];
      const removed=T.MathUtils.clamp(bite*18-i,0,1);
      if(removed<1)meal.remaining++;
      // Plane triangles are ordered tip-first. Collapse consumed triangles,
      // leaving a stepped bite edge and an intact stem until the next mouthful.
      const cut=Math.floor(removed*count/6)*6;
      const bend=chewing&&i<progress*18+3?(reduced?.12:.23+Math.sin(time*24)*.07):0;
      for(let j=0;j<count;j++){
        const n=(start+j)*3;
        if(j<cut){array[n]=0;array[n+1]=0;array[n+2]=0;continue;}
        const weight=bend*Math.min(1,Math.max(0,meal.base[n+1])/.35);
        array[n]=T.MathUtils.lerp(meal.base[n],this.mouth.x,weight);
        array[n+1]=T.MathUtils.lerp(meal.base[n+1],this.mouth.y,weight);
        array[n+2]=T.MathUtils.lerp(meal.base[n+2],this.mouth.z,weight);
      }
    }
    pos.needsUpdate=true;
  }
  get remainingLeaves(){return this.meals.map(m=>m.remaining);}
  reset(){for(const meal of this.meals){const pos=meal.mesh.geometry.attributes.position; (pos.array as Float32Array).set(meal.base);pos.needsUpdate=true;meal.remaining=18;meal.lastProgress=-1;meal.wasChewing=false;}}
}
