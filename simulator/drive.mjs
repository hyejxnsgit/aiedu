import {advance,roadSettings,requiredDistance,CONFIG} from './motion.mjs';
import {course as courseOf} from './course.mjs';

// Piecewise constant acceleration; split at either car's speed limit/stop.
export function movePair(ego,lead,egoA,leadA,dt,cap){
  let elapsed=0,minGap=lead.x-ego.x;
  if(minGap<=0)return {ego,lead,elapsed:0,minGap:0,collision:true};
  while(elapsed<dt-1e-12){
    let ea=(ego.v<=0&&egoA<0)||(ego.v>=cap-1e-12&&egoA>0)?0:egoA;
    let la=(lead.v<=0&&leadA<0)||(lead.v>=cap-1e-12&&leadA>0)?0:leadA;
    const bound=(v,a)=>a>0?(cap-v)/a:a<0?-v/a:Infinity;
    const h=Math.min(dt-elapsed,bound(ego.v,ea),bound(lead.v,la));
    const gap=lead.x-ego.x,rv=lead.v-ego.v,ra=la-ea;
    const g=s=>gap+rv*s+0.5*ra*s*s;
    const roots=Math.abs(ra)<1e-12?(rv<0?[-gap/rv]:[]):(()=>{
      const disc=rv*rv-2*ra*gap;
      return disc<0?[]:[(-rv-Math.sqrt(disc))/ra,(-rv+Math.sqrt(disc))/ra];
    })();
    const contact=roots.filter(x=>x>=0&&x<=h+1e-10).sort((a,b)=>a-b)[0];
    const s=contact===undefined?h:Math.min(h,contact);
    minGap=Math.min(minGap,g(s));
    if(ra!==0){const vertex=-rv/ra;if(vertex>0&&vertex<s)minGap=Math.min(minGap,g(vertex));}
    ego=advance(ego,ea,s,cap);lead=advance(lead,la,s,cap);elapsed+=s;
    if(contact!==undefined){lead.x=ego.x;return {ego,lead,elapsed,minGap:0,collision:true};}
  }
  return {ego,lead,elapsed:dt,minGap,collision:false};
}

export class Drive {
  constructor({road='dry',gap=40,speed=30,mode='manual',predictor=null,runId='run',purpose='collection',course='A'}={}){
    const {cap}=roadSettings(road);courseOf(course);
    if(!Number.isFinite(gap)||gap<=0||!Number.isFinite(speed)||speed<0||speed>cap*3.6)throw Error('시작 조건을 확인하세요.');
    if(!['manual','model'].includes(mode)||(mode==='model'&&typeof predictor!=='function'))throw Error('모델을 먼저 불러오세요.');
    if(!['practice','collection','improvement'].includes(purpose))throw Error('주행 용도를 확인하세요.');
    Object.assign(this,{road,course,startGap:gap,mode,predictor,runId,purpose,t:0,tick:0,ego:{x:0,v:speed/3.6},lead:{x:gap,v:25/3.6},rows:[],trace:[],pending:0,current:null,ended:null,minGap:gap,violations:0});
  }
  inputs(){return {ego_speed_kmh:this.ego.v*3.6,gap_m:Math.max(0,this.lead.x-this.ego.x),lead_speed_kmh:this.lead.v*3.6,road:this.road};}
  leadAcceleration(){return courseOf(this.course).lead(this.t);}
  finishRow(){
    if(!this.current)return;
    const duration=this.t-this.current.t_s;
    this.rows.push({...this.current,actual_delta_kmh:this.ego.v*3.6-this.current.ego_speed_kmh,interval_duration_s:duration,complete_interval:Math.abs(duration-1)<1e-8});
    this.current=null;
  }
  step(){
    if(this.ended)return;
    if(!this.current){
      const input=this.inputs();let request=this.mode==='model'?this.predictor(input):this.pending;
      if(!Number.isFinite(request))throw Error('유효하지 않은 모델/조작값입니다.');
      this.current={run_id:this.runId,t_s:this.t,source:this.purpose==='practice'?'guided_practice':this.mode==='manual'?'student_demo':'model_rollout',...input,requested_delta_kmh:request,control_changes:[]};
    }
    const {cap,brake}=roadSettings(this.road);
    // Manual pedals react on the next 20ms physics tick; models still decide once per second.
    const request=this.mode==='manual'?this.pending:this.current.requested_delta_kmh;
    if(!Number.isFinite(request))throw Error('유효하지 않은 조작값입니다.');
    if(this.current.control_changes.at(-1)?.delta_kmh!==request)this.current.control_changes.push({t_s:this.t,delta_kmh:request});
    const requestedA=request/3.6;
    const acceleration=Math.min(CONFIG.acceleration,Math.max(-brake,requestedA));
    const leadAcceleration=this.leadAcceleration();
    const state=movePair(this.ego,this.lead,acceleration,leadAcceleration,CONFIG.dt,cap);
    this.ego=state.ego;this.lead=state.lead;this.tick++;
    this.t=state.collision?this.t+state.elapsed:this.tick*CONFIG.dt;
    this.minGap=Math.min(this.minGap,state.minGap);
    const input=this.inputs(),required=requiredDistance(input.ego_speed_kmh,this.road);
    const violation=input.gap_m<required;
    if(violation)this.violations+=state.elapsed;
    this.trace.push({t_s:this.t,...input,ego_x_m:this.ego.x,lead_x_m:this.lead.x,lead_acceleration_mps2:leadAcceleration,requested_delta_kmh:request,applied_acceleration_mps2:acceleration,required_gap_m:required,violation,collision:state.collision});
    if(state.collision)this.ended='collision';
    else if(this.ego.x>=160)this.ended='completed';
    else if(this.tick>=1500)this.ended='timeout';
    if(this.tick%50===0||this.ended)this.finishRow();
  }
  stop(){if(!this.ended){this.ended='manual_abort';this.finishRow();}}
}

export function trainingCSV(drive){
  const keys=['run_id','t_s','source','ego_speed_kmh','gap_m','lead_speed_kmh','road','actual_delta_kmh'];
  const rows=drive.rows.filter(r=>r.complete_interval&&r.source==='student_demo');
  const escape=v=>'"'+String(v).replaceAll('"','""')+'"';
  return '\ufeff'+[keys.join(','),...rows.map(r=>keys.map(k=>escape(r[k])).join(','))].join('\n');
}
