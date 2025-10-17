# Руководство по эксплуатации Qui Browser (Русский)

## Целевая аудитория

Команды эксплуатации и SRE, отвечающие за развертывание и поддержку Qui Browser
в производственных VR-средах.

## 1. Контрольный список перед релизом

- **Контейнерный образ**: Выполнить
  `docker build -t <registry>/qui-browser:<tag> .` и запустить
  `npm run security:scan`.
- **Файл окружения**: Скопировать `.env.example`, удалить заглушки (`your_*`,
  `changeme`) и хранить секреты в менеджере.
- **TLS-сертификаты**: Подготовить сертификаты для ingress или обратного прокси
  согласно `k8s/ingress.yaml`.
- **Настройки биллинга**: Проверить ключи и URL Stripe через
  `node ./cli.js billing:diagnostics`.
- **Статические ресурсы**: Выполнить `npm run format:check` для синхронизации с
  предсжатым контентом.

## 2. Ожидаемое поведение

- **Точка входа**: `server-lightweight.js` через `npm start` или
  `node ./cli.js start --port 8000`.
- **Порты**: HTTP `8000`, WebSocket (`server-websocket.js`) `8080` при
  активации.
- **Модель**: HTTP stateless; состояние сессий хранится в JSON-файлах `data/`. В
  кластере требуется общий storage или PVC.

## 3. Ключевые переменные окружения

| Переменная               | Назначение                | Рекомендация                                                |
| ------------------------ | ------------------------- | ----------------------------------------------------------- |
| `PORT`                   | Прослушиваемый порт       | Согласовать с `k8s/service.yaml`.                           |
| `HOST`                   | Адрес привязки            | `0.0.0.0` внутри контейнеров.                               |
| `ALLOWED_HOSTS`          | Белый список Host         | Ограничить хостами ingress, поддерживается `*.example.com`. |
| `TRUST_PROXY`            | Доверие `X-Forwarded-*`   | `true`, если есть прокси.                                   |
| `STATIC_ROOT`            | Корень статических файлов | По умолчанию `.`; можно монтировать CDN.                    |
| `LIGHTWEIGHT`            | Легкий режим              | `true` на слабом железе.                                    |
| `BILLING_ADMIN_TOKEN`    | Админ-токен               | ≥16 символов, ротация каждые 3 месяца.                      |
| `STRIPE_*`               | Ключи Stripe              | Хранить в хранилище секретов.                               |
| `DEFAULT_BILLING_LOCALE` | Локаль по умолчанию       | Должна совпадать с локалями `config/pricing.js`.            |
| `LOG_LEVEL`              | Гранулярность логов       | Планировать интеграцию с централизованным логированием.     |
| `HEALTH_*`               | Пороги health monitor     | Подбирать под оборудование.                                 |

> Совет: в CI запускать `node ./cli.js billing:diagnostics` и
> `node scripts/check-vulnerabilities.js` перед релизом.

## 4. Сценарии развертывания

### Docker Compose

```bash
cp .env.example .env
# Настроить переменные
npm install
npm run build
# Запустить сервер
npm start
```

### Kubernetes

1. Загрузить образ в registry.
2. Обновить теги и ресурсы в `k8s/deployment.yaml`.
3. `kubectl apply -f k8s/`.
4. Мониторинг: `kubectl rollout status deployment/qui-browser`.
5. Проверка сервиса: `kubectl get svc qui-browser`.

### Rolling update

- Обновить образ:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Следить за состоянием: `kubectl get pods`, `kubectl logs -l app=qui-browser`.
- Откат: `kubectl rollout undo deployment/qui-browser`.

## 5. Наблюдаемость

- **Health**: `GET /health` возвращает статус, аптайм, ресурсы и счетчики rate
  limiting (`server-lightweight.js`).
- **Metrics**: `GET /metrics` — агрегированные данные; используйте Prometheus
  `ServiceMonitor` (`k8s/servicemonitor.yaml`).
- **Логи**: В `logs/`; ротация через драйвер или скрипты бэкапа.
- **Панель**: `GET /dashboard` генерирует HTML-панель
  (`utils/performance-dashboard.js`).

## 6. Регулярное обслуживание

- **Бэкапы** (`scripts/`): `list-backups`, `verify-backup`, `prune-backups`.
- **Тесты восстановления**: `node scripts/restore-backup.js --id <timestamp>` в
  staging.
- **Безопасность**: `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js` для каждого релиза.
- **Производительность**: `node scripts/benchmark.js --full` фиксирует базовые
  показатели.

## 7. Реакция на инциденты

1. Выявить проблему (статус `/health` != `healthy`).
2. Изолировать pods (`kubectl cordon` или уменьшение реплик).
3. Собрать логи и события (`kubectl describe pod`).
4. Восстановиться из `backups/` при порче данных.
5. Сообщить заинтересованным сторонам и внести follow-up в
   `docs/improvement-backlog.md`.

## 8. Усиление безопасности

- Обязательный HTTPS и HSTS через настройки `security`.
- Ограничить CORS через `CORS_ALLOWED_ORIGINS`.
- Настроить `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`.
- Настроить алерты Prometheus (CPU > 70 %, память > 80 %, всплески rate
  limiting).
- В CI обязательно `npm run build` и все тесты.

## 9. Таблица устранения неполадок

| Симптом                   | Диагностика                    | Решение                                     |
| ------------------------- | ------------------------------ | ------------------------------------------- |
| 400 Host rejected         | Проверить `ALLOWED_HOSTS`      | Добавить домен/маску.                       |
| 503 degraded              | Анализировать `/health`        | Улучшить ресурсы или пороги `HEALTH_*`.     |
| Ошибки Stripe             | `cli.js billing:diagnostics`   | Исправить ключи и redeploy.                 |
| Нет статических файлов    | Проверить `STATIC_ROOT` и логи | Синхронизировать файлы или volume.          |
| Увеличенный rate limiting | Изучить `/metrics`             | Повысить `RATE_LIMIT_MAX` или добавить CDN. |

## 10. Управление изменениями

- Фиксировать изменения с ID из `docs/improvement-backlog.md`.
- Использовать стратегии blue/green или canary (`maxUnavailable=0`,
  `maxSurge=1`).
- Сохранять снимки метрик и прикладывать к релизным заметкам.

Актуализируйте руководство при изменениях конфигурации и инфраструктуры, чтобы
команды оставались синхронизированными.
