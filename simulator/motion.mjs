// Teaching-model assumptions, not validated real-vehicle specifications.
export const CONFIG = Object.freeze({dt:0.02, acceleration:2, dryBrake:4, wetBrake:2.5, dryCap:50, wetCap:40});
function nonnegative(value,name){if(!Number.isFinite(value)||value<0)throw Error(`Invalid ${name}`);}
export function roadSettings(road){
  if(!['dry','wet'].includes(road))throw Error('Unknown road');
  return {cap:CONFIG[road+'Cap']/3.6,brake:CONFIG[road+'Brake']};
}

// Integrate an interval exactly, including a stop or speed-cap crossing.
// Position x can represent a vehicle's front or rear; caller must keep that convention.
export function advance({x,v},a,seconds,cap){
  nonnegative(v,'speed');nonnegative(seconds,'duration');nonnegative(cap,'cap');
  if(!Number.isFinite(x)||!Number.isFinite(a)||v>cap+1e-9)throw Error('Invalid motion state');
  const limit=a>0?cap:0;
  const hit=a===0?Infinity:(limit-v)/a;
  const active=Math.max(0,Math.min(seconds,hit));
  const nextV=Math.max(0,Math.min(cap,v+a*active));
  return {x:x+v*active+0.5*a*active*active+nextV*(seconds-active),v:nextV};
}

export function simulateInterval({speedKmh,deltaKmh,road,duration=1,x=0}){
  nonnegative(speedKmh,'speed');nonnegative(duration,'duration');
  if(duration>1||!Number.isFinite(deltaKmh))throw Error('Invalid interval');
  const {cap,brake}=roadSettings(road);
  if(speedKmh/3.6>cap+1e-9)throw Error('Initial speed exceeds road cap');
  // The request always refers to a full second, even if recording stops early.
  const requestedA=deltaKmh/3.6;
  const a=Math.max(-brake,Math.min(CONFIG.acceleration,requestedA));
  let state={x,v:speedKmh/3.6};
  const samples=[{t_s:0,x_m:x,speed_kmh:speedKmh}];
  const ticks=Math.ceil(duration/CONFIG.dt);
  for(let i=0;i<ticks;i++){
    const t0=i*CONFIG.dt,t1=Math.min((i+1)*CONFIG.dt,duration);
    state=advance(state,a,t1-t0,cap);
    samples.push({t_s:t1,x_m:state.x,speed_kmh:state.v*3.6});
  }
  const reasons=[];
  if(a!==requestedA)reasons.push(requestedA<0?'braking_limit':'acceleration_limit');
  if(a<0 && speedKmh/3.6+a*duration<0)reasons.push('stopped');
  if(a>0 && speedKmh/3.6+a*duration>cap)reasons.push('speed_cap');
  return {road,start_speed_kmh:speedKmh,requested_delta_kmh:deltaKmh,
    actual_delta_kmh:state.v*3.6-speedKmh,end_speed_kmh:state.v*3.6,
    interval_duration_s:duration,complete_interval:duration===1,
    distance_m:state.x-x,limits:reasons,samples};
}

export function requiredDistance(speedKmh,road){
  nonnegative(speedKmh,'speed');const {brake}=roadSettings(road);
  const v=speedKmh/3.6,a=CONFIG.acceleration,tau=1,margin=2;
  return v*tau+0.5*a*tau*tau+(v+a*tau)**2/(2*brake)+margin;
}
