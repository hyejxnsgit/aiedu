// 차시 고르기 말풍선용 2초 주행 클립을 만드는 페이지: 저장된 주행 기록을 시각별로 그린다.
import {World} from '../../world.mjs';
import {replayState} from '../../learning.mjs';
import trace from './trace.json';
const world=new World(document.getElementById('c'),{view:'chase'});
const at=t=>trace.find(r=>r.t_s>=t)??trace.at(-1);
window.drawAt=t=>{world.resize();world.render(replayState(at(t)));};
window.t0=trace[0].t_s;
