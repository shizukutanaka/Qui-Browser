# Qui Browser संचालन गाइड (हिन्दी)

## लक्षित पाठक वर्ग

उत्पादन VR वातावरण में Qui Browser को परिनियोजित और बनाए रखने वाली संचालन एवं
SRE टीमों के लिए निर्देश।

## 1. परिनियोजन से पहले चेकलिस्ट

- **कंटेनर इमेज**: `docker build -t <registry>/qui-browser:<tag> .` तथा
  `npm run security:scan` से सुरक्षा परीक्षण।
- **पर्यावरण फ़ाइल**: `.env.example` को कॉपी करें, `your_*`, `changeme` जैसे
  placeholders हटाएँ और सीक्रेट को सुरक्षित स्टोर में रखें।
- **TLS प्रमाणपत्र**: Ingress या reverse proxy हेतु प्रमाणपत्र तैयार करें; देखें
  `k8s/ingress.yaml`।
- **बिलिंग कॉन्फ़िगरेशन**: `node ./cli.js billing:diagnostics` से Stripe
  कुंजियाँ व URL सत्यापित करें।
- **स्थैतिक संसाधन**: `npm run format:check` चलाकर precompressed फाइलों की
  अखंडता सुनिश्चित करें।

## 2. रनटाइम अपेक्षाएँ

- **एंट्री पॉइंट**: `server-lightweight.js` को `npm start` या
  `node ./cli.js start --port 8000` से चालू करें।
- **डिफ़ॉल्ट पोर्ट**: HTTP `8000`, WebSocket (`server-websocket.js`) सक्षम होने
  पर `8080`।
- **स्केलिंग मॉडल**: HTTP stateless; सत्र डेटा `data/` में JSON रूप में
  संग्रहीत। क्लस्टर वातावरण में shared storage/PVC उपयोग करें।

## 3. प्रमुख पर्यावरण चर

| चर                       | उद्देश्य                     | अनुशंसा                                                    |
| ------------------------ | ---------------------------- | ---------------------------------------------------------- |
| `PORT`                   | लिसनिंग पोर्ट                | `k8s/service.yaml` के अनुरूप।                              |
| `HOST`                   | बाइंड पता                    | कंटेनरों में `0.0.0.0`।                                    |
| `ALLOWED_HOSTS`          | Host हेडर whitelist          | Ingress डोमेन तक सीमित; wildcard (`.example.com`) समर्थित। |
| `TRUST_PROXY`            | `X-Forwarded-*` स्वीकार      | proxy के पीछे `true`।                                      |
| `STATIC_ROOT`            | स्थैतिक फाइल root            | डिफ़ॉल्ट `.`; आवश्यकतानुसार CDN माउंट।                     |
| `LIGHTWEIGHT`            | हल्का मोड                    | सीमित हार्डवेयर पर `true`।                                 |
| `BILLING_ADMIN_TOKEN`    | एडमिन टोकन                   | ≥16 अक्षर, त्रैमासिक रोटेशन।                               |
| `STRIPE_*`               | Stripe क्रेडेंशियल           | सुरक्षित vault में रखें।                                   |
| `DEFAULT_BILLING_LOCALE` | डिफ़ॉल्ट locale              | `config/pricing.js` के locale से मेल।                      |
| `LOG_LEVEL`              | भविष्य की लॉग ग्रैन्युलैरिटी | केंद्रीकृत लॉगिंग योजना।                                   |
| `HEALTH_*`               | स्वास्थ्य मॉनिटर थ्रेशोल्ड   | हार्डवेयर के अनुसार समायोजन।                               |

> टिप: रिलीज़ से पहले CI में `node ./cli.js billing:diagnostics` और
> `node scripts/check-vulnerabilities.js` चलाएँ।

## 4. परिनियोजन वर्कफ़्लो

### Docker Compose

```bash
cp .env.example .env
# पर्यावरण चर समायोजित
npm install
npm run build
# हल्का सर्वर प्रारंभ
npm start
```

### Kubernetes

1. इमेज को registry में push करें।
2. `k8s/deployment.yaml` में टेग व संसाधन अद्यतन करें।
3. `kubectl apply -f k8s/` से संसाधन लागू करें।
4. `kubectl rollout status deployment/qui-browser` से निगरानी।
5. `kubectl get svc qui-browser` से सेवा जाँच।

### रोलिंग अपडेट

