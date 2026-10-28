// 시작 화면: 격자선으로 짠 주황 홀로그램 차가 한 바퀴(360°) 돌며 나타나고, 스캔 빛 띠가 차체를 훑는다(블룸으로 빛 번짐).
// "시작하기"를 누르면 3D 장면을 정리(unmount)하고 차시 선택으로 넘어간다. WebGL이 없으면 글자와 버튼만 보여준다.
import * as THREE from 'three';
import {createRoot,extend,useFrame,useThree} from '@react-three/fiber';
import {Suspense,forwardRef,useEffect,useMemo,useRef} from 'react';
import {useGLTF} from '@react-three/drei';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {buildHologramCar,buildWheel} from './hologram-car.mjs';

extend(THREE);
const AMBER=new THREE.Color('#ff9a3c'),HOT=new THREE.Color('#ffd9a0');
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut=t=>1-Math.pow(1-t,3);
// 배경 교실 사진. 파일이 있으면 깔고, 없으면 어두운 무대로 둔다.
const BACKDROP='media/splash-classroom.jpg';

// 격자선: 기본은 은은한 주황, 특징선(weight↑)은 더 밝게, 지나가는 스캔 띠는 거의 흰빛.
const lineMaterial=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
 uniforms:{scan:{value:-9},amber:{value:AMBER},hot:{value:HOT},gain:{value:1}},
 vertexShader:`attribute float weight;varying float w;varying vec3 p;void main(){w=weight;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float scan,gain;uniform vec3 amber,hot;varying float w;varying vec3 p;
  void main(){float band=exp(-pow((p.z-scan)/.18,2.));vec3 c=mix(amber*(.05+.42*w),hot*1.1,band*.55);gl_FragColor=vec4(c*gain,1.);}`});
