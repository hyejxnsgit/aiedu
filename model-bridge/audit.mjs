// Recompute each prediction, export readable evidence, and test a deliberate mismatch.
// Does not change the original model or reference data.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateModel,predict,FEATURES} from './predict.mjs';
const dir=fileURLToPath(new URL('./results/',import.meta.url));
const model=validateModel(JSON.parse(fs.readFileSync(dir+'model.json','utf8')));
const {cases,expected}=JSON.parse(fs.readFileSync(dir+'cases.json','utf8'));
function compare(reference) {
  if(cases.length!==reference.length || !cases.length)throw Error('Invalid reference count');
  return cases.map((row,i)=>{
    const actual=predict(model,row), error=Math.abs(actual-reference[i]);
    if(!Number.isFinite(error))throw Error('Non-finite prediction/reference');
    return {row,expected:reference[i],actual,error};
  });
}
const rows=compare(expected);
const mismatches=rows.filter(r=>r.error>1e-6).length;
if(mismatches)throw Error('Original parity failed');
const changed=[...expected];changed[0]+=1;
const negative=compare(changed).filter(r=>r.error>1e-6);
if(negative.length!==1 || negative[0].error!==1)throw Error('Deliberate mismatch was not detected');
fs.writeFileSync(dir+'comparison.csv',[
  [...FEATURES,'orange_expected_kmh','javascript_actual_kmh','absolute_error_kmh'].join(','),
  ...rows.map(r=>[...FEATURES.map(f=>r.row[f]),r.expected,r.actual,r.error].join(','))
].join('\n')+'\n');
const report={checked_at:new Date().toISOString(),cases:rows.length,original_mismatches:mismatches,
  maximum_error_kmh:Math.max(...rows.map(r=>r.error)),
  negative_control:{method:'Add 1 km/h to the first reference prediction IN MEMORY only',detected_mismatches:negative.length,detected_error_kmh:negative[0].error},
  sample_rows:rows.slice(0,6)};
fs.writeFileSync(dir+'audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
