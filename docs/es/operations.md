# Guía de Operaciones de Qui Browser (Español)

## Audiencia

Equipos de operaciones y SRE responsables de desplegar y mantener Qui Browser en
entornos VR de producción.

## 1. Lista de verificación previa al despliegue

- **Imagen de contenedor**: Construir con
  `docker build -t <registry>/qui-browser:<tag> .` y ejecutar
  `npm run security:scan` para detectar vulnerabilidades.
- **Archivo de entorno**: Clonar `.env.example`, eliminar valores de marcador
  (`your_*`, `changeme`) y almacenar secretos en un gestor seguro.
- **Certificados TLS**: Preparar certificados para ingress o proxies inversos;
  consultar anotaciones en `k8s/ingress.yaml`.
- **Configuración de facturación**: Validar claves y URL de Stripe con
  `node ./cli.js billing:diagnostics`.
- **Recursos estáticos**: Ejecutar `npm run format:check` para garantizar la
  coherencia con los activos precomprimidos.

## 2. Expectativas en tiempo de ejecución

- **Punto de entrada**: `server-lightweight.js` mediante `npm start` o
  `node ./cli.js start --port 8000`.
- **Puertos por defecto**: HTTP `8000`; WebSocket (`server-websocket.js`)
  utiliza `8080` cuando está habilitado.
- **Modelo de escalado**: Servicio HTTP sin estado; el estado de sesión reside
  en archivos JSON bajo `data/`. Utilizar almacenamiento compartido o volúmenes
  cuando se despliega en clúster.

## 3. Variables de entorno clave

| Variable                        | Propósito                           | Recomendación                                                                             |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `PORT`                          | Puerto de escucha                   | Alinear con `k8s/service.yaml`.                                                           |
| `HOST`                          | Dirección de enlace                 | `0.0.0.0` dentro de contenedores.                                                         |
| `ALLOWED_HOSTS`                 | Lista permitida de Host header      | Restringir a dominios del ingress; admite comodines (`.example.com`).                     |
| `TRUST_PROXY`                   | Aceptar cabeceras `X-Forwarded-*`   | Establecer `true` detrás de proxies.                                                      |
| `STATIC_ROOT`                   | Carpeta base de activos estáticos   | Valor predeterminado `.`; montar CDN si aplica.                                           |
| `LIGHTWEIGHT`                   | Modo mínimo                         | Usar `true` en hardware limitado.                                                         |
| `BILLING_ADMIN_TOKEN`           | Token del API administrativo        | Mínimo 16 caracteres; rotar trimestralmente.                                              |
| `STRIPE_*`                      | Credenciales de Stripe              | Guardar en gestor de secretos; nunca en el repositorio.                                   |
| `DEFAULT_BILLING_LOCALE`        | Localización por defecto de precios | Debe coincidir con los locales de `config/pricing.js`.                                    |
| `LOG_LEVEL`                     | Futuro nivel de log                 | Planear integración con logging centralizado.                                             |
| `HEALTH_*`                      | Umbrales del monitor de salud       | Ajustar según el hardware objetivo.                                                       |
| `NOTIFICATION_ENABLED`          | Activar alertas vía webhook         | Validar primero en staging.                                                               |
| `NOTIFICATION_WEBHOOKS`         | URLs de webhook separadas por comas | Con `NOTIFICATION_ENABLED=true` deben ser URLs HTTPS absolutas; vacío desactiva el envío. |
| `NOTIFICATION_MIN_LEVEL`        | Severidad mínima para despachar     | Predeterminado `warning`; subir a `error` para reducir ruido.                             |
| `NOTIFICATION_TIMEOUT_MS`       | Tiempo de espera del webhook        | Entero ≥ 100; aumentar para endpoints lentos sin exceder la timeout del request.          |
| `NOTIFICATION_BATCH_WINDOW_MS`  | Ventana de agrupación (ms)          | Entero ≥ 0; valores >0 agrupan eventos para reducir ruido.                                |
| `NOTIFICATION_RETRY_LIMIT`      | Intentos automáticos de reintento   | Entero 0-10; por defecto `3`, establecer `0` desactiva el reintento.                      |
| `NOTIFICATION_RETRY_BACKOFF_MS` | Backoff inicial de reintento        | Entero ≥ 0 con backoff exponencial y jitter.                                              |

> Consejo: Ejecutar `node ./cli.js billing:diagnostics` y
> `node scripts/check-vulnerabilities.js` en CI antes de publicar.

## 4. Flujos de despliegue

### Docker Compose

```bash
cp .env.example .env
# Ajustar variables de entorno
npm install
npm run build
# Iniciar el servidor ligero
npm start
```

