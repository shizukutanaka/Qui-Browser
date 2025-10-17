# Qui Browser Visión General (Español)

## Visión del Producto

Qui Browser es un navegador ligero orientado a VR con compatibilidad para
extensiones de Chrome, transmisión multimedia optimizada y control de
suscripciones mediante Stripe.

## Capacidades Clave

- **Compatibilidad con extensiones**: API `/api/extensions` para instalar,
  actualizar y eliminar extensiones estilo Chrome.
- **Canal multimedia**: `utils/media-pipeline.js` gestiona solicitudes de rango
  para reproducción fluida en VR.
- **Control de suscripciones**: `server-lightweight.js` verifica el estado de
  Stripe antes de permitir funciones premium.

## Inicio Rápido

1. Instalar dependencias: `npm install`
2. Configurar variables de entorno copiando `.env.example` a `.env` y añadiendo
   claves de Stripe.
3. Iniciar el servidor ligero: `npm start`
4. Abrir la interfaz VR en el visor o emulador correspondiente.

## Guía de Directorios

- `server-lightweight.js`: servidor HTTP principal y enrutamiento.
- `utils/stripe-service.js`: integración Stripe Checkout y webhooks.
- `extensions/manager.js`: persistencia de extensiones instaladas.
- `docs/`: documentación disponible en múltiples idiomas.

## Soporte y Retroalimentación

Registra incidencias o solicitudes en el rastreador del proyecto. Prioriza
propuestas alineadas con la hoja de ruta centrada en VR.
