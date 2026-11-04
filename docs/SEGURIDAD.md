# Seguridad — Morano Europe

Objetivo: defensa en profundidad frente a ataques habituales (inyección, XSS, CSRF, robo de sesión, fuerza bruta, abuso de formularios, fraude en pagos y caídas por tráfico abusivo). **Ninguna web es invulnerable**; estas capas reducen el riesgo y su impacto, y requieren mantenimiento (actualizaciones, revisión de registros, copias probadas).

## 1. Medidas implementadas en el código

### Autenticación y autorización (`src/lib/auth.ts`, `src/lib/admin.ts`, `src/middleware.ts`)

| Medida | Detalle |
| --- | --- |
| Hash de contraseñas | scrypt N=2^17, r=8, p=1, sal aleatoria de 16 bytes, comparación en tiempo constante. Tiempo igualado para usuarios inexistentes (hash ficticio). |
| Política de contraseñas | ≥ 12 caracteres, 3 tipos de carácter, sin el correo ni palabras previsibles. Contraseña temporal obligatoria de cambiar en el primer acceso. |
| Sesiones | Token aleatorio de 256 bits en cookie; en BD solo su SHA-256. Caducidad absoluta 12 h e inactividad 2 h. Se invalidan al cambiar contraseña, rol o desactivar el usuario. |
| Cookie | `__Host-morano_admin`: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, sin dominio. |
| MFA | TOTP (RFC 6238) con secreto cifrado AES-256-GCM en BD y bloqueo de reutilización del mismo código. Restablecible solo por un administrador. |
| Fuerza bruta | 5 fallos → bloqueo de 15 min, progresivo hasta 2 h; límite de 20 intentos/15 min por IP y por cuenta; 6 intentos/5 min en MFA. Alerta por correo. |
| Autorización | Matriz de permisos por rol comprobada **en el servidor** en cada página y en cada acción POST (no basta ocultar botones). Siempre debe quedar un administrador activo. |
| Panel | Todas las rutas `/admin/*` exigen sesión en el middleware; `noindex`, `no-store`, excluido de robots y sitemap. |
| Cierre de sesión | Solo por POST con token CSRF; elimina la sesión en BD. |

### Protección de la aplicación

| Riesgo | Medida |
| --- | --- |
| Inyección SQL | 100 % consultas parametrizadas (`src/lib/db.ts`); búsquedas con `LIKE … ESCAPE` y comodines escapados. |
| XSS | Astro escapa toda salida; sin HTML de usuarios; correos con escape propio; **CSP** `script-src 'self'` sin `unsafe-inline` ni `eval`; JS del navegador construye HTML solo con valores escapados. |
| CSRF | `security.checkOrigin` de Astro (formularios), verificación de `Origin`/`Sec-Fetch-Site` en API JSON, token CSRF por sesión en cada formulario del panel y cookies `SameSite=Strict`. |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. |
| CORS | Sin cabeceras CORS: ningún otro origen puede leer las API. |
| Validación | Zod en el servidor para toda entrada (tipos, longitudes, formatos, países ISO, enteros en rango); eliminación de caracteres de control (evita inyección en cabeceras de correo). |
| Spam y bots | Campo trampa, token firmado con tiempo mínimo de rellenado (2,5 s) y caducidad (24 h), límite de enlaces y límites por IP. |
| Abuso / DoS de aplicación | Límites por IP y endpoint guardados en BD (sirven con varias instancias); límites de tamaño de cuerpo (32 KB en API, 12 MB global); timeouts de petición y cabeceras en `server.mjs`. |
| Subida de archivos | Solo JPG/PNG/WebP/AVIF validados por contenido real (no por extensión), ≤ 8 MB, ≤ 40 Mpx, sin SVG; re-codificación completa a WebP (elimina EXIF/GPS y cargas ocultas); servido con `Content-Type` fijo, `nosniff` y CSP `sandbox`. |
| Redirecciones abiertas | El parámetro `next` del login solo admite rutas internas `/admin…`. |
| Cabeceras de proxy | El Host se valida contra `security.allowedDomains` (derivado de `SITE_URL`). Con `TRUST_PROXY=0`, `server.mjs` descarta `X-Forwarded-*`, `X-Real-IP` y `CF-Connecting-IP`: nadie puede falsear su IP para saltarse los límites. |
| Cabeceras | CSP, HSTS (con HTTPS), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP`, `Origin-Agent-Cluster`. |

### Pagos

- Datos de tarjeta solo en Stripe Checkout (PCI DSS a cargo de Stripe); la web no los recibe ni los almacena.
- Importes, existencias, IVA y envío calculados en el servidor; los valores enviados por el navegador se descartan.
- El pago se confirma **solo** con el webhook firmado (HMAC-SHA256, tolerancia 5 min); se comprueban importe y moneda frente al pedido guardado; eventos deduplicados por id; cambios de estado condicionados al estado anterior (sin carreras).
- Pedidos idempotentes (clave por checkout) e `Idempotency-Key` en cada llamada a Stripe.

### Datos y privacidad

- IPs seudonimizadas (HMAC con el secreto de la app); no se guarda la IP real.
- Logs estructurados con redacción automática de contraseñas, tokens, cookies, códigos y firmas.
- Secretos solo en variables de entorno; `.env` excluido del repositorio; el navegador no recibe ninguna variable privada.
- Sin cookies de análisis ni de terceros en el sitio (no hace falta banner de consentimiento).

## 2. Infraestructura recomendada (configurar en el proveedor)

| Capa | Recomendación |
| --- | --- |
| HTTPS | Certificado automático (Cloudflare o Let's Encrypt vía Caddy). Redirección 80→443. `SITE_URL` con `https://`. |
| DDoS + WAF | **Cloudflare** delante (plan Free o Pro): proxy activado, *Managed Rules*/OWASP, *Bot Fight Mode*, modo «Under Attack» disponible. Con Cloudflare: `TRUST_PROXY=1` y cerrar el puerto de Node a todo salvo al proxy. |
| Rate limiting en el borde | Regla Cloudflare: `/admin/login` 10 req/min por IP; `/api/*` 60 req/min por IP. Complementa los límites de la app. |
| Servidor | Usuario sin privilegios, cortafuegos (solo 22/80/443), SSH con clave (sin contraseña), actualizaciones automáticas de seguridad del SO. |
| Permisos de BD | El archivo `data/morano.db` legible solo por el usuario del servicio (`chmod 600`). En Turso: token con permisos de la base concreta. |
| Monitorización | Comprobación de disponibilidad (UptimeRobot/Better Stack) sobre `/es/`; revisión semanal de **Panel → Actividad y correo**; alertas por `ALERT_EMAIL`. Opcional: enviar stdout a un servicio de logs. |

