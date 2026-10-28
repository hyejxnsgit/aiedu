#!/bin/bash
# Orange에서 "File → Tree → 모델 저장(Python Script)" 워크플로를 연다.
cd "$(dirname "$0")/model-bridge/orange-workflow" || exit 1
if [ -d "/Applications/Orange.app" ]; then
  open -a "/Applications/Orange.app" "$PWD/model-save.ows"
else
  echo "Orange 앱이 /Applications 에 없습니다. https://orangedatamining.com/download 에서 설치한 뒤 다시 실행하세요."
  read -n 1 -s -r -p "아무 키나 누르면 닫힙니다."
fi
