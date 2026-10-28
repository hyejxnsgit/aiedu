// 차량 실내 3D 모델 원본. 이 파일로 만든 장면을 lab/export-cabin.html 에서 .glb로 내보내고,
// 시뮬레이터(world.jsx)는 public/models/*.glb 를 불러온다.
//  - buildWheelCabin(): 참고 사진 2 (검정 실내, 가로 우드 트림, 떠 있는 중앙 화면, 2스포크 원형 운전대) + 한국 기준 좌측 운전석
//  - buildDriverlessCabin(): 참고 사진 1 (크림색 라운지, 짙은 대시보드, 화면 양옆의 따뜻한 조명, 운전대 없음)
// 브랜드 로고·엠블럼은 만들지 않는다. 좌표: 내 차 중심 바닥이 원점, 앞쪽이 -z, 단위 m.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const DRIVER_X=-.37;
// 시점 (world.jsx가 사용): 운전석 눈높이 / 뒷좌석 가운데
export const EYES={wheel:{position:[DRIVER_X,1.2,.3],target:[DRIVER_X*.6,1.0,-40],fov:68},driverless:{position:[0,1.22,1.15],target:[0,-5.5,-40],fov:64}};

let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
function canvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
// 높이 잡음 → 법선 맵. 가죽 주름·직물 결을 이미지 파일 없이 만든다(glb에 PNG로 포함됨).
function normalFromHeight(h,strength){
 const s=h.width,src=h.getContext('2d').getImageData(0,0,s,s).data,out=canvas(s),ctx=out.getContext('2d'),img=ctx.createImageData(s,s);
 const H=(x,y)=>src[(((y+s)%s)*s+((x+s)%s))*4]/255;
 for(let y=0;y<s;y++)for(let x=0;x<s;x++){const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength,n=Math.hypot(dx,dy,1),i=(y*s+x)*4;
  img.data[i]=(-dx/n*.5+.5)*255;img.data[i+1]=(-dy/n*.5+.5)*255;img.data[i+2]=(1/n*.5+.5)*255;img.data[i+3]=255;}
 ctx.putImageData(img,0,0);return out;
}
function grainNormal({size=256,dots=3000,r=[.5,1.8],strength=3,repeat=6,blur=1}){
 seed=dots;const h=canvas(size),g=h.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,size,size);g.filter=`blur(${blur}px)`;
 for(let i=0;i<dots;i++){const v=90+rnd()*120|0;g.fillStyle=`rgb(${v},${v},${v})`;g.beginPath();g.arc(rnd()*size,rnd()*size,r[0]+rnd()*(r[1]-r[0]),0,7);g.fill();}
 const t=new THREE.CanvasTexture(normalFromHeight(h,strength));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);return t;
}
function woodTexture(){
 seed=42;const c=canvas(512),g=c.getContext('2d');const grd=g.createLinearGradient(0,0,0,512);grd.addColorStop(0,'#7a5a3f');grd.addColorStop(1,'#6c4e36');g.fillStyle=grd;g.fillRect(0,0,512,512);
 for(let i=0;i<220;i++){const y=rnd()*512,a=.05+rnd()*.12;g.strokeStyle=rnd()<.5?`rgba(40,22,10,${a})`:`rgba(170,130,90,${a})`;g.lineWidth=.5+rnd()*2.2;g.beginPath();g.moveTo(0,y);
  for(let x=0;x<=512;x+=32)g.lineTo(x,y+Math.sin(x/90+i)*3*rnd());g.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,1);return t;
}