// 차체 껍질: 정면은 거의 투명, 비스듬한 가장자리일수록 빛난다(프레넬).
const shellMaterial=()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
 uniforms:{amber:{value:AMBER},gain:{value:1}},
 vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform vec3 amber;uniform float gain;varying vec3 n;varying vec3 v;void main(){float f=pow(1.-abs(dot(n,v)),2.6);gl_FragColor=vec4(amber*(.006+.18*f)*gain,1.);}`});

// Meshy로 만든 내 차 모델을 홀로그램으로: 면은 프레넬 껍질, 각진 곳(모서리)만 선으로 뽑아 같은 스캔 띠 재질로 빛나게 한다.
// 차 앞이 +z가 되도록 돌리고(주행 장면에서는 -z가 앞), 좌표를 미리 굽혀 스캔 띠가 차 길이 방향으로 지나가게 한다.
function holoFromModel(scene){
 scene.updateMatrixWorld(true);const parts=[];
 scene.traverse(n=>{if(!n.isMesh)return;const g=new THREE.BufferGeometry(),a=n.geometry.attributes.position,f=new Float32Array(a.count*3);
  for(let i=0;i<a.count;i++){f[i*3]=a.getX(i);f[i*3+1]=a.getY(i);f[i*3+2]=a.getZ(i);}
  g.setAttribute('position',new THREE.BufferAttribute(f,3));if(n.geometry.index)g.setIndex(n.geometry.index.clone());g.applyMatrix4(n.matrixWorld);parts.push(g.index?g:g.toNonIndexed());});
 const shell=mergeGeometries(parts.map(g=>g.index?g:g),false);shell.rotateY(Math.PI);shell.computeVertexNormals();
 const lines=new THREE.EdgesGeometry(shell,24),w=new Float32Array(lines.attributes.position.count);
 // 위쪽 선(지붕·창문 테두리)일수록 조금 더 밝게
 for(let i=0;i<w.length;i++)w[i]=.45+.55*Math.min(1,Math.max(0,(lines.attributes.position.getY(i)-.5)/1));
 lines.setAttribute('weight',new THREE.BufferAttribute(w,1));return {shell,lines};
}
function ModelHoloCar({lineMat,shellMat}){
 const {scene}=useGLTF('models/ego-car.glb');const {shell,lines}=useMemo(()=>holoFromModel(scene),[scene]);
 return <group><mesh geometry={shell} material={shellMat}/><lineSegments geometry={lines} material={lineMat}/></group>;
}
function ModelHoloFaint({lineMat}){const {scene}=useGLTF('models/ego-car.glb');const {lines}=useMemo(()=>holoFromModel(scene),[scene]);
 const m=useMemo(()=>new THREE.LineBasicMaterial({color:AMBER,transparent:true,opacity:.02,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),[]);
 return <lineSegments geometry={lines} material={m}/>;}
function HoloCar({lineMat,shellMat}){
 const {shell,lines,lamp}=useMemo(()=>buildHologramCar(),[]),wheel=useMemo(()=>buildWheel(),[]);
 const wheelMat=useMemo(()=>new THREE.LineBasicMaterial({color:AMBER.clone().multiplyScalar(.7),transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),[]);
 const lampMat=useMemo(()=>new THREE.LineBasicMaterial({color:new THREE.Color('#ffe2b0').multiplyScalar(.95),toneMapped:false}),[]);
 return <group>
  <mesh geometry={shell} material={shellMat}/>
  <lineSegments geometry={lines} material={lineMat}/>
  <lineSegments geometry={lamp} material={lampMat}/>
  {[-1,1].flatMap(sx=>[-1.42,1.48].map(z=><lineSegments key={sx+','+z} geometry={wheel} material={wheelMat} position={[sx*.84,.4,z]} scale={[sx,1,1]}/>))}
 </group>;
}
// 바닥: 차 밑 주황 반사광 + 동심원 문양(가는 선, 일부 점선). 바닥 자체는 그리지 않아 배경 사진의 바닥이 보인다.
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),r=g.createRadialGradient(128,128,0,128,128,128);
 r.addColorStop(0,'rgba(255,150,60,.3)');r.addColorStop(.35,'rgba(255,120,40,.14)');r.addColorStop(1,'rgba(255,100,30,0)');g.fillStyle=r;g.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const Floor=forwardRef(function Floor(_,ref){
 const glow=useMemo(glowTexture,[]),ring=(r,w,o,start=0,len=Math.PI*2)=><mesh rotation={[-Math.PI/2,0,0]} position={[0,.004,0]}><ringGeometry args={[r,r+w,160,1,start,len]}/><meshBasicMaterial color={AMBER} transparent opacity={o} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>;
 return <group ref={ref}>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.002,0]}><planeGeometry args={[8,9]}/><meshBasicMaterial map={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  {ring(2.9,.02,.9)}{ring(3.15,.012,.6,.3,4.2)}{ring(3.6,.01,.45,2.2,3.3)}{ring(4.3,.008,.3)}{ring(5.2,.006,.25,4,2.6)}
 </group>;
});
// 블룸(빛 번짐): R3F 기본 렌더 대신 합성기로 그린다.
function Bloom(){
 const {gl,scene,camera,size}=useThree();
 const composer=useMemo(()=>{const c=new EffectComposer(gl);c.addPass(new RenderPass(scene,camera));c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width,size.height),.55,.5,.42));c.addPass(new OutputPass());return c;},[gl,scene,camera]);
 useEffect(()=>{composer.setSize(size.width,size.height);},[composer,size]);
 useFrame((_,dt)=>composer.render(dt),1);
 return null;
}
function Backdrop(){
 const {scene}=useThree();
 useEffect(()=>{new THREE.TextureLoader().load(BACKDROP,t=>{t.colorSpace=THREE.SRGBColorSpace;scene.background=t;},undefined,()=>{});},[scene]);
 return null;
}
function Stage({started}){
 const car=useRef(),reflection=useRef(),floor=useRef(),t0=useRef(null);
 const lineMat=useMemo(lineMaterial,[]),shellMat=useMemo(shellMaterial,[]);
 useFrame(({clock})=>{
  const t=clock.elapsedTime;t0.current??=t;const k=t-t0.current;
  // 처음 2.8초 동안 한 바퀴(360°) 돌며 나타나고, 그다음 아주 천천히 돈다. 출발을 누르면 빠르게 돌며 사라진다.
  const base=.25,spin=REDUCED?base:k<2.8?base-Math.PI*2*(1-easeOut(k/2.8)):base+Math.sin((k-2.8)*.25)*.35;
  const y=spin+(started.current!=null?(k-started.current)*7:0);car.current.rotation.y=y;reflection.current.rotation.y=y;
  const appear=REDUCED?1:Math.min(1,k/1.2);lineMat.uniforms.gain.value=appear;shellMat.uniforms.gain.value=appear;
  // 바닥 원: 0~1초 줄어들었다가 1~2초에 원래 크기로 퍼진다.
  const f=REDUCED||k>=2?1:k<1?1-.45*easeOut(k):.55+.45*easeOut(k-1);floor.current.scale.set(f,1,f);
  lineMat.uniforms.scan.value=REDUCED?-9:((k*1.6)%7)-3.5;// 스캔 빛 띠가 차 앞에서 뒤로 반복해서 지나간다
 });
 return <>
  <color attach="background" args={['#050302']}/>
  <Backdrop/>
  {/* 모델을 불러오는 동안·실패하면 코드로 짠 격자 차를 보여준다 */}
  <group ref={car}><Suspense fallback={<HoloCar lineMat={lineMat} shellMat={shellMat}/>}><ModelHoloCar lineMat={lineMat} shellMat={shellMat}/></Suspense></group>
  {/* 바닥 반사: 뒤집은 복제를 아주 흐리게 */}
  <group ref={reflection} scale={[1,-1,1]}><group scale={1}><Suspense fallback={<HoloCarFaint lineMat={lineMat}/>}><ModelHoloFaint lineMat={lineMat}/></Suspense></group></group>
  <Floor ref={floor}/>
  <Bloom/>
 </>;
}
function HoloCarFaint(){const {lines}=useMemo(()=>buildHologramCar({nu:40,nv:20}),[]);
 const m=useMemo(()=>new THREE.LineBasicMaterial({color:AMBER,transparent:true,opacity:.014,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),[]);
 return <lineSegments geometry={lines} material={m}/>;}

export function showSplash(){
 return new Promise(resolve=>{
  const el=document.createElement('section');el.className='splash';el.setAttribute('aria-label','시작 화면');
  el.innerHTML=`<canvas aria-hidden="true"></canvas><div class="splashLines"></div><div class="splashText"><p class="splashBrand">AI EDU</p><p class="splashEyebrow">자율주행 머신러닝 실습</p><h1>반가워요</h1>
   <p>내 운전을 기록하고, <b>AI 모델</b>을 학습시켜 직접 달리게 해 보세요.</p><button class="splashStart" type="button">시작하기</button></div>`;
  document.body.append(el);
  const canvas=el.querySelector('canvas'),started={current:null};let root=null,clock=null;
  try{
   const probe=document.createElement('canvas');if(!(probe.getContext('webgl2')||probe.getContext('webgl')))throw Error('no webgl');
   root=createRoot(canvas);
   root.configure({gl:{antialias:true,powerPreference:'high-performance'},dpr:[1,1.5],shadows:false,camera:{fov:32,position:[6.8,2.1,10.4],near:.1,far:80},
    onCreated:({camera,clock:c})=>{camera.lookAt(.2,-.95,0);clock=c;},size:{width:innerWidth,height:innerHeight,top:0,left:0}});
   root.render(<Stage started={started}/>);
   addEventListener('resize',onResize);
  }catch{canvas.remove();}
  function onResize(){root?.configure({size:{width:innerWidth,height:innerHeight,top:0,left:0}});}
  let done=false;
  function go(){if(done)return;done=true;removeEventListener('keydown',onKey);
   started.current=clock?.elapsedTime??0;// 출발 직전 한 번 빠르게 돌고 사라진다
   setTimeout(()=>{el.classList.add('leaving');resolve();},REDUCED?0:450);
   setTimeout(()=>{removeEventListener('resize',onResize);root?.unmount();el.remove();},REDUCED?50:1100);}
  function onKey(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}}
  el.querySelector('.splashStart').onclick=go;addEventListener('keydown',onKey);
  el.querySelector('.splashStart').focus();
 });
}

// 3차시에서 모델을 불러오면: 검은 화면에 내 자율주행차(홀로그램)가 크게 반짝이며 한 바퀴 돌고 "학습 완료"를 알린다.
// 설정 창(모달) 위에 떠야 하므로 dialog로 띄운다. 클릭·Enter·Esc로 바로 닫을 수 있고, 4.6초 뒤 저절로 닫힌다.
function RevealStage(){
 const car=useRef(),reflection=useRef(),floor=useRef(),t0=useRef(null);
 const lineMat=useMemo(lineMaterial,[]),shellMat=useMemo(shellMaterial,[]);
 useFrame(({clock})=>{
  const t=clock.elapsedTime;t0.current??=t;const k=t-t0.current;
  // 작게 나타나 커지면서 2.4초 동안 한 바퀴 돌고, 그다음 천천히 돈다.
  const spin=REDUCED?.4:k<2.4?.4-Math.PI*2*(1-easeOut(k/2.4)):.4+(k-2.4)*.25;car.current.rotation.y=spin;reflection.current.rotation.y=spin;
  const s=REDUCED?1:.55+.45*easeOut(Math.min(1,k/.9));car.current.scale.setScalar(s);reflection.current.scale.set(s,-s,s);
  // 새것처럼 반짝: 처음 0.6초 밝게 번쩍였다가 가라앉고, 스캔 띠가 빠르게 지나간다.
  const flash=REDUCED?1:Math.min(1,k/.35)*(1+1.6*Math.exp(-Math.pow((k-.5)/.35,2)));lineMat.uniforms.gain.value=flash;shellMat.uniforms.gain.value=flash*1.4;
  lineMat.uniforms.scan.value=REDUCED?-9:((k*2.6)%7)-3.5;
  const f=REDUCED||k>=1.6?1:.5+.5*easeOut(k/1.6);floor.current.scale.set(f,1,f);
 });
 return <>
  <color attach="background" args={['#000']}/>
  <group ref={car}><Suspense fallback={<HoloCar lineMat={lineMat} shellMat={shellMat}/>}><ModelHoloCar lineMat={lineMat} shellMat={shellMat}/></Suspense></group>
  <group ref={reflection} scale={[1,-1,1]}><Suspense fallback={<HoloCarFaint lineMat={lineMat}/>}><ModelHoloFaint lineMat={lineMat}/></Suspense></group>
  <Floor ref={floor}/>
  <Bloom/>
 </>;
}
export function showModelReveal({label='모델'}={}){
 return new Promise(resolve=>{
  const dlg=document.createElement('dialog');dlg.className='modelReveal';dlg.setAttribute('aria-label',`${label} 학습 완료`);
  dlg.innerHTML=`<canvas aria-hidden="true"></canvas><div class="revealSparks" aria-hidden="true">${Array.from({length:14},(_,i)=>`<i style="--x:${(i*37)%100}%;--y:${18+(i*53)%60}%;--d:${(i%7)*.18}s"></i>`).join('')}</div>
   <div class="revealText"><p class="revealTag">NEW MODEL</p><h2 class="glitchText">${label} 학습 완료!</h2><p>내 주행 기록으로 배운 <b>나만의 자율주행차</b>가 준비됐어요.</p><button type="button" class="splashStart">확인</button></div>`;
  document.body.append(dlg);dlg.showModal();
  const canvas=dlg.querySelector('canvas');let root=null,done=false;
  try{const probe=document.createElement('canvas');if(!(probe.getContext('webgl2')||probe.getContext('webgl')))throw Error('no webgl');
   root=createRoot(canvas);
   root.configure({gl:{antialias:true},dpr:[1,1.5],camera:{fov:30,position:[5.2,1.7,8.2],near:.1,far:80},onCreated:({camera})=>camera.lookAt(0,.25,0),size:{width:innerWidth,height:innerHeight,top:0,left:0}});
   root.render(<RevealStage/>);}catch{canvas.remove();}
  const close=()=>{if(done)return;done=true;clearTimeout(timer);dlg.classList.add('leaving');setTimeout(()=>{root?.unmount();dlg.close();dlg.remove();resolve();},REDUCED?0:450);};
  const timer=setTimeout(close,4600);
  dlg.querySelector('button').onclick=close;dlg.addEventListener('cancel',e=>{e.preventDefault();close();});dlg.addEventListener('click',e=>{if(e.target!==dlg.querySelector('button'))close();});
  dlg.querySelector('button').focus();
 });
}
