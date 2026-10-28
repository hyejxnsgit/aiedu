// 3D 주행 화면 (React Three Fiber).
// app.mjs·learning-ui.mjs가 쓰던 World 인터페이스(new World(canvas), render(d), resize(), view)를 그대로 유지한다.
// 장면 갱신은 React 상태가 아니라 useFrame 안에서 직접 바꾼다: 0.02초 주행 계산마다 React를 다시 렌더링하지 않기 위해서다.
import * as THREE from 'three';
import {createRoot,extend,useFrame,useThree} from '@react-three/fiber';
import {useEnvironment,useGLTF} from '@react-three/drei';
import {Suspense,useEffect,useMemo,useRef} from 'react';
import {EYES} from './cabin-model.mjs';

extend(THREE);

// 기존 화면의 색을 그대로 쓴다.
const SKY={dry:'#b9d9e9',wet:'#a7bac8'},ASPHALT={dry:'#455465',wet:'#34414e'},EGO='#ff8a2b',LEAD='#8f959c';

// 저사양 모드(?quality=low): 내장 그래픽이 버거울 때와 자동 검증에 쓴다.
const LOW=new URLSearchParams(location.search).get('quality')==='low';
const mat=(color,roughness=.85,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});

// 긴 도로·차선은 길이 방향으로 잘게 나눈다: 카메라 뒤까지 이어지는 아주 긴 삼각형은 실내 시점에서 깊이 오차로 가는 선이 비쳐 보인다.
function Box({size,position,material,rotation}){
 const seg=Math.max(1,Math.round(size[2]/8)),segX=Math.max(1,Math.round(size[0]/8));
 return <mesh position={position} rotation={rotation} material={material}><boxGeometry args={[...size,segX,1,seg]}/></mesh>;
}

// Meshy로 만든 모델(public/models, tools/optimize-models.mjs로 크기·방향 정리됨).
// 텍스처가 없는 파일이면 아래에서 준 재질을 입히고, 텍스처가 있으면 파일의 재질을 그대로 쓴다.
const model=n=>`models/${n}.glb`;
function useModelObject(name,material){
 const {scene}=useGLTF(model(name));
 return useMemo(()=>{const o=scene.clone(true);o.traverse(n=>{if(n.isMesh&&material&&!n.material.map)n.material=material;});return o;},[scene,material]);
}
// 같은 모델을 여러 번 깔 때(가드레일·바위)는 한 번의 그리기로 끝나도록 InstancedMesh로 만든다.
function useModelGeometry(name){
 const {scene}=useGLTF(model(name));
 return useMemo(()=>{scene.updateMatrixWorld(true);let g=null;
  // 압축(양자화)된 정점은 정수 배열이라 변환을 곱하기 전에 실수 배열로 풀어 준다.
  scene.traverse(n=>{if(!n.isMesh||g)return;g=new THREE.BufferGeometry();g.setIndex(n.geometry.index);
   for(const [k,a] of Object.entries(n.geometry.attributes)){const f=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)f[i*a.itemSize+j]=a.getComponent(i,j);g.setAttribute(k,new THREE.BufferAttribute(f,a.itemSize));}
   g.applyMatrix4(n.matrixWorld);});return g;},[scene]);
}
// 40m 구간마다 따로 묶어, 카메라 뒤나 시야 밖(먼 거리) 구간은 통째로 그리지 않게 한다.
function InstanceChunk({geometry,material,items}){
 const ref=useRef();
 useEffect(()=>{const o=new THREE.Object3D();items.forEach(([x,y,z,ry,sc],i)=>{o.position.set(x,y,z);o.rotation.set(0,ry,0);o.scale.setScalar(sc);o.updateMatrix();ref.current.setMatrixAt(i,o.matrix);});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();},[items]);
 return <instancedMesh ref={ref} args={[geometry,material,items.length]}/>;
}
function Instances({name,material,items}){
 const geometry=useModelGeometry(name);
 const chunks=useMemo(()=>{const m=new Map();for(const it of items){const k=Math.floor(it[2]/40);if(!m.has(k))m.set(k,[]);m.get(k).push(it);}return [...m.entries()];},[items]);
 return <>{chunks.map(([k,list])=><InstanceChunk key={k} geometry={geometry} material={material} items={list}/>)}</>;
}
function Placed({name,material,...props}){const o=useModelObject(name,material);return <primitive object={o} {...props}/>;}

