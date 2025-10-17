# 安全基线 (简体中文)

## 威胁模型

- **服务器攻击面**：`server-lightweight.js` 暴露 REST API 与静态资源。
- **静态数据**：扩展元数据 (`data/extensions.json`)、浏览会话数据、订阅台账 (`data/subscriptions.json`)。
- **传输数据**：VR 客户端请求与 Stripe Webhook 回调。

## 加固清单

- **TLS 终止**：在 HTTPS 反向代理或负载均衡后运行。
- **主机校验**：在 `.env` 配置 `ALLOWED_HOSTS`，`validateHostHeader()`
  过滤非法域名。
- **CORS 限制**：`parseAllowedOrigins()` 强制白名单。
- **限流机制**：`checkRateLimit()` 使用滑动窗口防止滥用。
- **静态资源安全**：`serveStaticFile()` 正规化路径并验证符号链接。
- **压缩策略**：`utils/compression.js` 限制可压缩 MIME，降低 BREACH 风险。

## Stripe 密钥管理

- 将 `STRIPE_SECRET_KEY` 与 `STRIPE_WEBHOOK_SECRET` 存储在安全的密钥管理系统。
- 定期轮换密钥并更新 CI/CD 环境变量。
- 仅接受 HTTPS Webhook，并监控签名校验失败事件。

## 事件响应

1. 一旦怀疑被入侵，立即阻断流量或吊销凭证。
2. 检查 `logs/` 日志与 Stripe 仪表盘事件。
3. 必要时从 `backups/` 恢复并执行 `npm test` 验证。
4. 修复、重新部署，并向相关方汇报，记录事后分析。

## 合规提示

- 明确 VR 浏览历史与订阅数据的保留策略。
- 遵循 GDPR/CCPA 等隐私法规的同意记录要求。
- 在每次集成时运行 `npm run security:scan` 并保存结果。
