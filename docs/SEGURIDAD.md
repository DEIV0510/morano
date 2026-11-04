# Seguridad — Morano Europe

Objetivo: defensa en profundidad frente a ataques habituales (inyección, XSS, CSRF, abuso de formularios, fraude en pagos y caídas por tráfico abusivo). **Ninguna web es invulnerable**; estas capas reducen el riesgo y su impacto, y requieren mantenimiento (actualizaciones, revisión de registros, copias probadas).

## 1. Superficie de ataque reducida

La web **no tiene panel administrativo, inicio de sesión ni cuentas de usuario**. No existen contraseñas que robar ni sesiones que secuestrar, y las rutas `/admin`, `/wp-admin` y similares devuelven 404. Productos, precios y ajustes se cambian en el código (`src/data/`), con control de versiones en GitHub; la gestión comercial se hace por correo y en el panel de Stripe, que tienen su propia autenticación (actívese la verificación en dos pasos en ambos).

## 2. Medidas implementadas en el código

| Riesgo | Medida |
| --- | --- |
| Inyección SQL | 100 % consultas parametrizadas (`src/lib/db.ts`). El catálogo no está en la base de datos. |
| XSS | Astro escapa toda salida; sin HTML de usuarios; correos con escape propio (probado); **CSP** `script-src 'self'` sin `unsafe-inline` ni `eval`; el JS del navegador construye HTML solo con valores escapados. |
| CSRF | `security.checkOrigin` de Astro (formularios) con `allowedDomains` derivado de `SITE_URL`, y verificación de `Origin`/`Sec-Fetch-Site` en las API JSON. |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| CORS | Sin cabeceras CORS: ningún otro origen puede leer las API. |
| Validación | Zod en el servidor para toda entrada (tipos, longitudes, formatos, países ISO, SKU, enteros en rango); eliminación de caracteres de control (evita inyección en cabeceras de correo). |
| Manipulación de precios | El navegador solo envía SKU y cantidad; importes, IVA y envío se calculan en el servidor; los campos de precio enviados se descartan. |
| Spam y bots | Campo trampa, token firmado con tiempo mínimo de rellenado (2,5 s) y caducidad (24 h), límite de enlaces y límites por IP. |
| Abuso / DoS de aplicación | Límites por IP y endpoint guardados en BD (sirven con varias instancias); límites de tamaño de cuerpo (32 KB en API); timeouts de petición y cabeceras en `server.mjs`. |
| Cabeceras de proxy | El Host se valida contra `security.allowedDomains`. Con `TRUST_PROXY=0`, `server.mjs` descarta `X-Forwarded-*`, `X-Real-IP` y `CF-Connecting-IP`: nadie puede falsear su IP para saltarse los límites. |
| Cabeceras de seguridad | CSP, HSTS (con HTTPS), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP`, `Origin-Agent-Cluster`. |
| Acceso a pedidos | Cada pedido solo se ve con su enlace privado (token aleatorio de 192 bits, guardado como hash) o con la sesión de Stripe asociada. Referencias no secuenciales. |

### Pagos

- Datos de tarjeta solo en Stripe Checkout (PCI DSS a cargo de Stripe); la web no los recibe ni los almacena.
- El pago se confirma **solo** con el webhook firmado (HMAC-SHA256, tolerancia 5 min); se comprueban importe y moneda frente al pedido guardado; eventos deduplicados por id; cambios de estado condicionados al estado anterior (sin carreras).
- Pedidos idempotentes (clave por checkout) e `Idempotency-Key` en cada llamada a Stripe.

### Datos y privacidad

- IPs seudonimizadas (HMAC con el secreto de la app); no se guarda la IP real.
- Logs estructurados con redacción automática de tokens, cookies, códigos y firmas; el log de correo no incluye destinatarios.
- Secretos solo en variables de entorno; `.env` excluido del repositorio (que es público); el navegador no recibe ninguna variable privada.
- Sin cookies de análisis ni de terceros en el sitio (no hace falta banner de consentimiento).

## 3. Infraestructura recomendada (configurar en el proveedor)

| Capa | Recomendación |
| --- | --- |
| HTTPS | Certificado automático (Cloudflare o Let's Encrypt vía Caddy). Redirección 80→443. `SITE_URL` con `https://`. |
| DDoS + WAF | **Cloudflare** delante: proxy activado, *Managed Rules*/OWASP, *Bot Fight Mode*, modo «Under Attack» disponible. Con Cloudflare/Caddy: `TRUST_PROXY=1` y Node escuchando solo en `127.0.0.1`. |
| Rate limiting en el borde | Regla Cloudflare: `/api/` 60 req/min por IP. Complementa los límites de la app. |
| Servidor | Usuario sin privilegios, cortafuegos (solo 22/80/443), SSH con clave, actualizaciones automáticas de seguridad del SO. |
| Permisos de BD | `data/morano.db` legible solo por el usuario del servicio (`chmod 600`). En Turso: token de la base concreta. |
| Cuentas externas | Verificación en dos pasos en GitHub, Stripe, el proveedor de correo, Cloudflare y el hosting. |
| Monitorización | Comprobación de disponibilidad (UptimeRobot/Better Stack) sobre `/es/`; alertas por `ALERT_EMAIL`; revisión de los logs del servicio. |