// 가게 앞 세움 간판: Meshy는 글자를 뭉개므로 간판 글자는 캔버스로 그린다.
function signTexture(text,bg,fg){
 const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,512,192);x.strokeStyle=fg;x.lineWidth=10;x.strokeRect(10,10,492,172);
 x.fillStyle=fg;x.font='800 92px "RoundedFixedsys","Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,100);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function Sign({text,bg,fg,position}){
 const m=useMemo(()=>({board:new THREE.MeshStandardMaterial({map:signTexture(text,bg,fg),roughness:.6}),post:mat('#5d6166',.5,{metalness:.5})}),[text,bg,fg]);
 return <group position={position} rotation={[0,Math.PI/2,0]}>
  {[-.9,.9].map(x=><Box key={x} size={[.1,2.2,.1]} position={[x,1.1,0]} material={m.post}/>)}
  <mesh position={[0,2.35,.06]} material={m.board}><planeGeometry args={[2.6,.98]}/></mesh>
  <Box size={[2.7,1.06,.1]} position={[0,2.35,0]} material={m.post}/>
 </group>;
}

// 제주 해안도로(조함해안로 느낌): 우측 통행이라 내 차로(x≈0) 오른쪽에 볼라드·방파제·바다, 왼쪽에 맞은편 차로·가드레일·가게.
const BOLLARD_COLORS=['#e5483d','#f08a2b','#f2c22e','#3ba55c','#2f80d1','#7a4fc4'];
const ROAD_FROM=40,ROAD_TO=-650;
function Road({asphalt}){
 const m=useMemo(()=>({grass:mat('#7f9c63'),white:mat('#f4efdb'),yellow:mat('#f2c230'),blue:mat('#3d86d6'),concrete:mat('#b9b6ad'),wall:mat('#f3f2ee',.7),
  bark:mat('#6f5c48'),leaf:mat('#4f7a45'),sea:new THREE.MeshStandardMaterial({color:'#3f86ad',roughness:.18,metalness:.25}),sand:mat('#8d8a80'),
  rock:mat('#36383b',.95),rail:mat('#c6cbd0',.35,{metalness:.7}),bollard:new THREE.MeshStandardMaterial({roughness:.5}),
  burger:mat('#efe8dc',.75),pork:mat('#8f8b86',.85),pole:mat('#9a9c98',.45,{metalness:.6}),lamp:mat('#f6f1de',.3,{emissive:'#fff1c8',emissiveIntensity:.2})}),[]);
 const L=ROAD_FROM-ROAD_TO,C=(ROAD_FROM+ROAD_TO)/2;
 const bollards=useMemo(()=>{const a=[];for(let z=ROAD_FROM;z>ROAD_TO;z-=4)a.push(z);return a;},[]);
 const bollardRef=useRef();
 useEffect(()=>{const o=new THREE.Object3D(),c=new THREE.Color();bollards.forEach((z,i)=>{o.position.set(2.75,.4,z);o.updateMatrix();bollardRef.current.setMatrixAt(i,o.matrix);bollardRef.current.setColorAt(i,c.set(BOLLARD_COLORS[i%BOLLARD_COLORS.length]));});
  bollardRef.current.instanceMatrix.needsUpdate=true;bollardRef.current.instanceColor.needsUpdate=true;bollardRef.current.computeBoundingSphere();},[bollards]);
 // 바위·가드레일 배치는 매번 같게(학생마다 같은 화면) 고정 난수로 만든다.
 const rocks=useMemo(()=>{let r=7;const rnd=()=>(r=(r*16807)%2147483647)/2147483647;const a=[];for(let z=ROAD_FROM;z>ROAD_TO;z-=11)a.push([5.4+rnd()*4,-.4,z-rnd()*4,rnd()*6.28,.45+rnd()*.5]);return a;},[]);
 const rails=useMemo(()=>{const a=[];for(let z=ROAD_FROM;z>ROAD_TO;z-=4)a.push([-6.9,0,z-2,Math.PI/2,1]);return a;},[]);
 const trees=[],lamps=[];for(let z=30;z>ROAD_TO;z-=18){trees.push([-10.5-(Math.abs(z)%7),z]);if(z%36===30%36)lamps.push(z);}
 const shops=[['burger-shop',-68,'수제버거','#fff8ec','#d2491f'],['pork-bbq',-158,'제주 흑돼지','#2b2a29','#f6c445'],['burger-shop',-268,'수제버거','#fff8ec','#d2491f'],['pork-bbq',-372,'제주 흑돼지','#2b2a29','#f6c445'],['burger-shop',-480,'수제버거','#fff8ec','#d2491f'],['pork-bbq',-585,'제주 흑돼지','#2b2a29','#f6c445']];
 return <group>
  {/* 땅: 왼쪽 풀밭, 오른쪽은 방파제 너머 바다 */}
  <Box size={[202,.2,L+200]} position={[-106,-.2,C]} material={m.grass}/>
  <Box size={[8.6,.1,L]} position={[-1.9,-.04,C]} material={asphalt}/>
  <Box size={[2,.12,L]} position={[3.2,-.02,C]} material={m.concrete}/>
  <Box size={[.13,.025,L]} position={[-6,.025,C]} material={m.white}/>
  <Box size={[.15,.025,L]} position={[-2.05,.025,C]} material={m.yellow}/>
  <Box size={[.13,.025,L]} position={[2.1,.025,C]} material={m.white}/>
  <Box size={[.18,.03,L]} position={[3.6,.05,C]} material={m.blue}/>
  <Box size={[.55,1.05,L]} position={[4.45,.5,C]} material={m.wall}/>
  <Box size={[.57,.28,L]} position={[4.45,.32,C]} material={m.blue}/>
  <Box size={[6,.3,L]} position={[7.6,-.5,C]} material={m.sand}/>
  <mesh position={[155,-.55,C]} rotation={[-Math.PI/2,0,0]} material={m.sea}><planeGeometry args={[300,L+400,1,8]}/></mesh>
  <instancedMesh ref={bollardRef} args={[undefined,m.bollard,bollards.length]}><cylinderGeometry args={[.09,.1,.8,10]}/></instancedMesh>
  {trees.map(([x,z])=><group key={'t'+z} position={[x,0,z]}>
   <Box size={[.45,2.2,.45]} position={[0,1.1,0]} material={m.bark}/>
   <mesh position={[0,3.6,0]} material={m.leaf}><sphereGeometry args={[2,10,8]}/></mesh>
  </group>)}
  {lamps.map(z=><group key={'l'+z} position={[-7.6,0,z]}>
   <mesh position={[0,3.8,0]} material={m.pole}><cylinderGeometry args={[.07,.1,7.6,8]}/></mesh>
   <Box size={[1.6,.08,.08]} position={[.8,7.55,0]} material={m.pole}/>
   <Box size={[.6,.12,.28]} position={[1.55,7.45,0]} material={m.lamp}/>
  </group>)}
  <Suspense fallback={null}>
   {/* 저사양 모드(?quality=low)에서는 가드레일·바위를 빼서 그리기 부담을 줄인다 */}
   {!LOW&&<Instances name="guardrail" material={m.rail} items={rails}/>}
   {!LOW&&<Instances name="basalt-rocks" material={m.rock} items={rocks}/>}
   {shops.map(([name,z,text,bg,fg])=><group key={'s'+z}>
    <Placed name={name} material={name==='pork-bbq'?m.pork:m.burger} position={[-19,0,z]} rotation={[0,Math.PI/2,0]}/>
    <Sign text={text} bg={bg} fg={fg} position={[-8.4,0,z+8]}/>
   </group>)}
  </Suspense>
 </group>;
}

