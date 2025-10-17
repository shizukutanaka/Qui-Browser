# Guida alle Operazioni di Qui Browser (Italiano)

## Destinatari

Team operativi e SRE incaricati di distribuire e mantenere Qui Browser in
ambienti VR di produzione.

## 1. Checklist prima del rilascio

- **Immagine container**: `docker build -t <registry>/qui-browser:<tag> .` e
  successivamente `npm run security:scan` per individuare vulnerabilità.
- **File `.env`**: Copiare `.env.example`, rimuovere valori segnaposto
  (`your_*`, `changeme`) e conservare le chiavi in un vault.
- **Certificati TLS**: Preparare certificati per ingress o reverse proxy; vedere
  le annotazioni in `k8s/ingress.yaml`.
- **Configurazione billing**: Convalidare le chiavi Stripe e gli URL con
  `node ./cli.js billing:diagnostics`.
- **Asset statici**: Eseguire `npm run format:check` per mantenere
  l'allineamento con i file precompressi.

## 2. Comportamento in esercizio

- **Entry point**: `server-lightweight.js` tramite `npm start` oppure
  `node ./cli.js start --port 8000`.
- **Porte di default**: HTTP `8000`, WebSocket (`server-websocket.js`) `8080` se
  abilitato.
- **Scalabilità**: Servizio HTTP stateless; lo stato delle sessioni è nei file
  JSON sotto `data/`. In cluster usare storage condiviso o PVC.

## 3. Variabili d'ambiente principali

| Variabile                       | Funzione                             | Raccomandazione                                                                              |
| ------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `PORT`                          | Porta di ascolto                     | Allineare con `k8s/service.yaml`.                                                            |
| `HOST`                          | Indirizzo di bind                    | `0.0.0.0` nei container.                                                                     |
| `ALLOWED_HOSTS`                 | Whitelist header Host                | Limitare ai domini dell'ingress; supporta wildcard (`.example.com`).                         |
| `TRUST_PROXY`                   | Fiducia negli header `X-Forwarded-*` | Impostare `true` dietro proxy.                                                               |
| `STATIC_ROOT`                   | Directory base asset statici         | Predefinito `.`; montare CDN se necessario.                                                  |
| `LIGHTWEIGHT`                   | Modalità leggera                     | `true` su hardware con risorse limitate.                                                     |
| `BILLING_ADMIN_TOKEN`           | Token API amministrativa             | Minimo 16 caratteri, ruotare trimestralmente.                                                |
| `STRIPE_*`                      | Credenziali Stripe                   | Custodire in gestore segreti; mai nel repository.                                            |
| `DEFAULT_BILLING_LOCALE`        | Locale di fallback prezzi            | Coerente con `config/pricing.js`.                                                            |
| `LOG_LEVEL`                     | Futuro livello di log                | Pianificare integrazione con logging centralizzato.                                          |
| `HEALTH_*`                      | Soglie health monitor                | Tarare in base all'hardware.                                                                 |
| `NOTIFICATION_ENABLED`          | Abilita notifiche via webhook        | Verificare prima in staging.                                                                 |
| `NOTIFICATION_WEBHOOKS`         | URL webhook separati da virgola      | Con `NOTIFICATION_ENABLED=true` devono essere URL HTTPS assolute; vuoto = invio disattivato. |
| `NOTIFICATION_MIN_LEVEL`        | Severità minima inviata              | Predefinito `warning`; alzare a `error` per ridurre il rumore.                               |
| `NOTIFICATION_TIMEOUT_MS`       | Timeout richieste webhook            | Intero ≥ 100; aumentare per endpoint lenti mantenendo sotto il timeout complessivo.          |
| `NOTIFICATION_BATCH_WINDOW_MS`  | Finestra di batching (ms)            | Intero ≥ 0; valori >0 raggruppano eventi per ridurre notifiche.                              |
| `NOTIFICATION_RETRY_LIMIT`      | Tentativi automatici di retry        | Intero 0-10; predefinito `3`, `0` disattiva i retry.                                         |
| `NOTIFICATION_RETRY_BACKOFF_MS` | Backoff iniziale (ms)                | Intero ≥ 0 con backoff esponenziale e jitter.                                                |