## 4. Copias de seguridad y recuperación

**VPS (SQLite):**

```bash
# copia diaria a las 03:15 con retención de 30 copias
15 3 * * *  cd /srv/morano/app && /usr/bin/npm run db:backup >> /var/log/morano-backup.log 2>&1
```

- Copiar además la carpeta `backups/` fuera del servidor (rclone a S3/Backblaze/Google Drive cifrado) a diario.
- **Restaurar**: detener el servicio → copiar `backups/morano-AAAA-MM-DD….db` a `data/morano.db` → borrar `data/morano.db-wal` y `-shm` → arrancar.
- Probar una restauración al menos cada trimestre.

**Turso:** copias automáticas con restauración a un punto en el tiempo (`turso db restore`).

**Código, catálogo y precios:** viven en el repositorio de GitHub (historial completo de cambios).

## 5. Plan de respuesta a incidentes

1. **Detectar**: alerta por correo, comportamiento anómalo, aviso de un cliente o de Stripe.
2. **Contener**: activar «Under Attack» en Cloudflare; si hay abuso de formularios, endurecer las reglas de rate limiting del borde.
3. **Rotar secretos**: claves de Stripe (y secreto del webhook), SMTP, token de BD, `APP_SECRET`, credenciales del servidor.
4. **Investigar**: logs del servidor, panel de Stripe, historial de GitHub.
5. **Recuperar**: restaurar la última copia sana si hubo alteración de datos; desplegar el commit conocido.
6. **Notificar**: si hay datos personales afectados, valorar con el asesor legal la notificación a la AEPD en 72 h (art. 33 RGPD) y a los afectados (art. 34).
7. **Aprender**: documentar causa y medidas; añadir una prueba que lo cubra.

## 6. Mantenimiento

- Dependabot (semanal) y CI con `npm audit` y pruebas en cada cambio (`.github/workflows/ci.yml`).
- Antes de cada despliegue: `npm audit --omit=dev`, `npx astro check`, `npm test`, pruebas HTTP.

## 7. Pruebas de seguridad incluidas

`tests/api/http-security.test.mjs` verifica contra el servidor real: cabeceras y CSP, ausencia de rutas de administración, CSRF desde otro origen (JSON y formularios), validación y límites de tamaño, precios no manipulables, pedidos de productos sin precio, antispam, contenido malicioso guardado como texto, límite por IP que no se evita falsificando `X-Forwarded-For`, rutas maliciosas (traversal, inyección, archivos internos) y SEO técnico. `tests/api/stripe-webhook.test.mjs` cubre firma, reenvío, importe incorrecto, pago pendiente y reembolso. `tests/unit/` cubre firmas, antispam, escape de correos, catálogo, importes y validación.
