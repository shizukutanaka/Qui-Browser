# Guia de Operações do Qui Browser (Português - Brasil)

## Público-alvo

Times de operações e SRE responsáveis por implantar e manter o Qui Browser em
ambientes VR de produção.

## 1. Checklist pré-implantação

- **Imagem do contêiner**: Execute
  `docker build -t <registry>/qui-browser:<tag> .` e `npm run security:scan`
  para validar segurança.
- **Arquivo de ambiente**: Copie `.env.example`, remova placeholders (`your_*`,
  `changeme`) e armazene segredos em um cofre.
- **Certificados TLS**: Prepare certificados para ingress ou proxy reverso;
  confira anotações em `k8s/ingress.yaml`.
- **Configuração de cobrança**: Valide chaves e URLs do Stripe com
  `node ./cli.js billing:diagnostics`.
- **Assets estáticos**: Rodar `npm run format:check` para garantir sincronização
  com arquivos pré-comprimidos.

## 2. Expectativas em runtime

- **Processo inicial**: `server-lightweight.js` por `npm start` ou
  `node ./cli.js start --port 8000`.
- **Portas padrão**: HTTP `8000`; WebSocket (`server-websocket.js`) usa `8080`
  quando ativo.
- **Escalonamento**: Serviço HTTP stateless; estado de sessão em `data/`. Use
  storage compartilhado/volumes em clusters.

## 3. Variáveis de ambiente chave

| Variável                        | Função                                | Recomendação                                                                          |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `PORT`                          | Porta de escuta                       | Alinhe com `k8s/service.yaml`.                                                        |
| `HOST`                          | Endereço de binding                   | `0.0.0.0` em contêineres.                                                             |
| `ALLOWED_HOSTS`                 | Lista permitida de Host               | Restringir aos domínios do ingress; suporta wildcard (`.example.com`).                |
| `TRUST_PROXY`                   | Confiar em `X-Forwarded-*`            | Defina `true` atrás de proxy.                                                         |
| `STATIC_ROOT`                   | Base de assets estáticos              | Padrão `.`; monte CDN se necessário.                                                  |
| `LIGHTWEIGHT`                   | Modo leve                             | `true` para hardware limitado.                                                        |
| `BILLING_ADMIN_TOKEN`           | Token de administração                | ≥16 caracteres, rotacionar trimestralmente.                                           |
| `STRIPE_*`                      | Credenciais Stripe                    | Guardar em gerenciador de segredos.                                                   |
| `DEFAULT_BILLING_LOCALE`        | Locale padrão                         | Coerente com `config/pricing.js`.                                                     |
| `LOG_LEVEL`                     | Futuro nível de log                   | Planejar logging centralizado.                                                        |
| `HEALTH_*`                      | Limiares de health check              | Ajustar conforme hardware.                                                            |
| `NOTIFICATION_ENABLED`          | Ativa alertas via webhook             | Validar primeiro em staging.                                                          |
| `NOTIFICATION_WEBHOOKS`         | URLs de webhook separadas por vírgula | Com `NOTIFICATION_ENABLED=true` devem ser URLs HTTPS absolutas; vazio desativa envio. |
| `NOTIFICATION_MIN_LEVEL`        | Severidade mínima para envio          | Padrão `warning`; elevar para `error` reduz ruído.                                    |
| `NOTIFICATION_TIMEOUT_MS`       | Timeout de requisição webhook         | Inteiro ≥ 100; aumentar para endpoints lentos sem exceder o timeout total.            |
| `NOTIFICATION_BATCH_WINDOW_MS`  | Janela de agrupamento (ms)            | Inteiro ≥ 0; valores >0 agrupam eventos e reduzem notificações.                       |
| `NOTIFICATION_RETRY_LIMIT`      | Tentativas automáticas de retry       | Inteiro 0-10; padrão `3`, `0` desativa retries.                                       |
| `NOTIFICATION_RETRY_BACKOFF_MS` | Backoff inicial (ms)                  | Inteiro ≥ 0 com backoff exponencial e jitter.                                         |