### Kubernetes

1. Publicar la imagen del contenedor en su registro.
2. Editar etiquetas de imagen y peticiones de recursos en `k8s/deployment.yaml`.
3. Aplicar manifiestos: `kubectl apply -f k8s/`.
4. Verificar el despliegue: `kubectl rollout status deployment/qui-browser`.
5. Confirmar el servicio: `kubectl get svc qui-browser`.

### Actualizaciones continuas

- Actualizar la imagen:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Monitorizar la salud: `kubectl get pods` y `kubectl logs -l app=qui-browser`.
- Revertir si es necesario: `kubectl rollout undo deployment/qui-browser`.

## 5. Observabilidad

- **Endpoint de salud**: `GET /health` muestra estado, uptime, uso de recursos y
  contadores de rate limiting (ver `server-lightweight.js`). Integrarlo con
  monitoreo de disponibilidad.
- **Endpoint de métricas**: `GET /metrics` devuelve estadísticas agregadas; se
  puede recolectar mediante `ServiceMonitor` de Prometheus
  (`k8s/servicemonitor.yaml`).
- **Registros**: Almacenados en `logs/`. Usar un driver externo o los scripts de
  respaldo para rotar.
- **Panel**: `GET /dashboard` genera un panel HTML mediante
  `utils/performance-dashboard.js`.

## 6. Mantenimiento rutinario

- **Respaldos**: Utilizar scripts en `scripts/`.
  - `node scripts/list-backups.js`: Lista los respaldos disponibles.
  - `node scripts/verify-backup.js --latest`: Verifica el último archivo.
  - `node scripts/prune-backups.js --retain 30`: Elimina copias antiguas y
    conserva 30.
- **Integridad de datos**: Probar restauraciones con
  `node scripts/restore-backup.js --id <timestamp>` en staging.
- **Escaneos de seguridad**: Ejecutar `npm audit`, `npm run security:scan` y
  `node scripts/check-vulnerabilities.js` en cada release.
- **Rendimiento**: Ejecutar `node scripts/benchmark.js --full` para establecer
  línea base de CPU y memoria.

## 7. Respuesta a incidentes

1. **Detectar** degradación o alertas cuando `/health` devuelva un estado
   distinto de `healthy`.
2. **Aislar** pods problemáticos (`kubectl cordon <node>` o ajustar réplicas).
3. **Recopilar** registros de `logs/` y eventos de Kubernetes
   (`kubectl describe pod`).
4. **Restaurar** usando archivos en `backups/` si hay corrupción de datos.
5. **Comunicar** el estado y documentar acciones; registrar tareas de
   seguimiento en `docs/improvement-backlog.md`.

## 8. Endurecimiento

- Forzar HTTPS en el ingress y habilitar HSTS mediante la configuración de
  `security`.
- Limitar orígenes con `CORS_ALLOWED_ORIGINS`.
- Mantener valores por defecto de rate limiting (`RATE_LIMIT_MAX`,
  `RATE_LIMIT_WINDOW`).
- Configurar alertas de Prometheus para CPU > 70 %, memoria > 80 % y picos de
  rate limiting.
- Asegurar que el pipeline de GitOps ejecute `npm run build` y la suite de
  pruebas antes del despliegue.

## 9. Referencia de resolución de problemas

| Síntoma                     | Investigación                                     | Resolución                                           |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Rechazo 400 por Host        | Revisar `ALLOWED_HOSTS`                           | Añadir dominio del ingress o comodín.                |
| `503` por salud degradada   | Analizar respuesta de `/health`                   | Escalar recursos o ajustar umbrales `HEALTH_*`.      |
| Fallos de Stripe Checkout   | Ejecutar `cli.js billing:diagnostics`             | Corregir credenciales o placeholders y redistribuir. |
| Activos estáticos faltantes | Revisar `STATIC_ROOT` y logs de `serveStaticFile` | Sincronizar activos o montar volúmenes correctos.    |
| Exceso de rate limiting     | Revisar contadores en `/metrics`                  | Aumentar `RATE_LIMIT_MAX` o agregar caché/CDN.       |

## 10. Gestión de cambios

- Documentar cambios en producción con referencia a los IDs de seguimiento en
  `docs/improvement-backlog.md`.
- Implementar despliegues blue/green o canary usando `maxUnavailable=0`,
  `maxSurge=1` en Kubernetes.
- Después de cada release, archivar instantáneas de métricas y adjuntarlas a las
  notas de la versión.

Mantenga esta guía como runbook principal de Qui Browser y actualícela junto con
cualquier cambio de configuración o infraestructura para mantener alineados a
los equipos de operaciones.