function materials(theme){
 const leatherN=grainNormal({dots:3600,r:[.5,1.7],strength:4,repeat:7}),fabricN=grainNormal({dots:12000,r:[.3,.7],strength:2.5,repeat:12,blur:.4}),softN=grainNormal({dots:6000,r:[.4,1.1],strength:2,repeat:9});
 const P=(name,o)=>Object.assign(new THREE.MeshStandardMaterial(o),{name}),PP=(name,o)=>Object.assign(new THREE.MeshPhysicalMaterial(o),{name});
 const dark=theme==='dark';
 return {
  dashTop:P('DashSoftTop',{color:dark?'#1b1d20':'#3a2a28',roughness:.82,normalMap:softN,normalScale:new THREE.Vector2(.5,.5)}),
  dashLower:P('DashLower',{color:dark?'#202226':'#3f2d2b',roughness:.75,normalMap:softN,normalScale:new THREE.Vector2(.4,.4)}),
  leather:P('Leather',{color:dark?'#191b1e':'#d9cfc1',roughness:dark?.5:.58,normalMap:leatherN,normalScale:new THREE.Vector2(.7,.7)}),
  trim:P('SatinMetal',{color:'#a9afb5',roughness:.3,metalness:1}),
  piano:PP('PianoBlack',{color:'#08090b',roughness:.12,clearcoat:1,clearcoatRoughness:.04}),
  wood:PP('OpenPoreWood',{color:'#ffffff',map:woodTexture(),roughness:.55,clearcoat:.25,clearcoatRoughness:.4}),
  fabric:P('Headliner',{color:dark?'#2f3134':'#efe8de',roughness:.96,normalMap:fabricN,normalScale:new THREE.Vector2(.6,.6)}),
  pillar:P('PillarFabric',{color:dark?'#232528':'#e6ded3',roughness:.95,normalMap:fabricN,normalScale:new THREE.Vector2(.5,.5)}),
  door:P('DoorPanel',{color:dark?'#1d1f22':'#ece5da',roughness:.7,normalMap:softN,normalScale:new THREE.Vector2(.3,.3)}),
  carpet:P('Carpet',{color:dark?'#151618':'#2e2221',roughness:1,normalMap:fabricN,normalScale:new THREE.Vector2(1.2,1.2)}),
  vent:P('VentSlot',{color:'#050506',roughness:.7}),
  roofGlass:PP('RoofGlass',{color:'#2a3944',roughness:.06,metalness:.3,clearcoat:1,clearcoatRoughness:.03,side:THREE.DoubleSide}),
  light:Object.assign(new THREE.MeshStandardMaterial({color:'#ffe2b3',emissive:new THREE.Color('#ffd49a'),emissiveIntensity:1.4}),{name:'AmbientLight'}),
  glass:P('Glass',{color:'#a8bccb',transparent:true,opacity:.06,roughness:0,metalness:0,side:THREE.DoubleSide,depthWrite:false}),
  screen:Object.assign(new THREE.MeshBasicMaterial({color:'#0d1216'}),{name:'ScreenPlaceholder'}),
 };
}

const mesh=(geo,mat,name,pos=[0,0,0],rot=[0,0,0])=>{const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(...pos);m.rotation.set(...rot);return m;};
const rbox=(w,h,d,r=.02,seg=4)=>new RoundedBoxGeometry(w,h,d,seg,Math.min(r,w/2-.001,h/2-.001,d/2-.001));
// 옆면 단면(앞쪽 거리 s, 높이 y)을 좌우 폭만큼 밀어 곡면 패널을 만든다. z=-s.
function sweep(width,profile,bevel=.012){
 const shape=new THREE.Shape();shape.moveTo(...profile[0]);shape.splineThru(profile.slice(1).map(p=>new THREE.Vector2(...p)));shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:4,curveSegments:40});
 g.rotateY(Math.PI/2);g.translate(-width/2,0,0);g.computeVertexNormals();return g;
}