// 외부 차량(앞차, 차량 뒤 시점의 내 차). Meshy 모델을 불러오고, 불러오는 동안은 상자 모양을 보여준다.
// 브레이크등은 모델 위에 덧붙인 발광 면이라 앞차가 감속하면 그대로 켜진다.
function BoxCarBody({m,wheels}){
 return <>
  <Box size={[1.85,.65,4.4]} position={[0,.7,0]} material={m.body}/>
  <Box size={[1.65,.65,2.3]} position={[0,1.32,.15]} material={m.glass}/>
  <Box size={[1.7,.1,2.35]} position={[0,1.68,.15]} material={m.body}/>
  {[-.94,.94].flatMap(x=>[-1.4,1.4].map(z=><mesh key={x+','+z} ref={w=>{if(w&&!wheels.current.includes(w))wheels.current.push(w);}} position={[x,.42,z]} rotation={[0,0,Math.PI/2]} material={m.rubber}><cylinderGeometry args={[.38,.38,.22,12]}/></mesh>))}
 </>;
}
function Car({color,carRef,file}){
 const m=useMemo(()=>({body:new THREE.MeshStandardMaterial({color,roughness:.32,metalness:.35}),glass:mat('#294959',.2),rubber:mat('#202b31'),
  tail:new THREE.MeshStandardMaterial({color:'#742b27',emissive:'#ff1d10',emissiveIntensity:0,transparent:true,opacity:.85})}),[color]);
 const wheels=useRef([]);
 carRef.current??={};carRef.current.tail=m.tail;carRef.current.wheels=wheels.current;
 return <group ref={g=>{carRef.current.group=g;}}>
  <Suspense fallback={<BoxCarBody m={m} wheels={wheels}/>}><Placed name={file} material={m.body}/></Suspense>
  {[-.62,.62].map(x=><mesh key={x} position={[x,.92,2.31]} material={m.tail}><planeGeometry args={[.42,.12]}/></mesh>)}
 </group>;
}

