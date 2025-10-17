# Kubernetes Deployment Guide

## クイックスタート

### 1. 前提条件

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker image built and pushed

### 2. デプロイ

```bash
# すべてのリソースを適用
kubectl apply -f k8s/

# または個別に適用
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/servicemonitor.yaml
```

### 3. 確認

```bash
# Pod の状態を確認
kubectl get pods -l app=qui-browser

# サービスを確認
kubectl get svc qui-browser

# ログを確認
kubectl logs -l app=qui-browser -f

# 詳細情報を確認
kubectl describe deployment qui-browser
```

## リソース詳細

### Deployment

- 3 replica for high availability
- RollingUpdate strategy
- Resource limits: 500m CPU, 512Mi Memory
- Security context enabled
- Health checks configured

### Service

- ClusterIP type
- Port 80 → 8000
- Prometheus metrics exposed on separate service

### Auto-scaling

- HorizontalPodAutoscaler configured
- Min replicas: 3
- Max replicas: 10
- Target CPU: 70%
- Target Memory: 80%

### Monitoring

- ServiceMonitor for Prometheus Operator
- Metrics endpoint: `/metrics`
- Scrape interval: 30s

## 本番環境向け設定

### 1. イメージの更新

```bash
REGISTRY_HOST="registry.yourdomain.tld"
IMAGE_TAG="v1.0.3"

# イメージをビルド (REGISTRY_HOST は実際のレジストリFQDNに置き換え)
docker build -t "${REGISTRY_HOST}/qui-browser:${IMAGE_TAG}" .

# レジストリにプッシュ
docker push "${REGISTRY_HOST}/qui-browser:${IMAGE_TAG}"

# デプロイメントを更新
kubectl set image deployment/qui-browser \
  qui-browser="${REGISTRY_HOST}/qui-browser:${IMAGE_TAG}"
```

### 2. シークレットの設定

```bash
# TLS証明書のシークレット作成
kubectl create secret tls qui-browser-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

### 3. リソースのスケーリング

```bash
# 手動スケーリング
kubectl scale deployment qui-browser --replicas=5

# 自動スケーリング確認
kubectl get hpa qui-browser
```

## トラブルシューティング

### Podが起動しない

```bash
# イベントを確認
kubectl describe pod qui-browser-xxx

# ログを確認
kubectl logs qui-browser-xxx

# 直前のコンテナログを確認
kubectl logs qui-browser-xxx --previous
```

### ヘルスチェック失敗

```bash
# ヘルスチェックエンドポイントを直接確認 (HTTPS 環境では HTTPS 経由でアクセス)
kubectl port-forward qui-browser-xxx 8000:8000
curl -f http://localhost:8000/health
```

### メトリクスが取得できない

```bash
# Prometheusメトリクスを確認
kubectl port-forward qui-browser-xxx 8000:8000
curl http://localhost:8000/metrics
```

## クリーンアップ

```bash
# すべてのリソースを削除
kubectl delete -f k8s/

# または個別に削除
kubectl delete deployment qui-browser
kubectl delete service qui-browser qui-browser-metrics
kubectl delete ingress qui-browser
kubectl delete hpa qui-browser
kubectl delete servicemonitor qui-browser
```