> Dica: antes de liberar, rode `node ./cli.js billing:diagnostics` e
> `node scripts/check-vulnerabilities.js` no pipeline CI.

## 4. Fluxos de implantação

### Docker Compose

```bash
cp .env.example .env
# Ajustar variáveis
npm install
npm run build
# Iniciar servidor leve
npm start
```

### Kubernetes

1. Publique a imagem no registro.
2. Ajuste tags e requests em `k8s/deployment.yaml`.
3. `kubectl apply -f k8s/`.
4. `kubectl rollout status deployment/qui-browser` para acompanhar.
5. `kubectl get svc qui-browser` para validar exposição.

### Atualizações graduais

- Atualize a imagem:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- Monitore: `kubectl get pods` e `kubectl logs -l app=qui-browser`.
- Faça rollback se necessário: `kubectl rollout undo deployment/qui-browser`.

## 5. Observabilidade

- **Endpoint de saúde**: `GET /health` retorna status, uptime, uso de recursos e
  contadores de rate limiting (`server-lightweight.js`).
- **Endpoint de métricas**: `GET /metrics` fornece dados agregados; use
  `ServiceMonitor` Prometheus (`k8s/servicemonitor.yaml`).
- **Logs**: Em `logs/`. Utilize driver externo ou scripts de backup para
  rotação.
- **Dashboard**: `GET /dashboard` gera painel HTML via
  `utils/performance-dashboard.js`.

## 6. Manutenção contínua

- **Backups** com scripts em `scripts/`:
  - `node scripts/list-backups.js`
  - `node scripts/verify-backup.js --latest`
  - `node scripts/prune-backups.js --retain 30`
- **Testes de restauração**: `node scripts/restore-backup.js --id <timestamp>`
  em staging.
- **Segurança**: `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js` em cada release.
- **Performance**: `node scripts/benchmark.js --full` para baseline.

## 7. Resposta a incidentes

1. Detectar degradação via `/health` ou alertas.
2. Isolar pods afetados (`kubectl cordon`, ajustar réplicas).
3. Coletar logs/eventos (`kubectl describe pod`).
4. Restaurar com `backups/` se houver corrupção.
5. Comunicar e registrar follow-ups em `docs/improvement-backlog.md`.

## 8. Endurecimento

- Forçar HTTPS e habilitar HSTS via configurações `security`.
- Restringir origens com `CORS_ALLOWED_ORIGINS`.
- Configurar `RATE_LIMIT_MAX` e `RATE_LIMIT_WINDOW` como inteiros ≥ 1.
- Alertas Prometheus para CPU > 70%, memória > 80%, picos de rate limiting.
- Pipeline CI deve executar `npm run build` e testes completos.

## 9. Troubleshooting

| Sintoma             | Investigação                           | Mitigação                                    |
| ------------------- | -------------------------------------- | -------------------------------------------- |
| Erro 400 Host       | Revisar `ALLOWED_HOSTS`                | Adicionar domínio/wildcard.                  |
| 503 Saúde degradada | Checar `/health`                       | Escalar recursos ou ajustar `HEALTH_*`.      |
| Falha Stripe        | `cli.js billing:diagnostics`           | Corrigir credenciais/placeholder e redeploy. |
| Assets ausentes     | `STATIC_ROOT` e logs `serveStaticFile` | Sincronizar assets ou volumes.               |
| Rate limiting alto  | `/metrics`                             | Aumentar `RATE_LIMIT_MAX` ou adicionar CDN.  |

## 10. Gestão de mudanças

- Documentar mudanças referenciando IDs de `docs/improvement-backlog.md`.
- Preferir blue/green ou canary (`maxUnavailable=0`, `maxSurge=1`).
- Arquivar snapshots de métricas nas release notes.

Atualize este guia sempre que houver alterações de configuração ou
infraestrutura para manter os times alinhados.
