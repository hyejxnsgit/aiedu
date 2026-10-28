from pathlib import Path
import json, csv, itertools, subprocess, sys
import numpy as np
import Orange
from Orange.data import Domain, ContinuousVariable, DiscreteVariable, Table
from Orange.regression import TreeLearner
from export_tree import export_tree, FEATURES

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'results'
OUT.mkdir(exist_ok=True)
domain = Domain([ContinuousVariable(n) for n in FEATURES[:3]] +
                [DiscreteVariable('road', values=['dry', 'wet'])], ContinuousVariable('actual_delta_kmh'))
# Synthetic fixture ONLY: this is not recorded student driving or a safe driving policy.
X = np.array(list(itertools.product([0., 10., 30., 40., 50.], [5., 15., 30., 60.], [0., 20., 40.], [0., 1.])))
y = np.array([(-8 if gap < 20 else 3) + (2 if lead > ego else -1) - road*3 for ego,gap,lead,road in X], dtype=float)
data = Table.from_numpy(domain, X, y)
# Connection-fixture settings ONLY. Not selected by validation, not classroom defaults.
# Classroom parameters must follow docs/data-review-and-model-selection.md.
CONNECTION_TEST_PARAMS = dict(max_depth=5, min_samples_leaf=2, min_samples_split=4)
model = TreeLearner(**CONNECTION_TEST_PARAMS)(data)
portable = export_tree(model)
(OUT/'model.json').write_text(json.dumps(portable, ensure_ascii=False, indent=2))
data.save(str(OUT/'synthetic-training.tab'))
with (OUT/'synthetic-training.csv').open('w',newline='') as f:
    writer=csv.writer(f); writer.writerow(FEATURES+['actual_delta_kmh'])
    for x,target in zip(X,y): writer.writerow([*x[:3],['dry','wet'][int(x[3])],target])

rng = np.random.default_rng(20261026)
cases = [dict(zip(FEATURES,[*x[:3],['dry','wet'][int(x[3])]])) for x in X]
cases += [dict(zip(FEATURES,[float(rng.uniform(0,50)),float(rng.uniform(0,150)),float(rng.uniform(0,50)),road]))
          for road in ['dry','wet'] for _ in range(500)]
boundary_count=0
def boundaries(node, ancestors):
    global boundary_count
    if node['kind']=='leaf': return
    if node['kind']=='numeric':
        # Start with an actual training row reaching this node, preserving ancestor constraints.
        candidates=[]
        for row in cases[:len(X)]:
            if all((row[f] > t) == bool(k) if kind=='numeric' else row[f]==t for kind,f,t,k in ancestors):
                candidates.append(row)
        assert candidates, 'No reachable training witness'
        for value in [np.nextafter(node['threshold'],-np.inf),node['threshold'],np.nextafter(node['threshold'],np.inf)]:
            if value < 0: continue # Negative speeds/distances are rejected by the application contract.
            for road in ['dry','wet']:
                row=dict(candidates[0]); row[node['feature']]=float(value); row['road']=road
                cases.append(row); boundary_count+=1
        for k,child in enumerate(node['children']):
            if child: boundaries(child,ancestors+[('numeric',node['feature'],node['threshold'],k)])
    else:
        for k,child in enumerate(node['children']):
            if child: boundaries(child,ancestors+[('categorical',node['feature'],node['categories'][k],k)])
boundaries(portable['tree'],[])
matrix=np.array([[r[FEATURES[0]],r[FEATURES[1]],r[FEATURES[2]],['dry','wet'].index(r['road'])] for r in cases])
expected=model(Table.from_numpy(domain,matrix,np.full(len(matrix),np.nan))).tolist()
(OUT/'cases.json').write_text(json.dumps({'cases':cases,'expected':expected,'boundary_cases':boundary_count}))
subprocess.run(['node',str(ROOT/'verify.mjs')],check=True)
print('Orange',Orange.__version__,'trained and exported; results:',OUT)
