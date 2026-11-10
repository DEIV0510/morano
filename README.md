# Morano Europe — web corporativa y catálogo

Web de **MORANO EUROPE SL**, plataforma comercial europea de Morano Gruppo. *From the Palm to the World.*

Web **estática** (Astro): no tiene servidor, base de datos ni panel. Vercel la publica sola en cada `git push` a `main`.

- Español e inglés (`/es/` y `/en/`), fotos reales del grupo, ficha por producto.
- **Compra directa** de CPKO y PKE (500 g a 20 kg): carrito → el pedido se envía **por WhatsApp** con productos, cantidades y total estimado.
- **Cotización** y **contacto**: formularios que abren WhatsApp (+34 691 777 292) con el mensaje ya redactado.

## Cómo se edita

| Qué | Archivo |
| --- | --- |
| Productos, presentaciones y **precios** | [src/data/catalogo.ts](src/data/catalogo.ts) — `precio: null` = «Precio a consultar» |
| IVA, envío y datos legales (NIF, registro, correo público) | [src/data/ajustes.ts](src/data/ajustes.ts) |
| Textos de las secciones (ES/EN) | [src/lib/copy.ts](src/lib/copy.ts) |
| Textos de botones y formularios (ES/EN) | [src/lib/i18n.ts](src/lib/i18n.ts) |
| Teléfono de WhatsApp, Instagram, dirección | [src/lib/config.ts](src/lib/config.ts) |
| Fotos | `_material/fotos` → registrar en `scripts/build-images.mjs` → `npm run images` |

Después de editar: `npm test` (revisa el catálogo) y subir a GitHub. Vercel publica en 1–2 minutos.

## En local

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # genera dist/ (lo mismo que hace Vercel)
npm test           # comprueba catálogo, precios y ajustes
```

## Estructura

```
├─ vercel.json            Redirección / → /es/ y cabeceras de seguridad y caché
├─ public/                Fuentes, imágenes optimizadas, logotipos, favicons
├─ scripts/               Optimización de fotos y vectorización del logotipo
├─ src/
│  ├─ data/               catalogo.ts y ajustes.ts
│  ├─ components/         Secciones y piezas de la web
│  ├─ layouts/Base.astro  Plantilla común (SEO, cabecera, pie, WhatsApp)
│  ├─ pages/es · en       Páginas en cada idioma (productos y legales)
│  ├─ scripts/            JS del navegador: animaciones, carrito, formularios → WhatsApp
│  └─ styles/             Sistema de diseño
├─ tests/                 Prueba del catálogo
└─ _material/             Fotos y logotipo originales (el brief no se sube)
```

## Seguridad y rendimiento

Al no haber servidor, base de datos ni cuentas, no hay nada que atacar más allá de los archivos publicados. `vercel.json` añade cabeceras de seguridad (CSP sin scripts en línea, anti-clickjacking, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) y caché larga para imágenes y fuentes. Vercel sirve con HTTPS, compresión y CDN. Activar la verificación en dos pasos en GitHub y Vercel.

Rendimiento: imágenes AVIF/WebP responsivas, 3 pesos de fuente autoalojados (~10 KB c/u), ≈5 KB de JavaScript comprimido, sin librerías.

Más detalle: [docs/DISENO.md](docs/DISENO.md) (dirección de arte) y [docs/PENDIENTES.md](docs/PENDIENTES.md) (datos que faltan).

## WordPress (moranoeurope.com)

La misma web se publica en el WordPress de moranoeurope.com como plugin **Morano Europe — Web corporativa** (sirve `/es/` y `/en/`; no toca el tema, Elementor ni las demás páginas).

```bash
npm run wp         # compila y genera dist-wp/morano-europe-web.zip
```

Subir el ZIP en WordPress → Plugins → Añadir nuevo → Subir plugin → «Reemplazar la actual con la subida». En **Ajustes → Web Morano Europe** se elige vista previa (solo administradores) o publicada para todos. Desactivar el plugin devuelve la portada anterior.
