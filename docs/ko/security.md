# 보안 기준 (한국어)

## 위협 모델

- **서버 노출면**: `server-lightweight.js` 는 REST API와 정적 파일을 제공합니다.
- **정적 데이터**: 확장 메타데이터(`data/extensions.json`), 브라우징 세션, 구독
  원장(`data/subscriptions.json`).
- **전송 데이터**: VR 클라이언트 트래픽과 Stripe Webhook 콜백.

## 하드닝 체크리스트

- **TLS 종단**: HTTPS 리버스 프록시 또는 로드밸런서 뒤에서 운영하십시오.
- **호스트 검증**: `.env` 의 `ALLOWED_HOSTS` 를 설정하고, `validateHostHeader()`
  로 허용되지 않은 호스트를 차단하십시오.
- **엄격한 CORS**: `parseAllowedOrigins()` 로 허용 오리진을 화이트리스트
  방식으로 관리하십시오.
- **레이트 리밋**: `checkRateLimit()` 의 슬라이딩 윈도로 남용을 제한하십시오.
- **정적 파일 보호**: `serveStaticFile()` 가 경로를 정규화하고 심볼릭 링크를
  검증합니다.
- **압축 정책**: `utils/compression.js` 는 특정 MIME 타입만 압축하여 BREACH
  위험을 줄입니다.

## Stripe 키 관리

- `STRIPE_SECRET_KEY` 와 `STRIPE_WEBHOOK_SECRET` 를 비밀 관리 서비스에
  보관하십시오.
- 정기적으로 키를 로테이션하고 CI/CD 변수도 갱신하십시오.
- Webhook 은 HTTPS 로만 받아들이고 서명 검증 실패를 모니터링하십시오.

## 사고 대응 절차

1. 침해 의심 시 트래픽을 차단하거나 키를 무효화하십시오.
2. `logs/` 의 서버 로그와 Stripe 대시보드 이벤트를 분석하십시오.
3. 필요 시 `backups/` 에서 복구하고 `npm test` 로 이상 유무를 확인하십시오.
4. 패치 후 재배포하고 이해관계자에게 보고하며 사후 분석을 기록하십시오.

## 컴플라이언스 지침

- VR 브라우징 기록 및 구독 데이터의 보존 기간을 명시하십시오.
- GDPR/CCPA 등 개인정보 보호 법령에 따른 동의 로그를 유지하십시오.
- 모든 통합 시 `npm run security:scan` 을 실행하고 결과를 보관하십시오.