function shell(m,group,{glassRoof=false}={}){
 // 앞 유리, A필러, 천장, 선바이저, 룸미러, 바닥
 for(const s of [-1,1])group.add(mesh(rbox(.07,1.07,.06,.026),m.pillar,'APillar'+(s<0?'L':'R'),[s*.865,1.37,-.8],[.74,0,-s*.05]));
 if(glassRoof){group.add(mesh(new THREE.PlaneGeometry(1.5,1.5),m.roofGlass,'GlassRoof',[0,1.81,.35],[Math.PI/2,0,0]));for(const s of [-1,1])group.add(mesh(rbox(.16,.05,1.6,.02),m.fabric,'RoofRail'+(s<0?'L':'R'),[s*.84,1.8,.35]));}
 else group.add(mesh(rbox(1.86,.05,1.6,.02),m.fabric,'Headliner',[0,1.8,.35]));
 group.add(mesh(rbox(1.72,.07,.14,.03),m.fabric,'HeaderRail',[0,1.765,-.44]));
 if(!glassRoof)for(const s of [-1,1])group.add(mesh(rbox(.37,.022,.17,.009),m.fabric,'SunVisor'+(s<0?'L':'R'),[s*.4,1.738,-.34],[-.18,0,0]));
 const mirror=new THREE.Group();mirror.name='RearViewMirror';mirror.position.set(0,1.665,-.53);mirror.add(mesh(rbox(.27,.078,.035,.026),m.piano,'MirrorBody'),mesh(new THREE.CylinderGeometry(.012,.014,.085,10),m.dashTop,'MirrorStem',[0,.06,.02]));group.add(mirror);
 group.add(mesh(new THREE.PlaneGeometry(1.74,1.9),m.carpet,'Floor',[0,.36,-.3],[-Math.PI/2,0,0]));
}
function doors(m,group,{light=false,wood=null}={}){
 for(const s of [-1,1]){const d=new THREE.Group();d.name='Door'+(s<0?'L':'R');d.position.set(s*.9,0,.12);
  d.add(mesh(rbox(.08,.64,2.05,.03),m.door,'DoorTrim',[0,.67,0]));
  d.add(mesh(rbox(.11,.065,1.95,.028),m.dashTop,'WindowSill',[-s*.012,1.0,0]));
  // 앞에서 뒤로 비스듬히 내려오는 팔걸이(사진 1의 곡선 팔걸이 단순화)
  d.add(mesh(rbox(.12,.055,.62,.025),m.leather,'Armrest',[-s*.045,.84,.14],[.07,0,0]));
  d.add(mesh(rbox(.03,.035,.15,.012),m.trim,'DoorHandle',[-s*.052,.93,-.12]));
  if(wood)d.add(mesh(new THREE.BoxGeometry(.012,.05,1.1),m.wood,'DoorWood',[-s*.045,.955,-.12]));
  if(light)d.add(mesh(new THREE.BoxGeometry(.012,.012,1.05),m.light,'DoorAmbient',[-s*.046,.905,-.1]));
  d.add(mesh(new THREE.CircleGeometry(.075,32),m.vent,'Speaker',[-s*.043,.6,-.45],[0,s*Math.PI/2,0]));
  group.add(d);}
}
function screen(m,w,h,name='Screen'){
 // 'Screen' 메시는 시뮬레이터가 실시간 계기 화면 텍스처로 바꾼다.
 const g=new THREE.Group();g.name=name+'Unit';
 g.add(mesh(rbox(w+.024,h+.024,.024,.01),m.piano,name+'Bezel'));
 const sm=mesh(new THREE.PlaneGeometry(w,h),m.screen,name,[0,0,.0125]);g.add(sm);
 g.userData.aspect=w/h;return g;
}
function steeringWheel(m){
 // 원형 2스포크 운전대(사진 2), 둥근 에어백 커버. 엠블럼 없음.
 const g=new THREE.Group();g.name='SteeringWheel';
 g.add(mesh(new THREE.TorusGeometry(.19,.029,28,96),m.leather,'Rim'));
 g.add(mesh(new THREE.TorusGeometry(.19,.0305,8,48,Math.PI*.28),m.leather,'RimGripStitch',[0,0,0],[0,0,Math.PI*.36]));
 for(const s of [-1,1]){const sp=mesh(rbox(.12,.045,.024,.012),m.leather,'Spoke'+(s<0?'L':'R'),[s*.115,-.012,0]);g.add(sp);
  g.add(mesh(rbox(.045,.026,.008,.004),m.piano,'SpokeSwitch'+(s<0?'L':'R'),[s*.115,-.008,.015]));}
 const hubPts=[[0,.036],[.055,.034],[.077,.024],[.083,.006],[.08,-.014],[.06,-.022],[0,-.022]].map(([x,y])=>new THREE.Vector2(x,y));
 const hub=new THREE.LatheGeometry(hubPts,48);hub.rotateX(Math.PI/2);hub.scale(1.15,.95,1);g.add(mesh(hub,m.leather,'AirbagCover',[0,-.012,.01]));
 g.add(mesh(new THREE.CylinderGeometry(.043,.062,.24,24),m.dashTop,'Column',[0,-.03,-.14],[Math.PI/2,0,0]));
 const stalk=mesh(new THREE.CylinderGeometry(.011,.013,.12,14),m.piano,'ShiftStalk',[.12,-.03,-.09],[0,0,Math.PI/2-.5]);g.add(stalk);
 return g;
}

