# Orange → 브라우저 모델 연결 실험

2026-10-26 · G0 중 모델 연결 가능성 검증

2026-10-27 명확화: 이 실험의 트리 설정 5/2/4는 임시 연결 시험값이며 수업용으로 선정되지 않았다. 합성 자료에는 실제 주행상 불가능한 조합이 포함되어 있다. 학생 전처리·실제 자료 기반 모델 선정은 [별도 필수 계획](../docs/data-review-and-model-selection.md)에 따른다. 현재 입력 거부 기능은 CSV 자동 정제 기능이 아니다.

## 결과

Orange 3.40.0의 기본 회귀 Tree를 실제 학습해 JSON으로 변환했다. 같은 JSON을 Node 및 Codex 내장 브라우저의 JavaScript에서 실행하여 Orange 원본 예측과 비교했다.

| 항목 | 결과 |
| --- | --- |
| 합성 학습 데이터 | 120행 |
| 전체 비교 입력 | 1,214개 |
| 구성 | 학습 입력 120 + 무작위 새 입력 1,000 + 분기 경계 94 |
| 최대 절대 예측 차이 | 0km/h |
| 허용 오차 | 0.000001km/h |
| 잘못된 입력 거부 | 미지원 노면, NaN, 음수 속도, 문자열 속도 4건 |
| 잘못된 규격 거부 | 단위 변경 모델 거부 |
| 실제 브라우저 | 동일 1,214개 통과, 결과 화면 저장 |

경계 시험은 각 수치 분기의 임계값, 바로 이전·이후의 표현 가능한 실수를 사용한다. 0 바로 아래 음수는 프로그램 입력 범위 밖이므로 일치 시험에서 제외하고 입력 거부로 처리한다. 양쪽 노면을 포함한다.

**이 결과는 모델을 옮겨도 예측이 보존되는지에 대한 증거다.** 합성 데이터의 목표값은 연결 시험용으로 만든 숫자이며, 학생 운전 기록·실제 1초 속도 변화·안전 운전 정책이 아니다. 이 자료를 수업 기본 운전 데이터로 제공하지 않는다.

## 만들어진 파일

- `export_tree.py`: 지원 범위를 검사하고 Orange 모델 객체를 JSON으로 변환.
- `predict.mjs`: 모델 규격 검사 및 네 가지 입력으로 예측. 브라우저와 Node가 같은 코드를 사용.
- `run_experiment.py`: 재현 가능한 데이터 생성, Orange 학습, 변환, 원본 예측, Node 비교.
- `verify.mjs`: 예측 비교와 잘못된 입력/규격 검사.
- `check.html`: 실제 브라우저에서 예측을 다시 계산하는 진단 화면.
- `results/model.json`: 변환한 시험 모델.
- `results/cases.json`: 비교 입력과 Orange 원본 예측값.
- `results/report.json`: Node 검증 결과.
- `results/browser-proof.png`: 실제 브라우저 검증 화면.
- `results/synthetic-training.tab`: 타입·목표 역할을 포함한 Orange용 합성 데이터.
- `results/synthetic-training.csv`: 동일 자료의 일반 CSV. Orange에서 열 타입·역할 지정 필요.
- `requirements-tested.txt`: 이번 macOS Python 3.12 환경의 설치 버전 기록. 다른 운영체제에 그대로 강제하는 공용 잠금 파일은 아님.

## 지원 범위

지원: native Orange 회귀 Tree, 수치 분기의 `<= / >`, dry/wet 범주 분기, 유한한 예측값. 빈 자식 분기에서는 Orange와 같이 현재 노드 값을 반환하는 코드를 포함하지만 이번 데이터로 그 경로의 일치를 별도 검증하지는 않았다.

입력 순서는 `ego_speed_kmh, gap_m, lead_speed_kmh, road`, 목표 이름은 `actual_delta_kmh`다. 노면 범주 순서는 모델에 기록한 매핑을 사용한다. 입력 수치에는 음수·누락·문자열·NaN·무한대를 허용하지 않는다.

미지원: 분류 트리, 다른 모델 종류, 사용자 전처리로 계산된 속성, MappedDiscreteNode 등 다른 노드 종류. 변환기는 해당 모델을 거부한다. 학습은 Orange Python 라이브러리로 실행했으며 Orange 데스크톱 GUI 설치·워크플로 저장·Save Model 파일 전달을 검증한 것은 아니다. 외부 pickle 파일은 이 도구에서 읽지 않는다.

