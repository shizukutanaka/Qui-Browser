# Qui Browser 운영 가이드 (한국어)

## 대상 독자

생산 VR 환경에서 Qui Browser를 배포하고 유지하는 운영 및 SRE 팀을 위한
지침입니다.

## 1. 배포 전 체크리스트

- **컨테이너 이미지**: `docker build -t <registry>/qui-browser:<tag> .` 실행 후
  `npm run security:scan`으로 보안 점검.
- **환경 변수 파일**: `.env.example`을 복사하고 `your_*`, `changeme`와 같은
  플레이스홀더 제거, 비밀 키는 보안 저장소에 보관.
- **TLS 인증서**: Ingress 또는 리버스 프록시용 인증서 준비 (`k8s/ingress.yaml`
  주석 참고).
- **과금 설정**: `node ./cli.js billing:diagnostics`로 Stripe 키와 URL 유효성
  검사.
- **정적 자산**: `npm run format:check`으로 사전 압축 파일과 동기화 유지.

## 2. 런타임 기대치

- **프로세스 엔트리포인트**: `npm start` 또는 `node ./cli.js start --port 8000`
  실행 시 `server-lightweight.js` 구동.
- **기본 포트**: HTTP `8000`, WebSocket (`server-websocket.js`) 활성 시 `8080`
  사용.
- **스케일링 모델**: HTTP 서버는 무상태(stateless); 세션 상태는 `data/`의 JSON
  파일에 저장. 클러스터 환경에서는 공유 스토리지/볼륨 사용.

## 3. 주요 환경 변수

| 변수                            | 역할                      | 권장 사항                                                                        |
| ------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `PORT`                          | 서비스 포트               | `k8s/service.yaml`과 일치시킴.                                                   |
| `HOST`                          | 바인드 주소               | 컨테이너에서는 `0.0.0.0` 권장.                                                   |
| `ALLOWED_HOSTS`                 | Host 헤더 화이트리스트    | Ingress 도메인으로 제한, 와일드카드(`.example.com`) 지원.                        |
| `TRUST_PROXY`                   | `X-Forwarded-*` 신뢰 여부 | 프록시 뒤에서는 `true`.                                                          |
| `STATIC_ROOT`                   | 정적 파일 루트            | 기본값 `.`; 필요 시 CDN 마운트.                                                  |
| `LIGHTWEIGHT`                   | 경량 모드                 | 자원 제한 장비에서 `true`.                                                       |
| `BILLING_ADMIN_TOKEN`           | 과금 관리 토큰            | 최소 16자, 분기별 회전.                                                          |
| `STRIPE_*`                      | Stripe 자격 증명          | 비밀 관리 서비스에 저장.                                                         |
| `DEFAULT_BILLING_LOCALE`        | 기본 가격 로케일          | `config/pricing.js`의 로케일과 일치.                                             |
| `LOG_LEVEL`                     | 향후 로그 세분화          | 중앙 로그 시스템 연계 고려.                                                      |
| `HEALTH_*`                      | 헬스 모니터 임계치        | 하드웨어 기준으로 조정.                                                          |
| `NOTIFICATION_ENABLED`          | Webhook 알림 활성화       | 먼저 스테이징에서 검증.                                                          |
| `NOTIFICATION_WEBHOOKS`         | 콤마로 구분된 Webhook URL | `NOTIFICATION_ENABLED=true` 시 반드시 HTTPS 절대 URL; 비어 있으면 전송 비활성화. |
| `NOTIFICATION_MIN_LEVEL`        | 알림 최소 심각도          | 기본 `warning`; 노이즈 감소 시 `error` 권장.                                     |
| `NOTIFICATION_TIMEOUT_MS`       | Webhook 요청 타임아웃     | 정수 ≥ 100; 느린 엔드포인트에 맞춰 조정하되 전체 타임아웃 이내 유지.             |
| `NOTIFICATION_BATCH_WINDOW_MS`  | 배치 전송 윈도우 (ms)     | 정수 ≥ 0; 0 초과 시 이벤트를 묶어 알림을 줄임.                                   |
| `NOTIFICATION_RETRY_LIMIT`      | 자동 재시도 횟수          | 정수 0–10; 기본 `3`, `0`은 재시도 비활성화.                                      |
| `NOTIFICATION_RETRY_BACKOFF_MS` | 초기 백오프 (ms)          | 정수 ≥ 0, 지수 백오프와 지터 적용.                                               |

