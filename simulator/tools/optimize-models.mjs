// Meshy에서 받은 원본 .glb를 수업용으로 줄이고 크기·방향을 맞춘다.
// 실행: node tools/optimize-models.mjs <원본 폴더> public/models
// 원본은 ~/AI-EDU/meshy-src/ 에 그대로 둔다(public 안에 두면 배포 파일에 30MB짜리가 같이 들어간다).
//  - 삼각형 수를 목표치로 줄임(meshoptimizer), 좌표 양자화 + meshopt 압축(three 기본 디코더로 읽힘, 외부 CDN 불필요)
//  - 실제 크기(m)로 맞추고, 앞쪽이 -z, 바닥이 y=0, 가로·세로 가운데가 원점이 되게 정리
//  - 텍스처가 있고 sharp가 설치돼 있으면 1024px(차는 2048px) WebP로 줄인다
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,simplify,dedup,prune,quantize,meshopt,getBounds,textureCompress,normals} from '@gltf-transform/functions';
import {MeshoptSimplifier,MeshoptEncoder} from 'meshoptimizer';
import {readdirSync,statSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

// size: 기준 축의 실제 길이(m), axis: 그 축(0=x,1=y,2=z), flip: Meshy 정면(+z)을 진행 방향(-z)으로 돌릴지, tri: 목표 삼각형 수
export const SPECS={
 'lead-car':{axis:2,size:4.6,flip:true,tri:25000,tex:2048},
 'ego-car':{axis:2,size:4.6,flip:true,tri:25000,tex:2048},
 'steering-wheel':{axis:0,size:.38,tri:8000},
 'brake-pedal':{axis:1,size:.24,tri:4000},
 'gas-pedal':{axis:1,size:.26,tri:4000},
 'burger-shop':{axis:0,size:11,tri:6000},
 'pork-bbq':{axis:0,size:11,tri:6000},
 'basalt-rocks':{axis:0,size:3,tri:500},
 'guardrail':{axis:0,size:4,tri:500},
 'street-lamp':{axis:1,size:8,tri:2000},
 'tree':{axis:1,size:6,tri:4000},
};

let sharp=null;try{sharp=(await import('sharp')).default;}catch{}
await MeshoptSimplifier.ready;await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});

const triCount=root=>root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);

async function optimize(src,out,spec){
 const doc=await io.read(src),root=doc.getRoot(),scene=root.listScenes()[0];
 const before=triCount(root);
 // 텍스처가 없으면 UV·법선을 버려야 이음매가 붙어 단순화가 목표치까지 내려간다(법선은 다시 계산).
 const untextured=!root.listTextures().length;
 if(untextured)for(const p of root.listMeshes().flatMap(m=>m.listPrimitives()))for(const a of ['TEXCOORD_0','NORMAL'])p.setAttribute(a,null);
 await doc.transform(dedup(),weld());
 if(before>spec.tri)await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:spec.tri/before,error:.02}));
 if(untextured)await doc.transform(normals({overwrite:true}));
 // 방향·크기·원점: 새 루트 노드 하나에 변환을 담는다(메시 정점은 건드리지 않음 → 텍스처 좌표 그대로)
 const pivot=doc.createNode('Root');for(const n of scene.listChildren()){scene.removeChild(n);pivot.addChild(n);}scene.addChild(pivot);
 if(spec.flip)pivot.setRotation([0,1,0,0]);
 const b0=getBounds(scene),s=spec.size/(b0.max[spec.axis]-b0.min[spec.axis]);pivot.setScale([s,s,s]);
 const b=getBounds(scene);pivot.setTranslation([-(b.min[0]+b.max[0])/2,-b.min[1],-(b.min[2]+b.max[2])/2]);
 if(sharp&&root.listTextures().length)await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[spec.tex??1024,spec.tex??1024]}));
 await doc.transform(prune(),quantize(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
 await io.write(out,doc);
 const fb=getBounds(scene);
 return {before:Math.round(before),after:Math.round(triCount(root)),size:fb.max.map((v,i)=>+(v-fb.min[i]).toFixed(2)),mb:+(statSync(out).size/1e6).toFixed(2),textures:root.listTextures().length};
}

const [srcDir,outDir]=process.argv.slice(2);mkdirSync(outDir,{recursive:true});
for(const f of readdirSync(srcDir).filter(f=>f.endsWith('.glb'))){
 const name=f.replace(/\.glb$/,''),spec=SPECS[name]??(name.startsWith('prop-')?{axis:1,size:1.5,tri:3000}:null);
 if(!spec){console.log('건너뜀(이름 규칙 밖):',f);continue;}
 console.log(name,await optimize(join(srcDir,f),join(outDir,f),spec));
}
if(!sharp)console.log('참고: sharp가 없어 텍스처 크기는 줄이지 않았어요 (npm i -D sharp).');
