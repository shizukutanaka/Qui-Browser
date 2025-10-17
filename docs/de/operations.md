# Qui Browser Betriebsleitfaden (Deutsch)

## Zielgruppe

Operations- und SRE-Teams, die Qui Browser in produktiven VR-Umgebungen
betreiben.

## 1. Checkliste vor dem Deployment

- **Container-Image**: Mit `docker build -t <registry>/qui-browser:<tag> .`
  bauen und `npm run security:scan` ausführen.
- **Umgebungsdatei**: `.env.example` kopieren, Platzhalter (`your_*`,
  `changeme`) entfernen und Geheimnisse sicher speichern.
- **TLS-Zertifikate**: Für Ingress oder Reverse-Proxy bereitstellen; Hinweise in
  `k8s/ingress.yaml` beachten.
- **Abrechnungskonfiguration**: Stripe-Keys und URLs mit
  `node ./cli.js billing:diagnostics` prüfen.
- **Statische Assets**: `npm run format:check` ausführen, um Precompress-Dateien
  abzugleichen.

## 2. Laufzeitverhalten

- **Einstiegspunkt**: `server-lightweight.js` via `npm start` oder
  `node ./cli.js start --port 8000`.
- **Standardports**: HTTP `8000`, WebSocket (`server-websocket.js`) `8080` bei
  Aktivierung.
- **Skalierung**: HTTP stateless; Sitzungsdaten liegen im Verzeichnis `data/`.
  In Cluster-Setups Shared Storage/Volumes einplanen.

## 3. Wichtige Umgebungsvariablen

| Variable                        | Zweck                                | Empfehlung                                                                                      |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `PORT`                          | Listening-Port                       | Entspricht `k8s/service.yaml`.                                                                  |
| `HOST`                          | Bind-Adresse                         | In Containern `0.0.0.0`.                                                                        |
| `ALLOWED_HOSTS`                 | Host-Header-Whitelist                | Auf Ingress-Domains beschränken; Wildcards (`.example.com`) möglich.                            |
| `TRUST_PROXY`                   | `X-Forwarded-*` akzeptieren          | Hinter Proxy `true`.                                                                            |
| `STATIC_ROOT`                   | Basis für statische Dateien          | Standard `.`; optional CDN mounten.                                                             |
| `LIGHTWEIGHT`                   | Leichtmodus                          | Auf leistungsschwacher Hardware `true`.                                                         |
| `BILLING_ADMIN_TOKEN`           | Admin-API-Token                      | Mind. 16 Zeichen, vierteljährlich rotieren.                                                     |
| `STRIPE_*`                      | Stripe-Zugangsdaten                  | Geheim verwalten, nicht committen.                                                              |
| `DEFAULT_BILLING_LOCALE`        | Fallback-Locale                      | Muss zu `config/pricing.js` passen.                                                             |
| `LOG_LEVEL`                     | Künftige Log-Tiefe                   | Integration mit zentralem Logging vorsehen.                                                     |
| `HEALTH_*`                      | Health-Monitor-Schwellen             | Hardwareabhängig anpassen.                                                                      |
| `NOTIFICATION_ENABLED`          | Aktiviert Webhook-Benachrichtigungen | Zuerst in Staging testen.                                                                       |
| `NOTIFICATION_WEBHOOKS`         | Webhook-URLs, komma-separiert        | Bei `NOTIFICATION_ENABLED=true` zwingend absolute HTTPS-URLs; leer = Versand deaktiviert.       |
| `NOTIFICATION_MIN_LEVEL`        | Minimale Schwere zum Versand         | Standard `warning`; auf `error` setzen, um Rauschen zu reduzieren.                              |
| `NOTIFICATION_TIMEOUT_MS`       | Timeout für Webhook-Requests         | Ganzzahl ≥ 100; für langsame Endpunkte erhöhen, aber unterhalb der Gesamtzeitbegrenzung halten. |
| `NOTIFICATION_BATCH_WINDOW_MS`  | Batch-Fenster (ms)                   | Ganzzahl ≥ 0; Werte >0 bündeln Ereignisse zur Reduktion von Lärm.                               |
| `NOTIFICATION_RETRY_LIMIT`      | Anzahl automatischer Retries         | Ganzzahl 0–10; Standard `3`, `0` deaktiviert Retries.                                           |
| `NOTIFICATION_RETRY_BACKOFF_MS` | Initiales Backoff (ms)               | Ganzzahl ≥ 0 mit exponentiellem Backoff und Jitter.                                             |

