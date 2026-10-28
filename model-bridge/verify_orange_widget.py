"""orange_save_model.py를 실제 Orange 위젯(Tree → Python Script)으로 실행해 검증한다.

사용: QT_QPA_PLATFORM=offscreen python verify_orange_widget.py train.tab validation.tab
필요: Orange3 3.40.0 + PyQt, Node (predict.mjs로 예측 비교)
"""
import json, subprocess, sys, tempfile
from pathlib import Path
from AnyQt.QtWidgets import QApplication, QFileDialog
app = QApplication([])
from Orange.data import Table, Domain
from Orange.preprocess import Normalize, Continuize, Discretize
from Orange.regression import LinearRegressionLearner
from Orange.widgets.data.owpythonscript import OWPythonScript
from Orange.widgets.model.owtree import OWTreeLearner
from Orange.widgets.tests.base import WidgetTest

ROOT = Path(__file__).resolve().parent
SCRIPT = (ROOT / 'orange_save_model.py').read_text(encoding='utf-8')
FEATURES = ['ego_speed_kmh', 'gap_m', 'lead_speed_kmh', 'road']
train, valid = Table(sys.argv[1]), Table(sys.argv[2])
OUT = Path(tempfile.mkdtemp())


class T(WidgetTest):
    def runTest(self):
        pass


t = T()
T.setUpClass()


def tree(data, pp=None, **settings):
    w = t.create_widget(OWTreeLearner)
    for k, v in settings.items():
        setattr(w, k, v)
    t.send_signal(w.Inputs.data, data, widget=w)
    if pp:
        t.send_signal(w.Inputs.preprocessor, pp, widget=w)
    w.apply()
    return t.get_output(w.Outputs.model, widget=w)


def run_script(model, path):
    QFileDialog.getSaveFileName = staticmethod(lambda *a, **k: (str(path), ''))
    w = t.create_widget(OWPythonScript)
    w.text.setPlainText(SCRIPT)
    if model is not None:
        w.insert_classifier(0, model)
    w.commit()
    return w.console.toPlainText().split('Running script:')[-1].strip().splitlines()[0]


ok = []
for name, pp, settings in [('default', None, {}), ('normalize', Normalize(), {}), ('continuize', Continuize(), {}),
                           ('discretize', Discretize(), {}), ('depth3', None, {'max_depth': 3}),
                           ('nobinary', None, {'binary_trees': False, 'limit_depth': False})]:
    m = tree(train, pp, **settings)
    path = OUT / f'{name}.json'
    msg = run_script(m, OUT / name)  # 확장자 없이 저장해도 .json이 붙는지 확인
    assert msg.startswith('저장 완료') and path.exists(), (name, msg)
    rows = list(train) + list(valid)
    cases = [{f: (str(r[f]) if f == 'road' else float(r[f])) for f in FEATURES} for r in rows]
    (OUT / f'{name}.cases.json').write_text(json.dumps({'cases': cases, 'expected': m(train).tolist() + m(valid).tolist()}))
    ok.append(name)

d = train.domain
wrong_target = train.transform(Domain([d['ego_speed_kmh'], d['lead_speed_kmh'], d['road'], d['actual_delta_kmh']], d['gap_m'], d.metas))
for label, model, expect in [('연결 없음', None, 'Classifier 입력에 연결'),
                             ('선형 회귀', LinearRegressionLearner()(train), 'Tree 위젯의 모델만'),
                             ('목표값 바뀜', tree(wrong_target), '목표값은 actual_delta_kmh')]:
    msg = run_script(model, OUT / 'rejected.json')
    assert msg.startswith('저장하지 못했습니다') and expect in msg, (label, msg)
    print('거부 확인:', label, '→', msg)

compare = """
import {validateModel,predict} from %s;import {readFileSync} from 'fs';
for(const n of %s){const m=validateModel(JSON.parse(readFileSync(%s+'/'+n+'.json')));
 const {cases,expected}=JSON.parse(readFileSync(%s+'/'+n+'.cases.json'));
 const diff=Math.max(...cases.map((c,i)=>Math.abs(predict(m,c)-expected[i])));
 if(diff>1e-6)throw Error(n+' diff '+diff);console.log('일치:',n,cases.length+'행, 최대 차이',diff);}
""" % (json.dumps((ROOT / 'predict.mjs').as_uri()), json.dumps(ok), json.dumps(str(OUT)), json.dumps(str(OUT)))
subprocess.run(['node', '--input-type=module', '-e', compare], check=True)
print('Python Script 위젯 저장 검증 통과')
