// 실내 모델 확인용: ?kind=wheel|driverless&view=driver|chase
import {World} from '../world.mjs';
import {Drive} from '../drive.mjs';
const q=new URLSearchParams(location.search),w=new World(document.getElementById('c'));w.view=q.get('view')??'driver';w.cabin=q.get('kind')??'wheel';
const d=new Drive({runId:'view',speed:30,gap:35});for(let i=0;i<100;i++){d.pending=i<50?7.2:0;d.step();}
window.__w=w;const times=[];window.__frame=()=>{const t=performance.now();w.render(d);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{times.push(performance.now()-t);r(times.at(-1));})));};
setTimeout(()=>{window.__ready=true;},100);
