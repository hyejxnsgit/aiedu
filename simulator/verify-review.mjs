// Reproduce inspection artifacts; this is a labeled concept exercise, never student data.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {Review,practiceRows,COLUMNS} from './review.mjs';
const directory=new URL('./results/review/',import.meta.url);
await mkdir(directory,{recursive:true});
const b=new Review(practiceRows(),{practice:true});
b.assign('연습-A','train');b.assign('연습-B','validation');
assert.throws(()=>b.export());
for(const i of [1,2])b.decide(i,'exclude','원본의 실제 값을 복구할 근거가 없어 제외');
b.decide(20,'exclude','같은 주행·시각의 중복 저장');
b.decide(3,'keep','−8km/h는 마른 노면의 1초 제동 범위 내인 급감속 사례');
const result=b.export();
for(const [name,contents] of Object.entries({
 'practice-train.tab':result.trainTab,'practice-validation.tab':result.validationTab,
 'practice-train.csv':result.train,'practice-validation.csv':result.validation,
 'practice-preprocessing-audit.json':JSON.stringify(result.bundle,null,2),
 'practice-raw.csv':[COLUMNS.join(','),...b.raw.map(r=>COLUMNS.map(k=>r[k]).join(','))].join('\n'),
}))await writeFile(new URL(name,directory),contents);
assert.equal(Review.restore(result.bundle).export().train,result.train);
console.log(JSON.stringify({practice:true,blocked_before_review:true,counts:result.bundle.counts,restored_export_identical:true},null,2));
