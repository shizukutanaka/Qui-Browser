# Panoramica di Qui Browser (Italiano)

## Visione del prodotto

Qui Browser è un browser leggero orientato alla realtà virtuale, compatibile con
le estensioni Chrome, ottimizzato per lo streaming video e protetto da un
modello di abbonamento Stripe.

## Funzionalità principali

- **Compatibilità estensioni**: API `/api/extensions` per installare, aggiornare
  e rimuovere estensioni compatibili con Chrome.
- **Pipeline multimediale**: `utils/media-pipeline.js` gestisce le richieste di
  intervallo garantendo una riproduzione VR fluida.
- **Controllo degli abbonamenti**: `server-lightweight.js` verifica lo stato
  Stripe prima di abilitare le funzionalità premium.

## Avvio rapido

1. Installare le dipendenze: `npm install`
2. Copiare `.env.example` in `.env` e compilare le chiavi Stripe.
3. Avviare il server leggero: `npm start`
4. Aprire l'interfaccia VR sul visore o sull'emulatore.

## Guida alle directory

- `server-lightweight.js`: server HTTP principale e logica di routing.
- `utils/stripe-service.js`: integrazione Stripe Checkout e gestione webhook.
- `extensions/manager.js`: gestione persistente delle estensioni installate.
- `docs/`: documentazione in più lingue.

## Supporto e feedback

Segnala problemi o richieste nel tracker del progetto, allineandoti alla roadmap
incentrata sulla VR.
