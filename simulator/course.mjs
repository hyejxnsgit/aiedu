// 앞차 움직임 코스. A는 2차시에 직접 운전한 코스, B는 3차시에만 공개하는 처음 보는 코스다.
// 앞차는 시각만 보고 움직이며 내 차에 반응하지 않는다(설계 5.2). 두 코스 모두 30초 안에 앞차가 160m 지점을 지나간다.
const kmh=v=>v/3.6;
function profile(segments){
 // segments: [끝 시각, 구간 가속도(m/s²)] 순서. 마지막 구간 이후는 0.
 return t=>{for(const [end,a] of segments)if(t<end)return a;return 0;};
}
export const COURSES={
 A:{id:'A',label:'A 코스 · 2차시에 운전한 코스',short:'A 코스',
  lead:profile([[4,0],[8,-kmh(25)/4],[11,0],[15,kmh(25)/4]]),
  phase:t=>t<4?'앞차를 따라 주행':t<8?'앞차가 감속합니다':t<11?'앞차 정지':t<15?'앞차가 다시 출발합니다':'앞차를 따라 주행',
  events:[{t:4,title:'앞차가 감속을 시작한 순간'},{t:8,title:'앞차가 멈춘 순간'},{t:11,title:'앞차가 다시 출발한 순간'}]},
 B:{id:'B',label:'B 코스 · 처음 보는 코스',short:'B 코스',
  lead:profile([[3,0],[5.5,-kmh(25)/2.5],[8,0],[11,kmh(30)/3],[16,0],[18,-kmh(10)/2]]),
  phase:t=>t<3?'앞차를 따라 주행':t<5.5?'앞차가 급하게 감속합니다':t<8?'앞차 정지':t<11?'앞차가 빠르게 출발합니다':t<16?'앞차를 따라 주행':t<18?'앞차가 감속합니다':'앞차를 따라 주행',
  events:[{t:3,title:'앞차가 급하게 감속한 순간'},{t:5.5,title:'앞차가 멈춘 순간'},{t:8,title:'앞차가 빠르게 출발한 순간'},{t:16,title:'앞차가 다시 감속한 순간'}]},
};
export function course(id){const c=COURSES[id];if(!c)throw Error('알 수 없는 코스입니다.');return c;}