> Hinweis: In CI `node ./cli.js billing:diagnostics` und
> `node scripts/check-vulnerabilities.js` vor Releases ausführen.

## 4. Deployment-Workflows

### Docker Compose

```bash
cp .env.example .env
# Variablen anpassen
npm install
npm run build
# Server starten
npm start
```

### Kubernetes

1. Container-Image in Registry pushen.
2. `k8s/deployment.yaml` mit Tag/Resource-Werten aktualisieren.
3. `kubectl apply -f k8s/` ausführen.
4. Rollout prüfen: `kubectl rollout status deployment/qui-browser`.
5. Service prüfen: `kubectl get svc qui-browser`.

### Rolling Updates

- Image setzen:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Health prüfen: `kubectl get pods`, `kubectl logs -l app=qui-browser`.
- Bei Bedarf: `kubectl rollout undo deployment/qui-browser`.

## 5. Observability

- **Health-Endpoint**: `GET /health` liefert Status, Laufzeit,
  Ressourcenverbrauch, Rate-Limit-Zähler (`server-lightweight.js`).
- **Metrics-Endpoint**: `GET /metrics` liefert Aggregationen; via Prometheus
  `ServiceMonitor` (`k8s/servicemonitor.yaml`) abfragbar.
- **Logs**: Unter `logs/`. Externe Log-Treiber oder Backup-Skripte verwenden.
- **Dashboard**: `GET /dashboard` generiert HTML-Ansicht mittels
  `utils/performance-dashboard.js`.

## 6. Regelbetrieb

- **Backups** (Scripts im Ordner `scripts/`):
  - `node scripts/list-backups.js`
  - `node scripts/verify-backup.js --latest`
  - `node scripts/prune-backups.js --retain 30`
- **Restore testen**: `node scripts/restore-backup.js --id <timestamp>` in
  Staging.
- **Security-Checks**: `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js` je Release.
- **Performance-Basis**: `node scripts/benchmark.js --full` ausführen.

## 7. Incident-Management

1. Anomalien über `/health` oder Alerts erkennen.
2. Betroffene Pods isolieren (z.B. `kubectl cordon`, Skalierung anpassen).
3. Logs/Ereignisse sammeln (`kubectl describe pod`).
4. Bei Datenproblemen aus `backups/` wiederherstellen.
5. Stakeholder informieren, Follow-ups in `docs/improvement-backlog.md`
   notieren.

## 8. Härtung

- HTTPS erzwingen, HSTS über `security`-Konfiguration aktivieren.
- `CORS_ALLOWED_ORIGINS` setzen.
- `RATE_LIMIT_MAX` und `RATE_LIMIT_WINDOW` als Ganzzahlen ≥ 1 konfigurieren.
- Prometheus-Alarme (CPU > 70 %, RAM > 80 %, Rate-Limit-Spitzen) einrichten.
- CI-Pipeline zwingend `npm run build` + Tests ausführen lassen.

## 9. Troubleshooting

| Symptom            | Analyse                                          | Lösung                                       |
| ------------------ | ------------------------------------------------ | -------------------------------------------- |
| 400 Host Header    | `ALLOWED_HOSTS` prüfen                           | Host oder Wildcard ergänzen.                 |
| 503 Health degrad. | `/health` auswerten                              | Ressourcen erhöhen oder Schwellen anpassen.  |
| Stripe-Fehler      | `cli.js billing:diagnostics`                     | Credentials korrigieren, neu deployen.       |
| Fehlende Assets    | `STATIC_ROOT`, Logs von `serveStaticFile` prüfen | Assets deployen oder Pfade korrigieren.      |
| Rate-Limit hoch    | `/metrics` prüfen                                | `RATE_LIMIT_MAX` erhöhen oder CDN einsetzen. |

## 10. Change Management

- Änderungen mit Tracking-ID aus `docs/improvement-backlog.md` dokumentieren.
- Blue/Green- oder Canary-Deployments (`maxUnavailable=0`, `maxSurge=1`).
- Metrik-Snapshots sichern und Release Notes beilegen.

Aktualisieren Sie diesen Leitfaden parallel zu Konfigurations- oder
Infrastrukturänderungen, um einheitliche Betriebsprozesse sicherzustellen.
