# Base de Seguridad (Español)

## Modelo de Amenazas

- **Superficie del servidor**: `server-lightweight.js` expone API REST y
  archivos estáticos.
- **Datos en reposo**: Metadatos de extensiones (`data/extensions.json`),
  sesiones del navegador y libro de suscripciones (`data/subscriptions.json`).
- **Datos en tránsito**: Peticiones del cliente VR y webhooks de Stripe.

## Lista de Endurecimiento

- **Terminación TLS**: Ejecutar detrás de HTTPS mediante proxy inverso o
  balanceador.
- **Validación de Host**: Configurar `ALLOWED_HOSTS` en `.env`;
  `validateHostHeader()` filtra dominios.
- **CORS restringido**: `parseAllowedOrigins()` limita los orígenes permitidos.
- **Limitación de tasa**: `checkRateLimit()` mitiga abusos con ventana
  deslizante.
- **Entrega estática segura**: `serveStaticFile()` normaliza rutas y verifica
  enlaces simbólicos.
- **Compresión segura**: `utils/compression.js` limita tipos MIME compresibles
  para evitar ataques como BREACH.

## Manejo de Claves Stripe

- Guardar `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en un gestor de
  secretos.
- Rotar claves periódicamente y actualizar variables de CI/CD.
- Aceptar webhooks solo vía HTTPS y monitorear fallos de verificación de firmas.

## Respuesta a Incidentes

1. Bloquear tráfico o revocar claves ante sospecha de intrusión.
2. Revisar registros en `logs/` y eventos en el panel de Stripe.
3. Restaurar desde `backups/` si hay afectación de datos y ejecutar `npm test`
   para validar.
4. Documentar el incidente, aplicar correcciones y comunicar a las partes
   interesadas.

## Cumplimiento

- Documentar las políticas de retención de historial VR y datos de
  suscripciones.
- Alinear registros de consentimiento con GDPR/CCPA según corresponda.
- Ejecutar `npm run security:scan` en cada integración continua.