> Nota: eseguire in CI `node ./cli.js billing:diagnostics` e
> `node scripts/check-vulnerabilities.js` prima delle release.

## 4. Flussi di deployment

### Docker Compose

```bash
cp .env.example .env
# Configurare le variabili
npm install
npm run build
# Avvio del server leggero
npm start
```

### Kubernetes

1. Pubblicare l'immagine container nel proprio registro.
2. Aggiornare tag e richieste risorse in `k8s/deployment.yaml`.
3. Applicare i manifest: `kubectl apply -f k8s/`.
4. Monitorare: `kubectl rollout status deployment/qui-browser`.
5. Verificare servizio: `kubectl get svc qui-browser`.

### Aggiornamenti progressivi

- Aggiornare immagine:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Osservare salute: `kubectl get pods`, `kubectl logs -l app=qui-browser`.
- Rollback se necessario: `kubectl rollout undo deployment/qui-browser`.

## 5. Osservabilità

- **Endpoint salute**: `GET /health` restituisce stato, uptime, risorse e
  contatori rate limiting (`server-lightweight.js`).
- **Endpoint metriche**: `GET /metrics` fornisce dati aggregati, integrabile con
  `ServiceMonitor` Prometheus (`k8s/servicemonitor.yaml`).
- **Log**: Salvati in `logs/`. Usare driver esterni o script di backup per la
  rotazione.
- **Dashboard**: `GET /dashboard` genera vista HTML tramite
  `utils/performance-dashboard.js`.

## 6. Manutenzione

- **Backup**: script in `scripts/` (`list-backups`, `verify-backup`,
  `prune-backups`).
- **Test di ripristino**: `node scripts/restore-backup.js --id <timestamp>` in
  staging.
- **Sicurezza**: `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js` ogni release.
- **Performance**: `node scripts/benchmark.js --full` per baseline.

## 7. Gestione incidenti

1. Rilevare anomalie (status `/health` diverso da `healthy`).
2. Isolare pod problematici (`kubectl cordon`, ridurre repliche).
3. Raccogliere log ed eventi (`kubectl describe pod`).
4. Ripristinare da `backups/` in caso di corruzione.
5. Comunicare l'esito e registrare azioni in `docs/improvement-backlog.md`.

## 8. Hardening

- Forzare HTTPS e abilitare HSTS tramite configurazione `security`.
- Limitare origini con `CORS_ALLOWED_ORIGINS`.
- Configurare `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW` come interi ≥ 1.
- Impostare alert Prometheus (CPU > 70%, memoria > 80%, picchi rate limiting).
- Pipeline CI: eseguire `npm run build` e suite test.

## 9. Troubleshooting

| Sintomo              | Analisi                              | Mitigazione                             |
| -------------------- | ------------------------------------ | --------------------------------------- |
| 400 Host negato      | Controllare `ALLOWED_HOSTS`          | Aggiungere dominio/wildcard.            |
| 503 Salute degradata | Analizzare risposta `/health`        | Scalar risorse o tarare `HEALTH_*`.     |
| Stripe errore        | `cli.js billing:diagnostics`         | Correggere credenziali e ridistribuire. |
| Asset mancanti       | Log `serveStaticFile`, `STATIC_ROOT` | Sincronizzare asset o volumi.           |
| Rate limiting alto   | Contatori `/metrics`                 | Aumentare `RATE_LIMIT_MAX` o usare CDN. |

## 10. Change management

- Documentare ogni modifica con ID da `docs/improvement-backlog.md`.
- Preferire deployment blue/green o canary (`maxUnavailable=0`, `maxSurge=1`).
- Archiviare snapshot metriche e allegarle alle release note.

Aggiornare questa guida in parallelo ai cambi di configurazione e infrastruttura
per mantenere allineati i team.
