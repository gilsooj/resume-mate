# 자소서 메이트

취업준비생이 자소서 작성에 쓰는 시간을 줄여주는 AI 앱입니다.

## 배포 URL
https://service-452984440177.us-west1.run.app/

## 주요 기능
- 직무·경험·강점 입력 → AI 자소서 초안 생성
- 생성한 자소서 저장·조회
- 로그인 후 내 자소서만 관리

## 사용 기술
AI Studio Builder · Firebase · Vercel · Gemini AI

## 만든 이유
취업 준비 중 자소서를 매번 새로 쓰는 게 비효율적이라,
AI로 맞춤 초안을 빠르게 만들고 싶었습니다.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
