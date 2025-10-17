# دليل تشغيل Qui Browser (العربية)

## الجمهور المستهدف

فرق العمليات وفرق SRE المسؤولة عن نشر وصيانة Qui Browser في بيئات الواقع
الافتراضي الإنتاجية.

## 1. قائمة ما قبل النشر

- **صورة الحاوية**: نفّذ `docker build -t <registry>/qui-browser:<tag> .` ثم
  شغّل `npm run security:scan` للفحص الأمني.
- **ملف البيئة**: انسخ `.env.example`، أزل القيم الافتراضية (`your_*`,
  `changeme`) وخزن الأسرار في مدير آمن.
- **شهادات TLS**: حضّر الشهادات لاستخدام ingress أو العكس proxy، راجع تعليقات
  `k8s/ingress.yaml`.
- **إعدادات الفوترة**: تحقق من مفاتيح Stripe وروابطها عبر
  `node ./cli.js billing:diagnostics`.
- **الملفات الثابتة**: شغّل `npm run format:check` لضمان توافق الأصول المضغوطة
  مسبقًا مع المصدر.

## 2. التوقعات أثناء التشغيل

- **نقطة الدخول**: الملف `server-lightweight.js` عبر `npm start` أو
  `node ./cli.js start --port 8000`.
- **المنافذ الافتراضية**: HTTP على `8000`، وWebSocket (`server-websocket.js`)
  على `8080` عند التفعيل.
- **نموذج التوسع**: الخدمة HTTP دون حالة؛ بيانات الجلسة محفوظة في ملفات JSON
  داخل `data/`. استخدم تخزينًا مشتركًا عند التشغيل في عنقود.

## 3. متغيرات البيئة الأساسية

| المتغير                  | الوصف                           | الملاحظات                                                                                       |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `PORT`                   | منفذ الاستماع                   | مطابق لـ `k8s/service.yaml`.                                                                    |
| `HOST`                   | عنوان الربط                     | استخدم `0.0.0.0` داخل الحاويات.                                                                 |
| `ALLOWED_HOSTS`          | قائمة مضيفة مسموحة              | حصر المجال في نطاق ingress ودعم الرموز (`.example.com`).                                        |
| `TRUST_PROXY`            | قبول ترويسات `X-Forwarded-*`    | اجعلها `true` خلف proxy.                                                                        |
| `NOTIFICATION_WEBHOOKS`  | روابط الويب هوك المفصولة بفواصل | عند تفعيل `NOTIFICATION_ENABLED=true` يجب أن تكون روابط HTTPS مطلقة؛ تركها فارغًا يعطل الإرسال. |
| `LIGHTWEIGHT`            | وضع خفيف                        | اجعلها `true` للأجهزة محدودة الموارد.                                                           |
| `BILLING_ADMIN_TOKEN`    | رمز واجهة الإدارة               | 16 محرفًا على الأقل؛ تتغير كل ربع سنة.                                                          |
| `STRIPE_*`               | بيانات Stripe                   | خزّنها في مدير الأسرار ولا تضعها في المستودع.                                                   |
| `DEFAULT_BILLING_LOCALE` | لغة الأسعار الافتراضية          | يجب أن تتطابق مع `config/pricing.js`.                                                           |
| `LOG_LEVEL`              | مستوى التسجيل المستقبلي         | خطط للربط مع نظام تسجيل مركزي.                                                                  |

## 4. سير عمل النشر

### Docker Compose

```bash
cp .env.example .env
# اضبط متغيرات البيئة
npm install
npm run build
npm start
```

### Kubernetes

1. ادفع صورة الحاوية إلى السجل الخاص بك.
2. عدّل علامات الصور وطلبات الموارد في `k8s/deployment.yaml`.
3. طبّق البيانات الوصفية: `kubectl apply -f k8s/`.
4. تحقق من الإطلاق: `kubectl rollout status deployment/qui-browser`.
5. أكد الوصول إلى الخدمة: `kubectl get svc qui-browser`.

