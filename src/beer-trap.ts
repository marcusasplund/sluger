import * as T from 'three';
export function buildBeerTrap(scene:T.Scene,ground:(x:number,z:number)=>number){
  const root=new T.Group();root.position.set(0,ground(0,0),0);
  const ceramic=new T.MeshStandardMaterial({color:'#b9b2a0',roughness:.68,side:T.DoubleSide});
  const rim=new T.Mesh(new T.TorusGeometry(.48,.045,10,40),ceramic);rim.rotation.x=Math.PI/2;rim.position.y=.105;root.add(rim);
  const cup=new T.Mesh(new T.CylinderGeometry(.48,.43,.16,40,1,true),ceramic);cup.position.y=.025;cup.receiveShadow=true;root.add(cup);
  const dark=new T.Mesh(new T.CircleGeometry(.465,40),new T.MeshStandardMaterial({color:'#211409',roughness:.6}));dark.rotation.x=-Math.PI/2;dark.position.y=.075;root.add(dark);
  const beer=new T.Mesh(new T.CircleGeometry(.448,40),new T.MeshPhysicalMaterial({color:'#ae681e',roughness:.2,metalness:0,clearcoat:1,transparent:true,opacity:.87}));beer.rotation.x=-Math.PI/2;beer.position.y=.083;root.add(beer);
  const foamMat=new T.MeshStandardMaterial({color:'#dfc68f',roughness:.87});
  const foam=new T.InstancedMesh(new T.SphereGeometry(1,6,4),foamMat,60),dummy=new T.Object3D();
  for(let i=0;i<60;i++){const a=i*2.39996,r=.39+Math.sin(i*7.3)*.04;dummy.position.set(Math.cos(a)*r,.088,Math.sin(a)*r);dummy.scale.setScalar(.009+(i%5)*.003);dummy.scale.y*=.3;dummy.updateMatrix();foam.setMatrixAt(i,dummy.matrix);}root.add(foam);
  // A discarded cap hints at the bait without an intrusive world label.
  const cap=new T.Mesh(new T.CylinderGeometry(.085,.085,.025,16),new T.MeshStandardMaterial({color:'#b48a42',metalness:.65,roughness:.45}));cap.position.set(.7,.04,.18);cap.rotation.z=.25;root.add(cap);
  scene.add(root);return root;
}
