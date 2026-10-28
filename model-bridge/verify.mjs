import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateModel,predict} from './predict.mjs';
const root=fileURLToPath(new URL('./results/',import.meta.url));
const model=validateModel(JSON.parse(fs.readFileSync(root+'model.json','utf8')));
const fixture=JSON.parse(fs.readFileSync(root+'cases.json','utf8'));
const errors=fixture.cases.map((r,i)=>Math.abs(predict(model,r)-fixture.expected[i]));
const maxError=Math.max(...errors);
if(maxError>1e-6) throw new Error('Prediction parity failed: '+maxError);
let rejects=0;
for(const row of [ {...fixture.cases[0],road:'snow'}, {...fixture.cases[0],gap_m:NaN}, {...fixture.cases[0],ego_speed_kmh:-1}, {...fixture.cases[0],lead_speed_kmh:'30'} ]) {
  try { predict(model,row); } catch { rejects++; }
}
if(rejects!==4) throw new Error('Invalid inputs were accepted');
const malformed=structuredClone(model);malformed.units='m/s';
let schemaRejected=false;try {validateModel(malformed);}catch {schemaRejected=true;}
if(!schemaRejected)throw new Error('Bad schema accepted');
const report={status:'passed',runtime:'Node JavaScript; browser test recorded separately',orange_version:model.orange_version,cases:errors.length,boundary_cases:fixture.boundary_cases,max_absolute_error_kmh:maxError,tolerance_kmh:1e-6,invalid_inputs_rejected:rejects,schema_rejected:schemaRejected,fixture_notice:'Synthetic connection test only; not student data or safety evaluation'};
fs.writeFileSync(root+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