// 중앙 화면. 앱에 내장한 프리텐다드로 캔버스 텍스처에 그린다(가로 16:10).
function useDisplayTexture(){
 return useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=480;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return {canvas,texture,key:''};},[]);
}
function drawDisplay(screen,d,cabin){
 const speed=d.ego.v*3.6,gap=d.lead.x-d.ego.x,lead=d.lead.v*3.6,req=d.trace.at(-1)?.requested_delta_kmh??0;
 const key=[cabin,speed.toFixed(0),gap.toFixed(1),lead.toFixed(0),Math.sign(req),d.road,d.ended].join('|');if(key===screen.key)return;screen.key=key;
 const c=screen.canvas.getContext('2d'),W=768,H=480,font='"RoundedFixedsys","Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
 const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#141b21');bg.addColorStop(1,'#0a0e12');c.fillStyle=bg;c.fillRect(0,0,W,H);
 const state=d.ended?'주행 종료':req<0?'제동 중':req>0?'가속 중':'속도 유지',tone=req<0?'#f08a70':req>0?'#64cbb6':'#9db0bd';
 c.fillStyle='#8fa3b1';c.font=`500 26px ${font}`;c.fillText(cabin==='wheel'?'내 차 속도':'자율주행 · 학습한 모델',44,64);
 const sp=speed.toFixed(0);c.fillStyle='#f3f6f8';c.font=`700 150px ${font}`;c.fillText(sp,36,210);const sw=c.measureText(sp).width;c.font=`500 32px ${font}`;c.fillStyle='#b8c6cf';c.fillText('km/h',52+sw,210);
 c.fillStyle='#24313a';c.fillRect(44,236,300,8);c.fillStyle=tone;c.fillRect(44,236,Math.min(300,speed/50*300),8);c.font=`600 28px ${font}`;c.fillText(state,44,286);
 const x0=430;c.fillStyle='#8fa3b1';c.font=`500 26px ${font}`;c.fillText('앞차까지',x0,64);c.fillStyle='#f3f6f8';c.font=`700 70px ${font}`;c.fillText(`${Math.max(0,gap).toFixed(1)} m`,x0,140);
 c.fillStyle='#b8c6cf';c.font=`500 24px ${font}`;c.fillText(`앞차 ${lead.toFixed(0)} km/h`,x0,186);c.fillText(d.road==='wet'?'젖은 노면':'마른 노면',x0,222);
 // 아래: 위에서 본 차로 도식(내 차 파랑 · 앞차 주황 · 차간거리 점선)
 const laneY=390,x1=W-50,xs=50,span=x1-xs,mx=Math.min(1,Math.max(0,gap)/60);c.fillStyle='#1b252d';c.fillRect(xs-10,laneY-40,span+20,80);
 c.strokeStyle='#3b4a55';c.lineWidth=3;c.setLineDash([18,14]);for(const y of [laneY-40,laneY+40]){c.beginPath();c.moveTo(xs-10,y);c.lineTo(x1+10,y);c.stroke();}c.setLineDash([]);
 c.fillStyle=EGO;c.fillRect(xs,laneY-18,70,36);c.fillStyle=LEAD;c.fillRect(xs+80+mx*(span-160),laneY-18,70,36);
 c.strokeStyle='#f1c765';c.lineWidth=3;c.setLineDash([8,6]);c.beginPath();c.moveTo(xs+74,laneY);c.lineTo(xs+78+mx*(span-160),laneY);c.stroke();c.setLineDash([]);
 screen.texture.needsUpdate=true;
}