## 이 컴퓨터에서 다시 실행

프로젝트 폴더 `~/AI-EDU`에서:

```sh
.venv-orange/bin/python model-bridge/run_experiment.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory model-bridge
```

그다음 브라우저에서 `http://127.0.0.1:8765/check.html`을 연다. 이미 서버가 실행 중이면 두 번째 명령은 생략한다. 페이지의 passed와 max_absolute_error_kmh를 확인한다. 서버 종료는 실행한 터미널에서 Ctrl+C.

새 개발 환경에서는 Python 3.12 가상환경에 `Orange3==3.40.0`을 설치하고 Node를 준비한 뒤 같은 스크립트를 실행한다. Windows에서는 가상환경 실행 경로가 `Scripts/python.exe` 형태다. Windows 실제 실행은 아직 검증하지 않았다.

## 수업에서 model.json 만들기 (Orange 화면)

Orange의 Save Model은 브라우저가 읽을 수 없는 `.pkcls`(pickle)로 저장하므로, Python Script 위젯으로 직접 JSON을 저장한다.

가장 빠른 방법: `AI-EDU/open-orange-workflow.command`를 더블클릭하면 File → Tree → Python Script가 연결되고 저장 스크립트가 미리 들어간 `orange-workflow/model-save.ows`가 열린다. 열리자마자(또 Tree를 다시 학습할 때마다) Orange 안의 저장 창이 뜨니 위치만 고르면 된다. 다른 데이터를 쓰려면 File 위젯에서 학생이 저장한 .tab을 고른다.

직접 만들 때:

1. **File** 위젯에서 시뮬레이터가 저장한 `train.tab`을 연다. 열 역할(입력 4개, 목표 `actual_delta_kmh`, 메타 3개)은 파일에 들어 있으니 바꾸지 않는다.
2. **File → Tree** 로 연결한다. 설정은 수업 계획에 따른다.
3. **Python Script** 위젯을 놓고 Tree의 Model 출력을 Python Script의 Classifier 입력에 연결한다.
4. Python Script 편집창에 `orange_save_model.py` 내용을 붙여 넣고 **Run** 을 누른다. 저장 창에서 위치를 고르면 `model.json`이 생긴다.
5. 3차시 시뮬레이터의 주행 설정 → "변환된 모델 JSON"에서 그 파일을 고른다.

잘못 연결하면(연결 없음, Tree가 아닌 모델, 목표값이 다름, 입력 열이 다름) 저장하지 않고 콘솔에 이유를 한국어로 보여 준다. 2MB를 넘는 모델도 거부한다.

검증 (2026-10-27, Orange 3.40.0 + PyQt6, Linux offscreen): 실제 Tree 위젯과 Python Script 위젯을 띄워 `verify_orange_widget.py`로 확인했다. 기본, Preprocess(Normalize/Continuize/Discretize) 연결, 최대 깊이 3, 이진 분기 끔의 6가지 모두 학습·검증 77행에서 Orange 예측과 `predict.mjs` 예측의 차이가 0이었고, 잘못된 연결 3가지는 거부되었다. 자료와 출력은 `results/gui-check/`에 있다. macOS의 실제 Orange 3.40.0 앱에서도 워크플로를 열어 저장까지 확인했다 (`results/gui-check/model-from-orange-workflow.json`, validateModel 통과). 저장 창은 Orange 내장 창(DontUseNativeDialog)이라 운영체제와 관계없이 같은 모양이지만, 학교 Windows Orange에서는 아직 직접 확인하지 않았다.

```
QT_QPA_PLATFORM=offscreen python verify_orange_widget.py results/gui-check/train.tab results/gui-check/validation.tab
```

## 다음 작업

1. ~~학교 Orange GUI에서 학습한 모델을 보조 내보내기 도구로 전달하는 절차~~ → 2026-10-27 완료: 위 "수업에서 model.json 만들기" 참고.
2. 운전 계산 코어를 만들고 가감속·속도 상한·1초 기록을 검증한다.
3. 두 차량의 최소 화면에서 직접 운전 → CSV → 학습 모델 → 자동 주행을 연결한다.
4. 대표 Windows 노트북의 실행·배포·성능을 확인한다.

## 구현 근거

Orange 공식 소스의 수치/범주 분기와 값 반환 방식을 확인하고, 실제 설치한 Orange 예측과 비교했다.
- https://github.com/biolab/orange3/blob/master/Orange/tree.py
- https://github.com/biolab/orange3/blob/master/Orange/regression/tree.py
