import test from 'node:test';
import assert from 'node:assert/strict';
// helper.mjs는 화면 없이도 불러올 수 있어야 한다(matchMedia가 없는 Node).
globalThis.matchMedia??=()=>({matches:false});
const {adviceFor,answer,FAQ,QUICK}=await import('./helper.mjs');

test('기준 판정과 학생 선택이 엇갈리면 조언한다', ()=>{
 assert.match(adviceFor({type:'reflection-match',verdict:'broken',match:'yes'}),/달랐다/);
 assert.match(adviceFor({type:'reflection-match',verdict:'kept',match:'no'}),/숫자/);
 assert.equal(adviceFor({type:'reflection-match',verdict:'kept',match:'yes'}),null);
 assert.equal(adviceFor({type:'reflection-match',verdict:'none',match:'partly'}),null);
});
test('근거에 숫자가 없을 때만 조언한다', ()=>{
 assert.ok(adviceFor({type:'evidence',text:'잘 멈췄다'}));
 assert.ok(adviceFor({type:'evidence'}));
 assert.equal(adviceFor({type:'evidence',text:'9초에 11m'}),null);
});
test('전처리 판단: 이상치만 있는 행 제외, 결측치 수정, 오류 행 유지, 짧은 이유', ()=>{
 assert.match(adviceFor({type:'review-decision',action:'exclude',types:['통계적 이상치 후보'],reason:'튀는 값이라서 제외'}),/급정거/);
 assert.match(adviceFor({type:'review-decision',action:'edit',types:['결측치'],reason:'원본에서 복구했다'}),/빈칸/);
 assert.match(adviceFor({type:'review-decision',action:'keep',types:['범위 오류'],reason:'그냥 두었다 확인함'}),/Orange/);
 assert.match(adviceFor({type:'review-decision',action:'keep',types:['통계적 이상치 후보'],reason:'짧'}),/이유/);
 assert.equal(adviceFor({type:'review-decision',action:'keep',types:['통계적 이상치 후보'],reason:'장면을 보니 실제 급정거였다'}),null);
 // 이상치와 다른 문제가 같이 있으면 제외는 맞는 판단이다.
 assert.equal(adviceFor({type:'review-decision',action:'exclude',types:['통계적 이상치 후보','결측치'],reason:'값이 빠져서 제외'}),null);
 assert.ok(adviceFor({type:'review-decision',action:'exclude'}));
});
test('예상·결과·비교·보고서', ()=>{
 assert.ok(adviceFor({type:'forecast',reason:'그냥'}));
 assert.equal(adviceFor({type:'forecast',reason:'멈춘 앞차 장면에서 −14km/h였으니까'}),null);
 assert.match(adviceFor({type:'result',outcomeSame:false,violationSame:true}),/단서/);
 assert.match(adviceFor({type:'result',outcomeSame:true,violationSame:true}),/맞았/);
 assert.equal(adviceFor({type:'result'}),null);
 assert.match(adviceFor({type:'compare-run',matched:false}),/똑같이/);
 assert.equal(adviceFor({type:'compare-run',matched:true}),null);
 assert.match(adviceFor({type:'report-step',empty:['근거','남은 질문']}),/근거, 남은 질문/);
 assert.equal(adviceFor({type:'report-step',empty:[]}),null);
 assert.equal(adviceFor({}),null);assert.equal(adviceFor(),null);
});
test('화면 검사 문구에 맞춰 조언한다', ()=>{
 assert.ok(adviceFor({type:'status',text:'세 장면 모두 내 예상을 고르고 모델 값을 확인하세요.'}));
 assert.equal(adviceFor({type:'status',text:''}),null);
 assert.equal(adviceFor({type:'status'}),null);
});
test('자유 질문은 낱말로 주제를 찾고, 못 찾으면 안내한다', ()=>{
 assert.match(answer('결측치는 0으로 채우면 안 돼요?'),/0과 빈칸/);
 assert.match(answer('IQR 이 뭐예요'),/울타리/);
 assert.match(answer('B코스에서 왜 달라요'),/못 본 길/);
 assert.match(answer('점심 메뉴'),/선생님/);
 assert.match(answer(''),/선생님/);
 for(const q of QUICK)assert.doesNotMatch(answer(q),/잘 몰라요/,q);
 assert.ok(FAQ.every(f=>f.k.every(k=>k===k.toLowerCase())),'키워드는 소문자');
});