### التحديثات المتدحرجة

- حدّث علامة الصورة:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`.
- راقب الصحة: `kubectl get pods` و `kubectl logs -l app=qui-browser`.
- التراجع عند الحاجة: `kubectl rollout undo deployment/qui-browser`.

## 5. قابلية المراقبة

- **نقطة الصحة**: يُرجع `GET /health` الحالة ووقت التشغيل واستخدام الموارد
  وعدّادات تحديد المعدل.
- **نقطة القياسات**: يوفر `GET /metrics` قياسات مجمعة للخادم والنظام؛ استخرجها
  عبر Prometheus `ServiceMonitor`.
- **السجلات**: مخزنة في `logs/`. استخدم برنامج تشغيل السجلات الخارجي أو نصوص
  النسخ الاحتياطي.
- **لوحة المعلومات**: يعرض `GET /dashboard` لقطة أداء بنمط Atlassian مع الصحة
  وكفاءة ذاكرة التخزين المؤقت.

## 6. الصيانة الدورية

- **النسخ الاحتياطية**: استخدم النصوص في `scripts/`.
  - سرد النسخ: `node scripts/list-backups.js`.
  - التحقق من الأرشيف: `node scripts/verify-backup.js --latest`.
  - تنظيف اللقطات القديمة: `node scripts/prune-backups.js --retain 30`.
- **سلامة البيانات**: `node scripts/restore-backup.js --id <timestamp>` للاختبار
  في بيئة الإعداد.
- **الفحص الأمني**: `npm audit` و `npm run security:scan` و
  `node scripts/check-vulnerabilities.js` في كل إصدار.

## 7. الاستجابة للحوادث

1. الكشف (مراقبة `/health` أو التنبيهات).
2. العزل (`kubectl cordon`، تعديلات القياس).
3. جمع السجلات والأحداث (`kubectl describe pod`).
4. الاستعادة من `backups/` في حالة مشاكل البيانات.
5. أبلغ المعنيين وسجّل مهام المتابعة في `docs/improvement-backlog.md`.

## 8. تقسية الأمان

- فرض HTTPS عبر ingress وتفعيل HSTS في إعدادات `security`.
- تقييد CORS باستخدام `CORS_ALLOWED_ORIGINS`.
- اضبط `RATE_LIMIT_MAX` و `RATE_LIMIT_WINDOW` كقيم صحيحة ≥ 1 لتفعيل التحديد وفق
  الطلبات.
- إعداد تنبيهات Prometheus (CPU > 70%، الذاكرة > 80%، تزايد الحد من المعدل).
- التأكد من أن CI ينفّذ `npm run build` وجميع الاختبارات.

## 9. استكشاف الأخطاء

| العرض               | التحقق                                      | الحل                                |
| ------------------- | ------------------------------------------- | ----------------------------------- |
| رسالة 400 Host      | تحقق من `ALLOWED_HOSTS`                     | أضف نطاق ingress أو نمطًا عامًا.    |
| رمز 503 صحة متدهورة | افحص `/health`                              | زِد الموارد أو عدّل `HEALTH_*`.     |
| فشل Stripe          | شغّل `cli.js billing:diagnostics`           | صحّح بيانات Stripe وأعد النشر.      |
| فقدان ملفات ثابتة   | راجع `STATIC_ROOT` وسجلات `serveStaticFile` | زامِن الأصول أو اضبط وحدات التخزين. |
| ارتفاع معدل الرفض   | راجع `/metrics`                             | ارفع `RATE_LIMIT_MAX` أو أضف CDN.   |

## 10. إدارة التغيير

- وثّق أي تغيير باستخدام معرف من `docs/improvement-backlog.md`.
- استخدم إستراتيجيات Blue/Green أو Canary (`maxUnavailable=0`, `maxSurge=1`).
- احفظ لقطات القياسات وأرفقها بملاحظات الإصدار.

حدّث هذا الدليل عند أي تعديل في الإعدادات أو البنية التحتية لضمان اتساق فرق
التشغيل.
