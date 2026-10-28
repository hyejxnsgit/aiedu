// cabin-model.mjs의 실내 두 개를 .glb로 내보낸다. 브라우저에서 열면 파일 두 개가 내려받아진다.
// 자동화: window.__glb에 base64가 담긴다(검증 스크립트가 public/models/에 저장).
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {buildWheelCabin,buildDriverlessCabin} from '../cabin-model.mjs';
const exporter=new GLTFExporter(),out={};
const b64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return btoa(s);};
for(const [name,build] of [['cabin-wheel',buildWheelCabin],['cabin-driverless',buildDriverlessCabin]]){
 const buf=await exporter.parseAsync(build(),{binary:true,maxTextureSize:512});out[name]=b64(buf);
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'model/gltf-binary'}));a.download=name+'.glb';if(!navigator.webdriver)a.click();
}
window.__glb=out;document.getElementById('s').textContent='완료: '+Object.keys(out).join(', ');
