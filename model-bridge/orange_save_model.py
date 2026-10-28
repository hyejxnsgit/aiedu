# AI EDU 시뮬레이터용 모델 저장 (Orange Python Script 위젯에 붙여 넣기)
#
# 연결: File(train.tab) → Tree → Python Script
#   Tree의 Model 출력을 Python Script의 Classifier 입력에 연결한 뒤 Run을 누른다.
#   저장 창에서 위치를 고르면 3차시에 불러올 model.json이 만들어진다.
# 지원: Orange 기본 Tree 위젯의 회귀 트리, 입력 4개(속도·거리·앞차 속도·노면), 목표 actual_delta_kmh.
# 모델 파일(.pkcls)을 직접 읽지 않으므로 pickle을 열지 않는다.
import json
import math
from pathlib import Path

import Orange
from Orange.tree import TreeModel, Node, NumericNode, DiscreteNode

FEATURES = ['ego_speed_kmh', 'gap_m', 'lead_speed_kmh', 'road']


def export_tree(model):
    if model is None:
        raise ValueError('Tree 위젯의 Model 출력을 이 위젯의 Classifier 입력에 연결하세요.')
    if type(model) is not TreeModel:
        raise ValueError('Orange 기본 Tree 위젯의 모델만 저장할 수 있습니다. 지금 연결된 모델: ' + type(model).__name__)
    if not model.domain.class_var or not model.domain.class_var.is_continuous:
        raise ValueError('목표값이 숫자인 회귀 트리여야 합니다. File에서 시뮬레이터가 저장한 .tab 파일을 여세요.')
    if model.domain.class_var.name != 'actual_delta_kmh':
        raise ValueError('목표값은 actual_delta_kmh여야 합니다. 지금 목표값: ' + model.domain.class_var.name)
    attrs = model.domain.attributes
    if [a.name for a in attrs] != FEATURES:
        raise ValueError('입력은 ' + ', '.join(FEATURES) + ' 네 개여야 합니다. 지금 입력: '
                         + ', '.join(a.name for a in attrs) + ' (File 위젯의 열 역할을 바꾸지 마세요.)')
    if any(a.compute_value is not None for a in attrs):
        raise ValueError('Preprocess 등으로 바뀐 입력은 지원하지 않습니다. File → Tree로 바로 연결하세요.')
    if not all(a.is_continuous for a in attrs[:3]):
        raise ValueError('속도·거리·앞차 속도는 숫자 열이어야 합니다.')
    if not attrs[3].is_discrete or set(attrs[3].values) != {'dry', 'wet'}:
        raise ValueError('road는 dry, wet 두 범주여야 합니다.')

    def encode(n):
        if n is None:
            return None
        val = float(n.value[0])
        if not math.isfinite(val):
            raise ValueError('예측값에 숫자가 아닌 값이 있습니다.')
        out = {'value': val}
        if type(n) is Node:
            out['kind'] = 'leaf'
        elif type(n) is NumericNode:
            if not math.isfinite(n.threshold):
                raise ValueError('분기 기준값에 숫자가 아닌 값이 있습니다.')
            out.update(kind='numeric', feature=attrs[n.attr_idx].name,
                       threshold=float(n.threshold), children=[encode(c) for c in n.children])
        elif type(n) is DiscreteNode:
            out.update(kind='categorical', feature=attrs[n.attr_idx].name,
                       categories=list(n.attr.values), children=[encode(c) for c in n.children])
        else:
            raise ValueError('지원하지 않는 트리 분기 형식입니다: ' + type(n).__name__)
        return out

    return {'schema_version': 1, 'model_type': 'orange-native-regression-tree',
            'orange_version': Orange.__version__, 'features': FEATURES,
            'target': 'actual_delta_kmh', 'units': 'km/h',
            'missing_policy': 'reject', 'tree': encode(model.root)}


def choose_path():
    default = Path.home() / 'model.json'
    try:
        from AnyQt.QtWidgets import QApplication, QFileDialog
        if QApplication.instance() is not None:
            # Orange 안에 그리는 저장 창: macOS·Windows에서 같은 모양이고, 별도 시스템 창 뒤에 숨지 않는다.
            name, _ = QFileDialog.getSaveFileName(None, '3차시용 모델 저장', str(default), 'JSON (*.json)',
                                                  options=QFileDialog.Option.DontUseNativeDialog)
            return Path(name) if name else None
    except ImportError:
        pass
    return default


def write_model(portable, path, out=None):
    if path.suffix.lower() != '.json':
        path = path.with_suffix('.json')
    text = json.dumps(portable, ensure_ascii=False, indent=2)
    if len(text.encode('utf-8')) > 2_000_000:
        raise ValueError('모델이 2MB를 넘어 시뮬레이터가 읽지 못합니다. Tree의 최대 깊이를 줄여 다시 학습하세요.')
    path.write_text(text, encoding='utf-8')
    print('저장 완료:', path, file=out)
    print('3차시 시뮬레이터의 주행 설정 → "변환된 모델 JSON"에서 이 파일을 고르세요.', file=out)
    return path


def save_model(model):
    portable = export_tree(model)
    path = choose_path()
    if path is None:
        print('저장을 취소했습니다.')
        return None
    return write_model(portable, path)


# Orange 안에서는 저장 창을 띄워 두기만 하고 바로 돌아온다(open). 창이 닫힐 때까지 기다리는
# 방식(getSaveFileName)은 위젯이 신호를 처리하는 도중에 창을 띄우게 되어, macOS Orange 3.40에서
# 저장 창을 닫는 순간 Orange 전체가 꺼졌다.
SAVE_DIALOGS = globals().setdefault('SAVE_DIALOGS', [])


def ask_and_save(model):
    import sys
    from AnyQt.QtWidgets import QFileDialog
    out = sys.stdout  # 위젯 콘솔: 창이 닫힌 뒤의 안내도 여기에 쓴다
    portable = export_tree(model)
    for old in SAVE_DIALOGS:
        old.close()
    SAVE_DIALOGS.clear()
    dlg = QFileDialog(None, '3차시용 모델 저장', str(Path.home()), 'JSON (*.json)')
    dlg.setOption(QFileDialog.Option.DontUseNativeDialog, True)
    dlg.setAcceptMode(QFileDialog.AcceptMode.AcceptSave)
    dlg.selectFile('model.json')

    def chosen(name):
        try:
            write_model(portable, Path(name), out)
        except (OSError, ValueError) as err:
            print('저장하지 못했습니다:', err, file=out)

    dlg.fileSelected.connect(chosen)
    dlg.rejected.connect(lambda: print('저장을 취소했습니다. 다시 저장하려면 Run을 누르세요.', file=out))
    SAVE_DIALOGS.append(dlg)  # 창이 열려 있는 동안 지워지지 않게 붙잡아 둔다
    dlg.open()
    dlg.raise_()
    dlg.activateWindow()


def run(model):
    if model is None:
        print('Tree의 Model 출력을 이 위젯에 연결하세요.')
        return
    try:
        from AnyQt.QtWidgets import QApplication
        in_orange = QApplication.instance() is not None
    except ImportError:
        in_orange = False
    try:
        if in_orange:
            ask_and_save(model)
        else:
            save_model(model)
    except ValueError as err:
        print('저장하지 못했습니다:', err)


run(in_classifier)  # noqa: F821 (Python Script 위젯이 넣어 주는 변수)
