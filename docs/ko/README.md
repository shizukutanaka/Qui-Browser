# Qui 브라우저 개요 (한국어)

## 제품 비전

Qui 브라우저는 VR 환경에 최적화된 경량 웹 브라우저로, Chrome 확장을 지원하고
비디오 스트리밍을 최적화하며 Stripe 기반 구독 제어를 제공합니다.

## 핵심 기능

- **확장 호환 레이어**: `/api/extensions` API를 통해 Chrome 호환 확장을
  설치·업데이트·삭제할 수 있습니다.
- **미디어 파이프라인**: `utils/media-pipeline.js`가 Range 요청을 처리하여 VR
  환경에서 매끄러운 재생을 제공합니다.
- **구독 제어**: `server-lightweight.js`가 Stripe 구독 상태를 확인하여 프리미엄
  기능 접근을 제어합니다.

## 빠른 시작

1. 의존성 설치: `npm install`
2. `.env.example`을 `.env`로 복사하고 Stripe 키 등 환경변수를 설정합니다.
3. 경량 서버 실행: `npm start`
4. VR 헤드셋 또는 에뮬레이터에서 브라우저 UI에 접속합니다.

## 디렉터리 안내

- `server-lightweight.js`: HTTP 서버 및 라우팅 로직
- `utils/stripe-service.js`: Stripe Checkout 및 Webhook 처리
- `extensions/manager.js`: 설치된 확장 정보 영구 저장
- `docs/`: 다국어 문서 모음

## 지원 및 피드백

문제나 개선 제안은 프로젝트 트래커에 등록하고, VR 중심 로드맵과 일치하도록
우선순위를 조정해 주세요.
