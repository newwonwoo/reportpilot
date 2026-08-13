# FrameBrief

YouTube 영상을 **시간축이 살아있는 읽기 좋은 글**로 바꾸는 최소 구현입니다.

## 핵심 원칙

- URL 입력과 검색어 입력을 하나의 검색창으로 통합
- 검색 시 자막이 있는 영상(`videoCaption=closedCaption`)을 우선 조회
- 한국어/영어 자막이 없으면 공개된 다른 언어 자막도 사용
- 자막의 시간값 보존
- AI는 일정 시간 간격이 아니라 **주제 전환점** 기준으로 대목 분리
- 각 대목에 원본 YouTube timestamp와 자막 근거 제공
- 진행상태는 가짜 퍼센트가 아니라 서버의 실제 단계가 끝날 때만 전환

## 흐름

```text
YouTube URL ──────────────┐
                         ├─ 영상 확인 → 공개 자막 → Gemini 구조 분석 → 원문 연결 → 기사
검색어 → YouTube Search ─┘
```

## 시작

Node.js 20.9 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`

```text
YOUTUBE_API_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
```

검증:

```bash
npm run typecheck
npm run build
```

## 의도적으로 넣지 않은 것

로그인, 결제, DB, 벡터 DB, 큐 시스템, 별도 상태관리 라이브러리, UI 프레임워크는 아직 넣지 않았습니다. 실제 사용 데이터 없이 넣으면 복잡성만 늘어날 가능성이 높기 때문입니다.

## 배포 메모

현재 자막 모듈은 YouTube 내부 transcript endpoint를 사용합니다. Vercel/AWS 같은 데이터센터 IP에서 YouTube가 요청을 막을 수 있으므로, 실제 배포 후 여러 영상으로 성공률을 먼저 측정합니다. 실패율이 의미 있게 높을 때만 별도 transcript provider나 proxy를 추가합니다.

## 다음 순서

1. 실제 영상 10~20개로 자막 성공률 확인
2. 대목 수와 제목 품질 튜닝
3. 모바일 검색/진행/기사 UX 점검
4. Vercel 배포 환경에서 자막 성공률 확인
5. 필요할 때만 저장/로그인 추가
