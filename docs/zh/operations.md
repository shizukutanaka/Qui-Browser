# Qui Browser 运维指南 (简体中文)

## 目标读者

负责在生产 VR 环境中部署并维护 Qui Browser 的运维与 SRE 团队。

## 1. 部署前检查清单

- **容器镜像**：执行 `docker build -t <registry>/qui-browser:<tag> .`
  构建镜像，并运行 `npm run security:scan` 进行漏洞扫描。
- **环境变量文件**：复制
  `.env.example`，删除占位值（`your_*`、`changeme`），将密钥存放于安全的密钥管理系统。
- **TLS 证书**：为 ingress 或反向代理准备证书，参考 `k8s/ingress.yaml`
  中的注解。
- **计费配置**：通过 `node ./cli.js billing:diagnostics`
  验证 Stripe 密钥与回调 URL。
- **静态资源**：运行 `npm run format:check` 确保预压缩资源与源文件一致。

## 2. 运行期预期

- **入口进程**：通过 `npm start` 或 `node ./cli.js start --port 8000` 启动
  `server-lightweight.js`。
- **默认端口**：HTTP `8000`；启用 `server-websocket.js` 时 WebSocket 为 `8080`。
- **扩展模型**：HTTP 服务无状态；会话状态存放在 `data/`
  下的 JSON。多副本部署需使用共享存储或持久卷。

## 3. 关键环境变量

| 变量                     | 作用                 | 建议                                                 |
| ------------------------ | -------------------- | ---------------------------------------------------- |
| `PORT`                   | 监听端口             | 与 `k8s/service.yaml` 保持一致。                     |
| `HOST`                   | 绑定地址             | 容器内使用 `0.0.0.0`。                               |
| `ALLOWED_HOSTS`          | Host 头白名单        | 限定 ingress 域名，支持通配符（如 `.example.com`）。 |
| `TRUST_PROXY`            | 信任 `X-Forwarded-*` | 部署在代理后时设为 `true`。                          |
| `STATIC_ROOT`            | 静态资源根目录       | 默认 `.`；可挂载 CDN 资源。                          |
| `LIGHTWEIGHT`            | 轻量模式             | 资源紧张的硬件上设为 `true`。                        |
| `BILLING_ADMIN_TOKEN`    | 计费管理令牌         | 至少 16 字符，季度轮换。                             |
| `STRIPE_*`               | Stripe 凭据          | 存放于密钥服务，勿提交仓库。                         |
| `DEFAULT_BILLING_LOCALE` | 价格默认区域         | 需与 `config/pricing.js` 中的区域匹配。              |
| `LOG_LEVEL`              | 日志粒度规划         | 预留与集中日志系统对接。                             |
| `HEALTH_*`               | 健康监控阈值         | 根据硬件性能调优。                                   |

> 提示：在 CI 中运行 `node ./cli.js billing:diagnostics` 与
> `node scripts/check-vulnerabilities.js`，确保上线前配置安全。

## 4. 部署流程

### Docker Compose

```bash
cp .env.example .env
# 调整环境变量
npm install
npm run build
# 启动轻量服务器
npm start
```

### Kubernetes

1. 将镜像推送至企业镜像仓库。
2. 更新 `k8s/deployment.yaml` 中的镜像标签与资源配额。
3. 执行 `kubectl apply -f k8s/` 部署全部资源。
4. 使用 `kubectl rollout status deployment/qui-browser` 监控滚动更新。
5. 通过 `kubectl get svc qui-browser` 验证服务连通性。

### 滚动更新

- 更新镜像：`kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`。
- 监控健康状态：`kubectl get pods`、`kubectl logs -l app=qui-browser`。
- 必要时回滚：`kubectl rollout undo deployment/qui-browser`。

## 5. 可观测性

- **健康检查**：`GET /health` 返回状态、运行时长、资源占用和限流计数（定义于
  `server-lightweight.js`）。
- **指标接口**：`GET /metrics` 提供聚合指标，可通过 Prometheus `ServiceMonitor`
  (`k8s/servicemonitor.yaml`) 抓取。
- **日志**：保存在 `logs/`，可结合外部日志驱动与备份脚本管理。
- **性能面板**：`GET /dashboard` 通过 `utils/performance-dashboard.js`
  生成 HTML 视图。

## 6. 日常维护

- **备份脚本** 位于 `scripts/`：
  - `node scripts/list-backups.js`
  - `node scripts/verify-backup.js --latest`
  - `node scripts/prune-backups.js --retain 30`
- **恢复演练**：在预发布环境执行
  `node scripts/restore-backup.js --id <timestamp>`。
- **安全扫描**：每次发布执行
  `npm audit`、`npm run security:scan`、`node scripts/check-vulnerabilities.js`。
- **性能基准**：运行 `node scripts/benchmark.js --full` 获取 CPU/内存基线。

## 7. 事件响应

1. 通过 `/health` 或监控告警发现异常。
2. 隔离故障 Pod（例如 `kubectl cordon` 或缩容）。
3. 收集 `logs/` 与 Kubernetes 事件（`kubectl describe pod`）。
4. 如数据损坏，从 `backups/` 恢复。
5. 向相关方通报，并在 `docs/improvement-backlog.md` 中登记后续改进项。

## 8. 加固建议

- 通过 ingress 强制 HTTPS，启用 HSTS（`security` 配置）。
- 利用 `CORS_ALLOWED_ORIGINS` 限制跨域。
- 设置合理的 `RATE_LIMIT_MAX`、`RATE_LIMIT_WINDOW`。
- 配置 Prometheus 告警：CPU > 70%、内存 > 80%、限流激增等。
- 确保 CI 流程执行 `npm run build` 及完整测试。

## 9. 故障排查速览

| 症状          | 排查                                         | 处理                                    |
| ------------- | -------------------------------------------- | --------------------------------------- |
| 400 Host 被拒 | 检查 `ALLOWED_HOSTS`                         | 补充 ingress 域名或通配符。             |
| 503 健康降级  | 解析 `/health` 响应                          | 扩容或调整 `HEALTH_*` 阈值。            |
| Stripe 失败   | 执行 `cli.js billing:diagnostics`            | 修正凭据/占位值后重部署。               |
| 静态资源缺失  | 检查 `STATIC_ROOT` 与 `serveStaticFile` 日志 | 同步资源或调整卷挂载。                  |
| 限流过高      | 查看 `/metrics` 限流计数                     | 提高 `RATE_LIMIT_MAX` 或引入 CDN 缓存。 |

## 10. 变更管理

- 记录每次上线，并引用 `docs/improvement-backlog.md` 中的追踪 ID。
- 建议采用蓝绿或金丝雀发布（`maxUnavailable=0`，`maxSurge=1`）。
- 发布后归档指标快照并纳入发布说明。

请与配置/基础设施变更同步更新本指南，以保持运维团队的统一认知。
