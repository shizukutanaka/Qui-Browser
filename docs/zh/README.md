# Qui 浏览器概览 (简体中文)

## 产品愿景

Qui 浏览器是一款面向 VR 的轻量级浏览器，支持 Chrome 扩展、优化视频流媒体，并通过 Stripe 实现订阅控制。

## 主要功能

- **扩展兼容层**：使用 `/api/extensions`
  API 安装、更新、删除兼容 Chrome 的扩展。
- **媒体管道**：`utils/media-pipeline.js`
  处理 Range 请求，提供流畅的 VR 视频播放。
- **订阅控制**：`server-lightweight.js` 在解锁高级功能前校验 Stripe 订阅状态。

## 快速开始

1. 安装依赖：`npm install`
2. 复制 `.env.example` 为 `.env` 并填写 Stripe 密钥等配置。
3. 启动轻量服务器：`npm start`
4. 在 VR 头显或仿真器中打开浏览器界面。

## 目录指南

- `server-lightweight.js`：HTTP 服务器与路由逻辑。
- `utils/stripe-service.js`：Stripe Checkout 与 Webhook 处理。
- `extensions/manager.js`：扩展的持久化管理。
- `docs/`：多语言文档资源。

## 支持与反馈

请在项目跟踪系统提交问题或改进建议，优先关注符合 VR 路线图的需求。