export function buildWheelCabin(){
 const m=materials('dark'),g=new THREE.Group();g.name='CabinWheel';shell(m,g);doors(m,g,{wood:true});
 // 대시보드: 낮고 수평이 강조된 형태, 앞쪽은 유리 아래로 깊게 들어간다.
 g.add(mesh(sweep(1.74,[[1.14,.96],[1.0,1.0],[.82,1.015],[.68,1.0],[.6,.97],[.57,.9],[.56,.8],[.6,.66],[.72,.5],[.95,.42],[1.14,.46],[1.18,.8]]),m.dashLower,'Dashboard'));
 g.add(mesh(sweep(1.76,[[1.15,.955],[1.0,1.006],[.82,1.022],[.68,1.006],[.6,.975],[.63,.955],[.8,.99],[1.0,.975],[1.15,.93]],.006),m.dashTop,'DashTop'));
 // 가로 우드 트림과 그 위 송풍구 슬릿(사진 2)
 g.add(mesh(sweep(1.7,[[.585,.95],[.553,.928],[.55,.885],[.562,.862],[.6,.866],[.61,.94]],.004),m.wood,'WoodTrim'));
 g.add(mesh(new THREE.BoxGeometry(1.66,.012,.02),m.vent,'VentSlit',[0,.962,-.588]));
 // 떠 있는 중앙 화면(가로형) + 받침
 const sc=screen(m,.4,.26);sc.position.set(0,1.11,-.66);sc.rotation.set(-.14,0,0);g.add(sc);
 g.add(mesh(rbox(.06,.08,.05,.015),m.piano,'ScreenMount',[0,1.0,-.7]));
 // 센터 콘솔: 화면 아래에서 뒤로 이어지는 넓은 콘솔, 무선충전 패드 두 개, 팔걸이
 g.add(mesh(rbox(.28,.3,.78,.04),m.dashLower,'ConsoleBody',[0,.52,-.12]));
 g.add(mesh(rbox(.29,.03,.8,.014),m.piano,'ConsoleTop',[0,.68,-.12]));
 for(const z of [-.36,-.2])g.add(mesh(rbox(.11,.004,.13,.003),m.carpet,'ChargePad',[z<-.3?-.065:.065,.697,-.3]));
 g.add(mesh(rbox(.26,.1,.34,.045),m.leather,'ConsoleArmrest',[0,.73,.42]));
 const sw=steeringWheel(m);sw.position.set(DRIVER_X,.88,-.4);sw.rotation.set(-.42,0,0);g.add(sw);
 // 페달: 왼쪽 브레이크(넓음), 오른쪽 가속(세로형) — 화면의 버튼 배치와 같다.
 const pedals=new THREE.Group();pedals.name='Pedals';pedals.position.set(DRIVER_X,.44,-.86);
 pedals.add(mesh(rbox(.12,.075,.02,.008),m.trim,'BrakePedal',[-.065,0,0],[-.6,0,0]),mesh(rbox(.055,.17,.02,.008),m.trim,'AccelPedal',[.1,.02,0],[-.6,0,0]));g.add(pedals);
 return g;
}

export function buildDriverlessCabin(){
 const m=materials('light'),g=new THREE.Group();g.name='CabinDriverless';shell(m,g,{glassRoof:true});doors(m,g,{light:true});
 // 짙은 대시보드 벽 + 얇은 상단, 화면 양옆으로 이어지는 따뜻한 조명(사진 1)
 g.add(mesh(sweep(1.74,[[1.2,.97],[1.02,1.0],[.88,.995],[.81,.965],[.795,.86],[.8,.66],[.83,.5],[.9,.37],[1.22,.37]]),m.dashLower,'Dashboard'));
 g.add(mesh(rbox(1.74,.03,.3,.012),m.dashTop,'DashTop',[0,.995,-1.0]));
 for(const s of [-1,1])g.add(mesh(new THREE.BoxGeometry(.6,.014,.014),m.light,'DashLight'+(s<0?'L':'R'),[s*.53,.968,-.8]));
 g.add(mesh(new THREE.BoxGeometry(1.7,.006,.01),m.trim,'DashTrimLine',[0,.985,-.83]));
 const sc=screen(m,.62,.38);sc.position.set(0,1.19,-.84);sc.rotation.set(-.1,0,0);g.add(sc);
 g.add(mesh(rbox(.07,.12,.06,.015),m.piano,'ScreenMount',[0,1.0,-.88]));
 // 앞좌석 없는 라운지: 앞쪽은 비워 두고, 시점 바로 앞에 뒷좌석 쿠션과 가운데 팔걸이·컵홀더
 for(const s of [-1,1]){g.add(mesh(rbox(.66,.16,.62,.07),m.leather,'RearSeatCushion'+(s<0?'L':'R'),[s*.4,.56,.55]));
  g.add(mesh(rbox(.6,.03,.5,.015),m.leather,'RearSeatStitch'+(s<0?'L':'R'),[s*.4,.645,.53]));}
 g.add(mesh(rbox(.2,.14,.5,.05),m.leather,'RearArmrest',[0,.62,.55]));
 g.add(mesh(new THREE.CylinderGeometry(.045,.045,.03,32,1,true),m.piano,'CupHolder',[0,.68,.4]));
 g.add(mesh(new THREE.CircleGeometry(.044,32),m.vent,'CupHolderBase',[0,.675,.4],[-Math.PI/2,0,0]));
 return g;
}
