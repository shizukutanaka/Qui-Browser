# Visão Geral do Qui Browser (Português - Brasil)

## Visão do Produto

Qui Browser é um navegador leve focado em realidade virtual, compatível com
extensões do Chrome, com streaming de vídeo otimizado e controle de assinatura
via Stripe.

## Principais Recursos

- **Compatibilidade com extensões**: API `/api/extensions` para instalar,
  atualizar e remover extensões compatíveis com Chrome.
- **Pipeline de mídia**: `utils/media-pipeline.js` processa requisições de
  intervalo, garantindo reprodução suave em VR.
- **Controle de assinatura**: `server-lightweight.js` verifica o status Stripe
  antes de liberar recursos premium.

## Início Rápido

1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env` e preencha as chaves do Stripe.
3. Inicie o servidor leve: `npm start`
4. Abra a interface VR no headset ou emulador.

## Guia de Diretórios

- `server-lightweight.js`: servidor HTTP principal e roteamento.
- `utils/stripe-service.js`: integração com Stripe Checkout e webhooks.
- `extensions/manager.js`: gerenciamento persistente das extensões instaladas.
- `docs/`: documentação multilíngue.

## Suporte e Feedback

Registre problemas ou sugestões no rastreador do projeto, alinhando-se ao
roadmap centrado em VR.