> 참고: CI 파이프라인에서 `node ./cli.js billing:diagnostics`와
> `node scripts/check-vulnerabilities.js`를 사전 실행하십시오.

## 4. 배포 워크플로

### Docker Compose

```bash
cp .env.example .env
# 환경 변수 조정
npm install
npm run build
# 경량 서버 시작
npm start
```

### Kubernetes

1. 컨테이너 이미지를 레지스트리에 푸시.
2. `k8s/deployment.yaml`에서 이미지 태그와 리소스 요청 업데이트.
3. `kubectl apply -f k8s/`로 매니페스트 적용.
4. `kubectl rollout status deployment/qui-browser`로 롤아웃 모니터링.
5. `kubectl get svc qui-browser`로 서비스 확인.

### 롤링 업데이트

- 이미지 변경:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- 상태 모니터링: `kubectl get pods`, `kubectl logs -l app=qui-browser`.
- 필요 시 롤백: `kubectl rollout undo deployment/qui-browser`.

## 5. 관측성

- **헬스 엔드포인트**: `GET /health`는 상태, 업타임, 자원 사용량, 레이트 리밋
  카운터를 반환 (`server-lightweight.js`).
- **메트릭 엔드포인트**: `GET /metrics`는 집계 메트릭을 제공하며 Prometheus
  `ServiceMonitor`(`k8s/servicemonitor.yaml`)로 수집.
- **로그**: `logs/` 디렉터리에 저장. 외부 로그 드라이버나 백업 스크립트로
  로테이션.
- **대시보드**: `GET /dashboard`가 `utils/performance-dashboard.js`를 통해 HTML
  대시보드 생성.

## 6. 정기 운영 작업

- **백업** (`scripts/`):
  - `node scripts/list-backups.js`
  - `node scripts/verify-backup.js --latest`
  - `node scripts/prune-backups.js --retain 30`
- **복구 리허설**: 스테이징에서
  `node scripts/restore-backup.js --id <timestamp>` 실행.
- **보안 스캔**: 매 릴리스마다 `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js` 수행.
- **성능 벤치마크**: `node scripts/benchmark.js --full`로 기준값 기록.

## 7. 인시던트 대응 절차

1. `/health` 상태 변화나 모니터링 경보로 이상 감지.
2. 문제 Pod 격리 (`kubectl cordon` 또는 레플리카 조정).
3. `logs/` 및 Kubernetes 이벤트(`kubectl describe pod`) 수집.
4. 데이터 손상 시 `backups/`에서 복구.
5. 관계자에게 공유하고 `docs/improvement-backlog.md`에 후속 조치 등록.

## 8. 보안 강화 체크리스트

- Ingress에서 HTTPS 강제, `security` 설정으로 HSTS 활성화.
- `CORS_ALLOWED_ORIGINS`로 허용 오리진 제한.
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`를 정수 ≥ 1로 설정.
- Prometheus 알람 (CPU > 70%, 메모리 > 80%, 레이트 리밋 급증) 구성.
- CI에서 `npm run build`와 전체 테스트 실행 보장.

## 9. 트러블슈팅 표

| 증상                 | 점검 항목                                  | 해결 방법                            |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| 400 Host 거부        | `ALLOWED_HOSTS` 확인                       | Ingress 도메인/와일드카드 추가.      |
| 503 헬스 저하        | `/health` 응답 분석                        | 자원 확장 또는 `HEALTH_*` 조정.      |
| Stripe 체크아웃 실패 | `cli.js billing:diagnostics` 실행          | 자격 증명 수정 후 재배포.            |
| 정적 파일 누락       | `STATIC_ROOT`, `serveStaticFile` 로그 확인 | 자산 동기화 또는 볼륨 확인.          |
| 레이트 리밋 과다     | `/metrics` 확인                            | `RATE_LIMIT_MAX` 증설 또는 CDN 도입. |

## 10. 변경 관리

- 모든 변경 사항은 `docs/improvement-backlog.md`의 추적 ID와 함께 기록.
- `maxUnavailable=0`, `maxSurge=1` 설정으로 블루/그린 또는 카나리아 배포 권장.
- 릴리스 후 메트릭 스냅샷을 저장하고 릴리스 노트에 첨부.

구성이나 인프라 변경 시 본 가이드를 함께 업데이트하여 운영 팀의 일관성을
유지하십시오.
