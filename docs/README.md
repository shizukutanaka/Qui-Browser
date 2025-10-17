# Qui Browser Documentation Hub

> CI executes `npm run docs:check` to ensure each locale folder includes
> `README.md`, `security.md`, and `operations.md`. The generated JSON report is
> attached to each CI run as the `docs-consistency-report` artifact (see GitHub
> Actions → `quality` job).

### Generating localized operations guides

- **CLI command**:
  `node ./cli.js docs:generate-operations --locale <code> --language <display-name>`
- **Example**:
  `node ./cli.js docs:generate-operations --locale fr --language "Français"`
- **Overwrite**: Append `--force` to replace an existing `operations.md`.
- **Custom path**: Use `--output docs/custom/operations.md` to control the
  destination.

### Creating Content-Security-Policy presets

- **CLI command**: `node ./cli.js csp:generate --preset strict`
- **Relax scripts for analytics**:
  `--preset analytics --script-host https://www.google-analytics.com`
- **Development mode**:
  `--preset development --allow-inline-scripts --allow-eval`
- **JSON output**: append `--json` to inspect directive breakdown.

### Dependency vulnerability monitoring

- **npm audit baseline**: `npm run check:vulnerabilities`
- **Enable Snyk**: `ENABLE_SNYK=true npm run check:vulnerabilities` (requires
  authenticated Snyk CLI)
- **Configuration**: adjust `SEVERITY_THRESHOLD`, `REPORT_DIR`,
  `SNYK_SEVERITY_THRESHOLD`, or `SNYK_COMMAND` via environment variables.

### System diagnostics (`doctor`)

- **Basic run**: `node ./cli.js doctor`
- **Machine-readable**: `node ./cli.js doctor --json`
- **TLS check**:
  `node ./cli.js doctor --check-tls --tls-cert /path/to/cert.pem --tls-threshold-days 14`
- **Auto-renew hook**: add `--tls-renew-command "certbot renew"` or set env
  vars.

## English

- **Product overview**: `docs/en/README.md`
- **Security baseline**: `docs/en/security.md`
- **Operations guide**: `docs/en/operations.md`

## 日本語

- **製品概要**: `docs/ja/README.md`
- **セキュリティ基準**: `docs/ja/security.md`
- **運用ガイド**: `docs/ja/operations.md`

## Español

- **Visión general**: `docs/es/README.md`
- **Base de seguridad**: `docs/es/security.md`
- **Guía de operaciones**: `docs/es/operations.md`

## 简体中文

- **产品概览**: `docs/zh/README.md`
- **安全基线**: `docs/zh/security.md`
- **运维指南**: `docs/zh/operations.md`

## Français

- **Vue d'ensemble**: `docs/fr/README.md`
- **Base de sécurité**: `docs/fr/security.md`
- **Guide d'exploitation**: `docs/fr/operations.md`

## Deutsch

- **Übersicht**: `docs/de/README.md`
- **Sicherheitsbasis**: `docs/de/security.md`
- **Betriebsleitfaden**: `docs/de/operations.md`

## Italiano

- **Panoramica**: `docs/it/README.md`
- **Baseline di sicurezza**: `docs/it/security.md`
- **Guida operativa**: `docs/it/operations.md`

## Português (Brasil)

- **Visão geral**: `docs/pt-br/README.md`
- **Base de segurança**: `docs/pt-br/security.md`
- **Guia de operações**: `docs/pt-br/operations.md`

## Русский

- **Обзор**: `docs/ru/README.md`
- **Базовая безопасность**: `docs/ru/security.md`
- **Руководство по эксплуатации**: `docs/ru/operations.md`

## 한국어

- **개요**: `docs/ko/README.md`
- **보안 기준**: `docs/ko/security.md`
- **운영 가이드**: `docs/ko/operations.md`

## العربية

- **نظرة عامة**: `docs/ar/README.md`
- **أساسيات الأمان**: `docs/ar/security.md`
- **دليل العمليات**: `docs/ar/operations.md`

## हिन्दी

- **परिचय**: `docs/hi/README.md`
- **सुरक्षा आधाररेखा**: `docs/hi/security.md`
- **संचालन गाइड**: `docs/hi/operations.md`

## Bahasa Indonesia

- **Ikhtisar**: `docs/id/README.md`
- **Dasar keamanan**: `docs/id/security.md`
- **Panduan operasi**: `docs/id/operations.md`
