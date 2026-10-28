"""빌드된 시뮬레이터(dist)만 제공한다. 작업 폴더 전체를 웹으로 열지 않는다.

Node 없이 실행할 수 있다(학교 노트북용). 코드를 고친 뒤에는 `npm run build`로 dist를 다시 만든다.
개발 중에는 `npm run dev`가 같은 주소에서 수정 사항을 바로 반영한다(이때 AI 도우미는 정해 둔 답으로 동작).

AI 학습 도우미의 자유 질문은 POST /api/helper 로 받아 Claude에 묻는다.
API 키는 이 서버의 환경 변수 ANTHROPIC_API_KEY에만 두고 브라우저로 보내지 않는다.
`pip install anthropic` 이 안 됐거나 키가 없으면 503을 돌려주고, 화면은 정해 둔 답으로 바꿔 답한다.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import sys

dist = Path(__file__).resolve().parent / 'dist'
if not (dist / 'index.html').exists():
    sys.exit('dist/index.html이 없습니다. simulator 폴더에서 npm install && npm run build 를 먼저 실행하세요.')

MODEL = 'claude-opus-5-5'
MAX_QUESTION = 300   # 학생 질문 한 개의 최대 글자 수
MAX_TURNS = 8        # 앞 대화는 최근 8개만 보낸다(비용·속도)
SYSTEM = """너는 중학생 대상 'AI-EDU 자율주행 수업' 시뮬레이터 안의 AI 학습 도우미다.
수업 흐름: 2차시에 학생이 직접 운전해 기록(3가지 운전 기준: 앞차 감속 시 1초 안에 감속, 거리 기준 이하면 브레이크, 앞차 출발 시 천천히 가속) → 기준대로 운전했는지 돌아보기 → 결측치·이상치 전처리, 학습·검증 비율 나누기 → Orange(File → Tree → 모델 저장 Python Script)로 결정 트리를 학습해 model.json 저장.
3차시: model.json을 불러와 자동 주행 전에 예상 → A 코스(2차시와 같은 길) 또는 B 코스(처음 보는 길) 자동 주행 → 결과와 예상 비교 → 문제 장면 분석 → 개선용 기록 주행 → 재학습(model-2.json) → 같은 조건(코스·노면·처음 거리)끼리 결과 비교 → 모둠 보고서.
답하는 방법:
- 한국어 존댓말로 2~4문장, 중학생이 알아듣는 쉬운 말로 짧게 답한다.
- 정답을 바로 주기보다 학생이 화면에서 확인할 곳이나 생각할 질문을 하나 건넨다.
- 보고서·서술 칸을 대신 써 주지 않는다. 대신 무엇을 근거로 쓰면 될지 알려 준다.
- 실제 도로 운전·차량 안전 기준에 대해서는 이 시뮬레이터가 수업용이며 실제 기준이 아니라고 말한다.
- 이름·학교·연락처 같은 개인 정보는 묻지도 기억하지도 않는다.
- 수업과 관계없는 요청은 정중히 수업 이야기로 돌린다."""

_client = None


def ask_claude(question, history, context):
    """학생 질문 하나에 답한다. 실패하면 예외를 그대로 올려 보낸다."""
    global _client
    import anthropic  # 설치돼 있을 때만 쓴다(없으면 ImportError → 503)
    if _client is None:
        _client = anthropic.Anthropic()  # ANTHROPIC_API_KEY를 환경 변수에서 읽는다
    messages = []
    for turn in history[-MAX_TURNS:]:
        role = 'assistant' if turn.get('who') == 'bot' else 'user'
        text = str(turn.get('text', ''))[:MAX_QUESTION * 2].strip()
        if not text:
            continue
        if messages and messages[-1]['role'] == role:
            messages[-1]['content'] += '\n' + text
        else:
            messages.append({'role': role, 'content': text})
    while messages and messages[0]['role'] != 'user':
        messages.pop(0)
    where = f"(지금 화면: {context})\n" if context else ''
    question = where + question
    if messages and messages[-1]['role'] == 'user':
        messages[-1]['content'] += '\n' + question
    else:
        messages.append({'role': 'user', 'content': question})
    response = _client.beta.messages.create(
        model=MODEL,
        max_tokens=2048,
        output_config={'effort': 'low'},
        betas=['server-side-fallback-2026-07-01'],
        fallbacks='default',
        system=SYSTEM,
        messages=messages,
    )
    if response.stop_reason == 'refusal':
        return '그 질문에는 답하기 어려워요. 수업 내용으로 다시 물어봐 줄래요?'
    text = ''.join(b.text for b in response.content if b.type == 'text').strip()
    return text or '음, 다시 한 번 물어봐 줄래요?'


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/helper':
            self.send_error(404)
            return
        try:
            size = int(self.headers.get('Content-Length') or 0)
            if size > 20000:
                return self._json(413, {'error': '질문이 너무 깁니다.'})
            body = json.loads(self.rfile.read(size) or b'{}')
            question = str(body.get('question', '')).strip()[:MAX_QUESTION]
            if not question:
                return self._json(400, {'error': '질문이 비어 있습니다.'})
            history = body.get('history') if isinstance(body.get('history'), list) else []
            context = str(body.get('context', ''))[:120]
        except (ValueError, TypeError):
            return self._json(400, {'error': '요청 형식이 잘못됐습니다.'})
        if not os.environ.get('ANTHROPIC_API_KEY'):
            return self._json(503, {'error': 'ANTHROPIC_API_KEY가 설정되지 않았습니다.'})
        try:
            return self._json(200, {'answer': ask_claude(question, history, context)})
        except ImportError:
            return self._json(503, {'error': 'anthropic 패키지가 없습니다. pip install anthropic'})
        except Exception as err:  # 네트워크·요금 한도 등: 화면은 정해 둔 답으로 바꾼다
            print('AI 도우미 오류:', type(err).__name__, err, file=sys.stderr, flush=True)
            return self._json(502, {'error': 'AI 응답을 받지 못했습니다.'})

    def _json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


handler = partial(Handler, directory=str(dist))
with ThreadingHTTPServer(('127.0.0.1', 8766), handler) as server:
    ai = '켜짐' if os.environ.get('ANTHROPIC_API_KEY') else '꺼짐(정해 둔 답으로 동작)'
    print(f'http://127.0.0.1:8766/  AI 도우미: {ai}  (Ctrl+C to stop)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
