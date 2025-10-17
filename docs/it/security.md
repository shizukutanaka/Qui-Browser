# Baseline di sicurezza (Italiano)

## Modello di minaccia

- **Superficie del server**: `server-lightweight.js` espone API REST e file
  statici.
- **Dati a riposo**: metadati delle estensioni (`data/extensions.json`),
  sessioni del browser e registro degli abbonamenti (`data/subscriptions.json`).
- **Dati in transito**: richieste dal browser VR e webhook Stripe.

## Checklist di hardening

- **Terminazione TLS**: posizionare il server dietro HTTPS (reverse proxy o load
  balancer).
- **Validazione host**: configurare `ALLOWED_HOSTS` in `.env`;
  `validateHostHeader()` blocca gli host non autorizzati.
- **CORS restrittivo**: `parseAllowedOrigins()` mantiene una whitelist di
  origini.
- **Rate limiting**: `checkRateLimit()` applica una finestra scorrevole per
  mitigare gli abusi.
- **Distribuzione statica sicura**: `serveStaticFile()` normalizza i percorsi e
  verifica i link simbolici.
- **Compressione controllata**: `utils/compression.js` limita i tipi MIME
  comprimibili, riducendo i rischi di attacchi tipo BREACH.

## Gestione delle chiavi Stripe

- Conservare `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` in un gestore di
  segreti.
- Ruotare regolarmente le chiavi e aggiornare le variabili CI/CD.
- Accettare webhook soltanto su HTTPS e monitorare i fallimenti di verifica
  della firma.

## Risposta agli incidenti

1. Interrompere il traffico o revocare le chiavi se si sospetta una
   compromissione.
2. Analizzare i log in `logs/` e gli eventi dello Stripe Dashboard.
3. Ripristinare da `backups/` se necessario ed eseguire `npm test` per
   verificare l'integrità.
4. Applicare le correzioni, rideployare e informare gli stakeholder registrando
   il post-mortem.

## Conformità

- Documentare la conservazione della cronologia VR e dei dati di abbonamento.
- Mantenere registri di consenso conformi a GDPR/CCPA.
- Eseguire `npm run security:scan` a ogni integrazione e conservarne i
  risultati.
