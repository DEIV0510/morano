# Dirección de arte — Morano Europe

## Concepto

**«Marcos que conectan».** El logotipo oficial de Morano Europe SL son cuatro rectángulos superpuestos y entrelazados (azul, dorado, gris y gris claro). Ese gesto —piezas distintas que encajan— es la idea de la plataforma: cultivo, planta, comercio y mercados unidos en una misma cadena. El sitio lo traduce a lenguaje gráfico:

- **Pantalla de carga**: los cuatro marcos se dibujan en el orden de capas del logo y aparece el nombre; la cortina sube hacia la portada. Solo la primera vez por sesión y sale en cuanto la foto principal está lista.
- **Marcos desplazados**: las fotografías clave llevan un marco dorado de 1 px desplazado, como los rectángulos del logo.
- **Máscaras rectangulares**: las fotos de la galería se revelan con un barrido de recorte rectangular.
- **Esquinas rectas** en todo el sistema: seriedad industrial.

## Logotipo

Reconstruido en vector a partir del logotipo oficial (archivo `_material/logo-oficial-morano-europe-sl.jpeg`, publicado en moranogruppo.com): marcos con la geometría medida (trazo 7/213) y el entrelazado original; letras vectorizadas del propio original (no se ha sustituido la tipografía). Versión negativa para fondos oscuros: solo el azul pasa a blanco. Scripts en `scripts/brand/`.

## Color (del logotipo)

| Token | Hex | Uso |
| --- | --- | --- |
| `--navy` | #0C2750 | Titulares, botones, marca |
| `--navy-950` | #050F22 | Fondos oscuros (operación, mapa, pie) |
| `--gold` | #CA9E31 | Detalles: líneas, índices, CTA del hero |
| `--gold-ink` | #8A6714 | Dorado oscurecido para texto pequeño sobre blanco (contraste AA) |
| `--gray` / `--gray-ink` | #7A7A7D / #55565A | Texto secundario |
| `--silver` | #CBCDD0 | Filetes y bordes |
| `--mist` / `--white` | #F3F4F5 / #FFFFFF | Fondos claros |

No se usan otros colores (el botón de WhatsApp es azul de marca con icono dorado, no verde).

## Tipografía

**Jost** (geométrica, de la familia de la Century Gothic del logotipo), autoalojada en tres pesos estáticos (300/400/500, ≈10 KB cada uno) con fuente de respaldo ajustada para evitar saltos. Titulares en mayúsculas con interletraje negativo; etiquetas en versalitas espaciadas; cifras tabulares.

## Composición por secciones (sin fórmula repetida)

1. **Hero**: foto industrial real a pantalla completa (dirección de arte distinta en móvil), titular en dos líneas, inserto con el origen (cultivo) en un marco dorado y barra de indicadores.
2. **Empresa**: texto a la izquierda, pareja de fotos superpuestas a la derecha, cifras animadas.
3. **Operación**: galería editorial asimétrica sobre azul profundo, seis categorías con índice.
4. **Productos**: dos módulos de compra grandes y una retícula de fichas técnicas para cotización.
5. **Servicios**: título fijo a la izquierda y lista numerada con iconos lineales propios.
6. **Colombia — Europa**: mapa de puntos (Natural Earth) con la ruta animada Colombia → Europa (punto en Madrid, sede) y ondas desde Europa para los mercados internacionales (sin inventar destinos).
7. **Contacto**: panel azul con datos oficiales y formulario.

## Movimiento

Entradas por scroll (desplazamiento + opacidad), máscaras en fotos, contadores, parallax suave del hero, ruta del mapa, microinteracciones en botones (barrido de fondo y flecha). Todo con `prefers-reduced-motion` respetado y red de seguridad: si el JS no carga, el contenido aparece igualmente.
