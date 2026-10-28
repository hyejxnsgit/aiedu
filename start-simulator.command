#!/bin/bash
# AI EDU 시뮬레이터 실행: 더블클릭하면 예전 서버를 끄고 새로 띄운 뒤 브라우저를 연다.
# 끄려면 이 터미널 창에서 Ctrl+C 를 누르거나 창을 닫으면 된다.
cd "$(dirname "$0")/simulator" || exit 1
OLD=$(lsof -ti tcp:8766)
if [ -n "$OLD" ]; then echo "예전 서버를 끕니다: $OLD"; kill -9 $OLD; sleep 0.5; fi
(sleep 1.5; open "http://127.0.0.1:8766/") &
python3 preview.py
