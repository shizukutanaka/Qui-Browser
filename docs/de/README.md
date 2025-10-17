# Qui Browser Übersicht (Deutsch)

## Produktvision

Qui Browser ist ein VR-orientierter, leichtgewichtiger Browser mit
Chrome-Erweiterungsunterstützung, optimiertem Videostreaming und
Abonnementverwaltung über Stripe.

## Zentrale Funktionen

- **Erweiterungskompatibilität**: API `/api/extensions` zum Installieren,
  Aktualisieren und Entfernen Chrome-kompatibler Erweiterungen.
- **Medienpipeline**: `utils/media-pipeline.js` verarbeitet Range-Requests für
  flüssige VR-Wiedergabe.
- **Abonnementkontrolle**: `server-lightweight.js` prüft den Stripe-Status vor
  dem Freischalten von Premiumfunktionen.

## Schnellstart

1. Abhängigkeiten installieren: `npm install`
2. `.env.example` nach `.env` kopieren und Stripe-Schlüssel eintragen.
3. Leichtgewicht-Server starten: `npm start`
4. VR-Oberfläche auf dem Headset oder Emulator öffnen.

## Verzeichnisleitfaden

- `server-lightweight.js`: Zentraler HTTP-Server und Routing.
- `utils/stripe-service.js`: Stripe Checkout- und Webhook-Verarbeitung.
- `extensions/manager.js`: Persistentes Management installierter Erweiterungen.
- `docs/`: Mehrsprachige Dokumentation.

## Support & Feedback

Melden Sie Probleme oder Funktionswünsche im Projekt-Tracker und orientieren Sie
sich an der VR-zentrierten Roadmap.
