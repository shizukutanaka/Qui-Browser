# Sicherheitsbasis (Deutsch)

## Bedrohungsmodell

- **Serveroberfläche**: `server-lightweight.js` stellt REST-APIs und statische
  Inhalte bereit.
- **Daten im Ruhezustand**: Erweiterungsmetadaten (`data/extensions.json`),
  Browsersitzungen und Abonnementverzeichnis (`data/subscriptions.json`).
- **Daten in Bewegung**: VR-Browseranfragen und Stripe-Webhook-Aufrufe.

## Härtungscheckliste

- **TLS-Terminierung**: Hinter HTTPS-Proxy oder Load-Balancer betreiben.
- **Hostvalidierung**: `ALLOWED_HOSTS` in `.env` setzen; `validateHostHeader()`
  blockiert nicht autorisierte Hosts.
- **Strenges CORS**: `parseAllowedOrigins()` begrenzt erlaubte Ursprünge.
- **Rate Limiting**: `checkRateLimit()` nutzt ein Sliding-Window gegen
  Missbrauch.
- **Sichere Dateiauslieferung**: `serveStaticFile()` normalisiert Pfade und
  prüft symbolische Links.
- **Kompression absichern**: `utils/compression.js` beschränkt komprimierbare
  MIME-Typen zur Abwehr von BREACH.

## Stripe-Schlüsselverwaltung

- `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` in einem Secret-Manager
  speichern.
- Schlüssel regelmäßig rotieren und CI/CD-Variablen aktualisieren.
- Webhooks nur über HTTPS akzeptieren und Signaturfehler beobachten.

## Incident Response

1. Bei Verdacht Traffic stoppen oder Schlüssel sperren.
2. Logs unter `logs/` sowie Stripe-Ereignisse analysieren.
3. Bei Datenverlust aus `backups/` wiederherstellen und `npm test` ausführen.
4. Fix bereitstellen, neu deployen, Stakeholder informieren und Lessons Learned
   dokumentieren.

## Compliance-Hinweise

- Aufbewahrungsfristen für VR-Verlauf und Abonnementdaten definieren.
- Nachweise für Einwilligungen gemäß DSGVO/CCPA führen.
- Bei jedem Merge `npm run security:scan` ausführen und Ergebnisse archivieren.