## 3. Copias de seguridad y recuperación

**VPS (SQLite):**

```bash
# copia diaria a las 03:15 con retención de 30 copias
15 3 * * *  cd /srv/morano && /usr/bin/npm run db:backup >> /var/log/morano-backup.log 2>&1
```

- Copiar además la carpeta `backups/` fuera del servidor (rclone a S3/Backblaze/Google Drive cifrado) a diario.
- **Restaurar**: detener el servicio → copiar `backups/morano-AAAA-MM-DD….db` a `data/morano.db` → borrar `data/morano.db-wal` y `-shm` → arrancar → comprobar el panel.
- Probar una restauración al menos cada trimestre.

**Turso:** copias automáticas con restauración a un punto en el tiempo desde su consola (`turso db restore`). Exportar además un volcado mensual.

**Código:** el repositorio de GitHub es la fuente; las imágenes subidas en el panel viven en la base de datos (incluidas en las copias).

## 4. Plan de respuesta a incidentes

1. **Detectar**: alerta por correo, comportamiento anómalo, aviso de un cliente o de Stripe.
2. **Contener**: activar «Under Attack» en Cloudflare; desactivar usuarios sospechosos en **Usuarios y roles**; si hay dudas sobre una sesión, borrar todas: `DELETE FROM sessions;`.
3. **Rotar secretos**: claves de Stripe (y secreto del webhook), SMTP, token de BD, `APP_SECRET` (obliga a reconfigurar MFA), contraseñas de administradores.
4. **Investigar**: **Actividad y correo** (accesos, cambios), logs del servidor, panel de Stripe.
5. **Recuperar**: restaurar la última copia sana si hubo alteración de datos; desplegar el commit conocido.
6. **Notificar**: si hay datos personales afectados, valorar con el asesor legal la notificación a la AEPD en 72 h (art. 33 RGPD) y a los afectados (art. 34).
7. **Aprender**: documentar causa y medidas; añadir una prueba que lo cubra.

## 5. Mantenimiento

- Dependabot (semanal) y CI con `npm audit` y pruebas en cada cambio (`.github/workflows/ci.yml`).
- Revisar mensualmente: usuarios activos y roles, MFA activado, registro de actividad, copias.
- Antes de cada despliegue: `npm audit --omit=dev`, `npx astro check`, `npm test`, pruebas HTTP.

## 6. Pruebas de seguridad incluidas

`tests/api/http-security.test.mjs` verifica contra el servidor real: cabeceras y CSP, rutas del panel sin sesión, CSRF desde otro origen, validación y límites de tamaño, precios no manipulables, antispam, XSS escapado en el panel, límite por IP que no se evita falsificando `X-Forwarded-For`, cookies de sesión, cierre de sesión, permisos por rol con peticiones forzadas, token CSRF del panel, bloqueo por fuerza bruta, rutas maliciosas (traversal, inyección) y SEO técnico. `tests/api/stripe-webhook.test.mjs` cubre firma, reenvío, importe incorrecto, pago pendiente y reembolso.