// 내 차 실내: cabin-model.mjs로 만든 .glb 두 개(운전대 있음 / 없음)를 불러온다.
// 'Screen' 메시는 실시간 화면 텍스처로 바꾸고, 반사용 HDR 환경맵은 실내에만 적용한다(바깥 풍경 색은 그대로).
const CABIN_FILES={wheel:'models/cabin-wheel.glb',driverless:'models/cabin-driverless.glb'};
// 운전대 실내에는 Meshy 운전대·페달을 원래 자리(같은 이름의 노드)에 바꿔 끼운다. 운전대 기둥(Column)은 그대로 둔다.
function swapMeshyParts(o,parts){
 const sw=o.getObjectByName('SteeringWheel'),pedals=o.getObjectByName('Pedals');
 if(sw&&parts.wheel){for(const c of sw.children)if(c.name!=='Column')c.visible=false;const w=parts.wheel.clone(true);w.position.set(0,-.185,.02);sw.add(w);}
 if(pedals&&parts.brake){for(const c of pedals.children)c.visible=false;const b=parts.brake.clone(true),g=parts.gas.clone(true);b.position.set(-.075,-.13,0);g.position.set(.1,-.12,0);pedals.add(b,g);}
}
function WheelCabin(props){
 const leather=useMemo(()=>new THREE.MeshStandardMaterial({color:'#1f2124',roughness:.55}),[]),rubber=useMemo(()=>new THREE.MeshStandardMaterial({color:'#2b2d30',roughness:.8,metalness:.2}),[]);
 const wheel=useModelObject('steering-wheel',leather),brake=useModelObject('brake-pedal',rubber),gas=useModelObject('gas-pedal',rubber);
 const parts=useMemo(()=>({wheel,brake,gas}),[wheel,brake,gas]);
 return <GlbCabin {...props} parts={parts}/>;
}
function GlbCabin({url,screen,env,groupRef,parts}){
 const {scene}=useGLTF(url),{invalidate}=useThree();
 const object=useMemo(()=>{const o=scene.clone(true),screenMat=new THREE.MeshBasicMaterial({map:screen.texture,toneMapped:false});
  o.traverse(n=>{if(!n.isMesh)return;if(n.name==='Screen'){n.material=screenMat;return;}
   if(LOW){const m=n.material;n.material=Object.assign(new THREE.MeshLambertMaterial({color:m.color,map:m.map,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,transparent:m.transparent,opacity:m.opacity,side:m.side}),{name:m.name});return;}
   const m=n.material;if(m&&'envMap' in m){m.envMap=env;m.envMapIntensity=m.name==='Glass'?1:m.metalness>.5||m.name==='PianoBlack'?1.1:.55;m.needsUpdate=true;}});if(parts)swapMeshyParts(o,parts);return o;},[scene,screen,env,parts]);
 useEffect(()=>{invalidate();},[object,invalidate]);
 return <primitive ref={groupRef} object={object}/>;
}
// 저사양 모드(?quality=low): 반사용 HDR 환경맵을 끄고 실내 재질을 단순 조명(Lambert)으로 바꾼다. 내장 그래픽이 버거울 때와 자동 검증에 쓴다.
function CabinWithEnv(props){const env=useEnvironment({files:'hdri/potsdamer_platz_1k.hdr'});return <Cabin {...props} env={env}/>;}
function Cabin({worldRef,screen,env=null}){
 const hood=useMemo(()=>new THREE.MeshPhysicalMaterial({color:EGO,roughness:.3,metalness:.2,clearcoat:1,clearcoatRoughness:.08,envMap:env,envMapIntensity:.8}),[env]);
 const wheel=useRef(),driverless=useRef();worldRef.current.cabinParts={wheel,driverless};
 return <group>
  {/* 보닛: 앞 유리 너머로 보이는 내 차 차체 */}
  <mesh position={[0,.86,-1.68]} rotation={[.08,0,0]} material={hood}><boxGeometry args={[1.8,.12,1.3]}/></mesh>
  {/* 실내 보조광: 지면 반사광(초록) 때문에 천장·내장재가 탁해지지 않도록 위에서 따뜻한 빛을 더한다 */}
  <pointLight position={[0,1.62,.1]} intensity={1.1} distance={2.6} decay={2} color="#fff3e2"/>
  <WheelCabin url={CABIN_FILES.wheel} screen={screen} env={env} groupRef={wheel}/>
  <GlbCabin url={CABIN_FILES.driverless} screen={screen} env={env} groupRef={driverless}/>
 </group>;
}