- इमेज अपडेट:
  `kubectl set image deployment/qui-browser qui-browser=<registry>/qui-browser:<tag>`।
- हेल्थ जाँच: `kubectl get pods`, `kubectl logs -l app=qui-browser`।
- आवश्यक होने पर rollback: `kubectl rollout undo deployment/qui-browser`।

## 5. ऑब्ज़र्वेबिलिटी

- **स्वास्थ्य एंडपॉइंट**: `GET /health` स्थिति, uptime, संसाधन उपयोग, rate
  limiting काउंटर प्रदान करता है (`server-lightweight.js`)।
- **मेट्रिक्स**: `GET /metrics` समेकित आँकड़े लौटाता है; Prometheus
  `ServiceMonitor` (`k8s/servicemonitor.yaml`) से स्क्रैप करें।
- **लॉग**: `logs/` में संग्रहित; बाहरी ड्राइवर या बैकअप स्क्रिप्ट से प्रबंधन।
- **डैशबोर्ड**: `GET /dashboard` `utils/performance-dashboard.js` द्वारा HTML
  दृश्य उत्पन्न करता है।

## 6. नियमित रखरखाव

- **बैकअप** (`scripts/` में उपलब्ध):
  - `node scripts/list-backups.js`
  - `node scripts/verify-backup.js --latest`
  - `node scripts/prune-backups.js --retain 30`
- **रिस्टोर परीक्षण**: staging में
  `node scripts/restore-backup.js --id <timestamp>`।
- **सुरक्षा स्कैन**: प्रत्येक रिलीज़ में `npm audit`, `npm run security:scan`,
  `node scripts/check-vulnerabilities.js`।
- **प्रदर्शन बेंचमार्क**: `node scripts/benchmark.js --full`।

## 7. घटना प्रतिक्रिया

1. `/health` या मॉनिटरिंग अलर्ट से असामान्यता पहचानें।
2. प्रभावित pods अलग करें (`kubectl cordon` आदि)।
3. लॉग व Kubernetes इवेंट (`kubectl describe pod`) एकत्रित करें।
4. डेटा क्षति पर `backups/` से पुनर्स्थापना।
5. हितधारकों को सूचित करें और `docs/improvement-backlog.md` में follow-up दर्ज
   करें।

## 8. हार्डनिंग कदम

- Ingress के माध्यम से HTTPS लागू, `security` कॉन्फ़िगरेशन में HSTS सक्षम।
- `CORS_ALLOWED_ORIGINS` से origin सीमित।
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW` के मान सुरक्षित रखें।
- Prometheus अलर्ट (CPU > 70%, मेमोरी > 80%, rate limit spikes) कॉन्फ़िगर।
- CI पाइपलाइन में `npm run build` और टेस्ट सूट सुनिश्चित करें।

## 9. समस्या निवारण तालिका

| लक्षण                | जाँच                                       | समाधान                                 |
| -------------------- | ------------------------------------------ | -------------------------------------- |
| 400 Host अस्वीकार    | `ALLOWED_HOSTS` देखें                      | ingress डोमेन या wildcard जोड़ें।      |
| 503 स्वास्थ्य गिरावट | `/health` प्रतिक्रिया विश्लेषण             | संसाधन बढ़ाएँ या `HEALTH_*` समायोजित।  |
| Stripe त्रुटि        | `cli.js billing:diagnostics` चलाएँ         | क्रेडेंशियल सुधारें, पुनर्परिनियोजन।   |
| स्थिर फ़ाइल गायब     | `STATIC_ROOT`, `serveStaticFile` लॉग देखें | assets सिंक करें या volume जांचें।     |
| उच्च rate limiting   | `/metrics` जाँचें                          | `RATE_LIMIT_MAX` बढ़ाएँ या CDN अपनाएँ। |

## 10. परिवर्तन प्रबंधन

- हर बदलाव को `docs/improvement-backlog.md` की tracking ID के साथ दर्ज करें।
- Blue/Green या Canary रिलीज़ रणनीति (`maxUnavailable=0`, `maxSurge=1`) अपनाएँ।
- रिलीज़ के बाद मेट्रिक snapshots संग्रहीत कर release notes में शामिल करें।

किसी भी कॉन्फ़िगरेशन या संरचना परिवर्तन के साथ इस गाइड को अपडेट करें ताकि संचालन
टीमें संरेखित रहें।
