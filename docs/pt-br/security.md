# Base de Segurança (Português - Brasil)

## Modelo de Ameaças

- **Superfície do servidor**: `server-lightweight.js` expõe APIs REST e arquivos
  estáticos.
- **Dados em repouso**: metadados de extensões (`data/extensions.json`), sessões
  do navegador e livro de assinaturas (`data/subscriptions.json`).
- **Dados em trânsito**: tráfego do navegador VR e webhooks do Stripe.

## Checklist de Endurecimento

- **Terminação TLS**: operar atrás de HTTPS via proxy reverso ou balanceador.
- **Validação de host**: configure `ALLOWED_HOSTS` em `.env`;
  `validateHostHeader()` bloqueia domínios não autorizados.
- **CORS restrito**: `parseAllowedOrigins()` limita origens permitidas.
- **Rate limiting**: `checkRateLimit()` utiliza janela deslizante contra abuso.
- **Entrega estática segura**: `serveStaticFile()` normaliza caminhos e verifica
  links simbólicos.
- **Compressão segura**: `utils/compression.js` restringe tipos MIME
  comprimíveis, reduzindo risco de BREACH.

## Gestão de Chaves Stripe

- Armazenar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` em um gerenciador de
  segredos.
- Rotacionar chaves periodicamente e atualizar variáveis em CI/CD.
- Aceitar webhooks somente via HTTPS e monitorar falhas de verificação de
  assinatura.

## Resposta a Incidentes

1. Bloquear tráfego ou revogar chaves ao suspeitar de comprometimento.
2. Verificar logs em `logs/` e eventos no painel Stripe.
3. Restaurar de `backups/` se necessário e executar `npm test` para validar.
4. Aplicar correções, redeployar e comunicar resultados às partes interessadas.

## Conformidade

- Documentar política de retenção para histórico VR e dados de assinatura.
- Manter registros de consentimento em conformidade com GDPR/CCPA quando
  aplicável.
- Executar `npm run security:scan` em cada integração e arquivar os resultados.