function Scene({worldRef}){
 const {scene,camera,invalidate}=useThree();
 const asphalt=useMemo(()=>mat(ASPHALT.dry),[]);
 const ego=useRef(),lead=useRef(),cabin=useRef(),line=useRef(),screen=useDisplayTexture();
 const fog=useMemo(()=>new THREE.Fog(SKY.dry,90,230),[]);
 useMemo(()=>{scene.background=new THREE.Color(SKY.dry);scene.fog=fog;},[scene,fog]);
 worldRef.current.invalidate=invalidate;worldRef.current.scene=scene;
 const lineGeom=useMemo(()=>new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),[]);
 useFrame(()=>{
  const world=worldRef.current,d=world.d;if(!d)return;
  const wet=d.road==='wet';scene.background.set(SKY[d.road]??SKY.dry);fog.color.set(SKY[d.road]??SKY.dry);asphalt.color.set(wet?ASPHALT.wet:ASPHALT.dry);asphalt.roughness=wet?.35:.85;
  const e=ego.current,l=lead.current;if(!e?.group||!l?.group)return;
  e.group.position.z=-d.ego.x+2.2;l.group.position.z=-d.lead.x-2.2;
  e.tail.emissiveIntensity=(d.trace.at(-1)?.requested_delta_kmh??0)<0?2:0;l.tail.emissiveIntensity=d.leadAcceleration()<0?2:0;
  for(const c of [e,l])for(const w of c.wheels)w.rotation.x=c.group.position.z/.38;
  const inside=world.view==='driver',kind=world.cabin??(d.mode==='model'?'driverless':'wheel');
  e.group.visible=!inside;cabin.current.visible=inside;cabin.current.position.z=-d.ego.x+2.2;
  const parts=world.cabinParts;if(parts?.wheel.current)parts.wheel.current.visible=kind==='wheel';if(parts?.driverless.current)parts.driverless.current.visible=kind==='driverless';
  if(inside){drawDisplay(screen,d,kind);const eye=EYES[kind],base=-d.ego.x+2.2;camera.fov=eye.fov;camera.position.set(eye.position[0],eye.position[1],base+eye.position[2]);camera.lookAt(eye.target[0],eye.target[1],base+eye.target[2]);}
  else{camera.fov=57;camera.position.set(0,4.8,-d.ego.x+12);camera.lookAt(0,.5,-d.ego.x-22);}
  camera.updateProjectionMatrix();
  const p=lineGeom.attributes.position;p.setXYZ(0,1.45,.09,-d.ego.x);p.setXYZ(1,1.45,.09,-d.lead.x);p.needsUpdate=true;lineGeom.computeBoundingSphere();line.current.visible=!inside;
 });
 return <>
  <hemisphereLight args={[0xe5f4ff,0x68825b,2.5]}/>
  <directionalLight args={[0xfff5da,2.2]} position={[-30,50,20]}/>
  <Road asphalt={asphalt}/>
  <Car color={EGO} carRef={ego} file="ego-car"/>
  <Car color={LEAD} carRef={lead} file="lead-car"/>
  <group ref={cabin}><Suspense fallback={null}>{LOW?<Cabin worldRef={worldRef} screen={screen}/>:<CabinWithEnv worldRef={worldRef} screen={screen}/>}</Suspense></group>
  <line ref={line} geometry={lineGeom}><lineBasicMaterial color="#f1c765"/></line>
 </>;
}

export class World{
 constructor(canvas,{view='driver'}={}){
  this.canvas=canvas;this.view=view;this.d=null;this.ref={current:this};
  const probe=document.createElement('canvas');if(!(probe.getContext('webgl2')||probe.getContext('webgl')))throw Error('WebGL을 사용할 수 없습니다.');
  this.root=createRoot(canvas);
  this.root.configure({gl:{antialias:true,powerPreference:'low-power'},dpr:[1,1.5],flat:true,frameloop:'demand',camera:{fov:57,near:.05,far:240},size:this.size()});
  this.root.render(<Scene worldRef={this.ref}/>);
  new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
 }
 size(){const w=this.canvas.clientWidth||1,h=this.canvas.clientHeight||1;return {width:w,height:h,top:0,left:0};}
 resize(){this.root.configure({size:this.size()});this.invalidate?.();}
 render(d){this.d=d;this.invalidate?.();}
}
