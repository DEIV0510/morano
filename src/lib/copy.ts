// Textos corporativos por defecto (ES/EN), editables desde el panel en
// "Textos del sitio". Fuente: brief oficial PAGINA-WEB.pdf y moranogruppo.com.
// Regla: nada de cifras, certificaciones, rutas ni destinos no documentados.
import type { Locale } from './i18n.ts';

export interface CopyField {
  key: string;
  label: string; // etiqueta en el panel
  group: string;
  multiline?: boolean;
  es: string;
  en: string;
}

const F = (group: string, key: string, label: string, es: string, en: string, multiline = false): CopyField => ({
  group, key, label, es, en, multiline,
});

export const COPY: CopyField[] = [
  // Portada
  F('Portada', 'hero.line1', 'Titular · línea 1', 'FROM THE PALM', 'FROM THE PALM'),
  F('Portada', 'hero.line2', 'Titular · línea 2', 'TO THE WORLD.', 'TO THE WORLD.'),
  F('Portada', 'hero.subtitle', 'Texto complementario',
    'Conectamos la capacidad industrial colombiana con los mercados internacionales mediante soluciones de suministro fiables de aceites y grasas vegetales.',
    'Connecting Colombian industrial capacity with international markets through reliable supply solutions for vegetable oils and fats.', true),
  F('Portada', 'hero.ctaProducts', 'Botón productos', 'Explorar productos', 'Explore our products'),
  F('Portada', 'hero.trust1', 'Indicador 1', 'Más de 37 años de experiencia', '37+ years of experience'),
  F('Portada', 'hero.trust2', 'Indicador 2', 'Colombia — Europa', 'Colombia — Europe'),
  F('Portada', 'hero.trust3', 'Indicador 3', 'Suministro internacional', 'International supply'),
  F('Portada', 'hero.caption', 'Pie de foto principal', 'Planta de beneficio del grupo · Colombia', 'Group palm oil mill · Colombia'),
  F('Portada', 'hero.insetCaption', 'Pie de foto secundaria', 'Origen: cultivo de palma', 'Origin: palm plantation'),

  // Empresa
  F('Empresa', 'about.title1', 'Título · línea 1', 'EXPERIENCIA INDUSTRIAL.', 'INDUSTRIAL EXPERIENCE.'),
  F('Empresa', 'about.title2', 'Título · línea 2', 'VISIÓN INTERNACIONAL.', 'INTERNATIONAL VISION.'),
  F('Empresa', 'about.lead', 'Presentación',
    'Morano Europe es la plataforma comercial europea de Morano Gruppo y conecta más de 37 años de experiencia en aceites y grasas vegetales con los mercados internacionales.',
    'Morano Europe is the European commercial platform of Morano Gruppo, connecting more than 37 years of experience in vegetable oils and fats with international markets.', true),
  F('Empresa', 'about.body', 'Texto',
    'Unimos la capacidad productiva de Colombia con las necesidades de abastecimiento de distribuidores, fabricantes e industrias de todo el mundo.',
    'We connect Colombian production capabilities with the supply needs of distributors, manufacturers and industries worldwide.', true),
  F('Empresa', 'about.stat1', 'Dato 1', 'años de trayectoria en aceites y grasas vegetales', 'years of track record in vegetable oils and fats'),
  F('Empresa', 'about.stat2', 'Dato 2', 'empresas en Morano Gruppo: cultivo, extracción, refinación, envasado y comercio exterior',
    'companies in Morano Gruppo: cultivation, extraction, refining, packaging and foreign trade'),
  F('Empresa', 'about.stat3', 'Dato 3', 'líneas de producto en catálogo', 'product lines in our catalogue'),
  F('Empresa', 'about.stat4', 'Dato 4', 'Madrid, presencia comercial europea. Colombia, operaciones industriales.',
    'Madrid, European commercial presence. Colombia, industrial operations.'),

  // Operación
  F('Operación', 'ops.title', 'Título', 'NUESTRA OPERACIÓN INDUSTRIAL', 'OUR INDUSTRIAL OPERATION'),
  F('Operación', 'ops.intro', 'Introducción',
    'Fotografías reales de las operaciones del grupo en Colombia: del cultivo a la planta, de la toma de muestras al almacenamiento.',
    'Real photographs of the group’s operations in Colombia: from plantation to plant, from sampling to storage.', true),
  F('Operación', 'ops.1', 'Categoría 1', 'Personas en planta', 'People on site'),
  F('Operación', 'ops.2', 'Categoría 2', 'Extracción y transformación', 'Extraction and processing'),
  F('Operación', 'ops.3', 'Categoría 3', 'Maquinaria y equipos', 'Machinery and equipment'),
  F('Operación', 'ops.4', 'Categoría 4', 'Control y manipulación del producto', 'Product control and handling'),
  F('Operación', 'ops.5', 'Categoría 5', 'Almacenamiento y operaciones', 'Storage and operations'),
  F('Operación', 'ops.6', 'Categoría 6', 'Cultivo y origen de la materia prima', 'Plantation and raw material origin'),

  // Productos
  F('Productos', 'products.title', 'Título', 'PORTAFOLIO DE ACEITES, GRASAS Y DERIVADOS', 'OILS, FATS AND DERIVATIVES PORTFOLIO'),
  F('Productos', 'products.directIntro', 'Introducción compra directa',
    'Aceite crudo de palmiste y torta de palmiste en formatos de 500 g a 20 kg, con pedido online.',
    'Crude palm kernel oil and palm kernel expeller in 500 g to 20 kg formats, available to order online.', true),
  F('Productos', 'products.quoteIntro', 'Introducción cotización',
    'Volúmenes industriales y programas de suministro. Las especificaciones técnicas se facilitan por producto bajo solicitud.',
    'Industrial volumes and supply programmes. Technical specifications are provided per product on request.', true),

  // Servicios
  F('Servicios', 'services.title', 'Título', 'SERVICIOS PARA LA CADENA DE SUMINISTRO', 'SERVICES ACROSS THE SUPPLY CHAIN'),
  F('Servicios', 'services.note', 'Nota final', 'Cada cliente cuenta con atención y acompañamiento comercial personalizado.',
    'Every client receives personalised commercial support.'),
  F('Servicios', 'service.1.title', 'Servicio 1 · nombre', 'Comercialización internacional', 'International Trading'),
  F('Servicios', 'service.1.text', 'Servicio 1 · texto', 'Comercialización internacional de aceites y grasas vegetales, con el respaldo de la cadena productiva del grupo.',
    'International trading of vegetable oils and fats, backed by the group’s production chain.', true),
  F('Servicios', 'service.2.title', 'Servicio 2 · nombre', 'Suministro industrial', 'Industrial Supply'),
  F('Servicios', 'service.2.text', 'Servicio 2 · texto', 'Abastecimiento para fabricantes e industrias en volúmenes y formatos acordados.',
    'Supply for manufacturers and industries in agreed volumes and formats.', true),
  F('Servicios', 'service.3.title', 'Servicio 3 · nombre', 'Distribución', 'Distribution'),
  F('Servicios', 'service.3.text', 'Servicio 3 · texto', 'Distribución y suministro para mayoristas y distribuidores.',
    'Distribution and supply for wholesalers and distributors.', true),
  F('Servicios', 'service.4.title', 'Servicio 4 · nombre', 'Acuerdos estratégicos de suministro', 'Strategic Supply Agreements'),
  F('Servicios', 'service.4.text', 'Servicio 4 · texto', 'Desarrollo de acuerdos comerciales y programas de abastecimiento a medio y largo plazo.',
    'Commercial agreements and supply programmes built for the medium and long term.', true),
  F('Servicios', 'service.5.title', 'Servicio 5 · nombre', 'Marca privada', 'Private Label Solutions'),
  F('Servicios', 'service.5.text', 'Servicio 5 · texto', 'Aceites y grasas con la marca del cliente: producto, envase y etiquetado.',
    'Oils and fats under your brand: product, packaging and labelling.', true),
  F('Servicios', 'service.6.title', 'Servicio 6 · nombre', 'Coordinación logística y exportación', 'Export & Logistics Coordination'),
  F('Servicios', 'service.6.text', 'Servicio 6 · texto', 'Coordinación de la logística y de las operaciones de exportación desde el origen.',
    'Coordination of logistics and export operations from origin.', true),

  // Conexión
  F('Conexión', 'connection.title1', 'Título · línea 1', 'DEL ORIGEN COLOMBIANO', 'FROM COLOMBIAN ORIGINS'),
  F('Conexión', 'connection.title2', 'Título · línea 2', 'A LAS OPORTUNIDADES GLOBALES.', 'TO GLOBAL OPPORTUNITIES.'),
  F('Conexión', 'connection.colombia', 'Colombia',
    'Origen y capacidad industrial: cultivo, extracción, refinación y envasado en las empresas del grupo.',
    'Origin and industrial capacity: cultivation, extraction, refining and packaging across the group’s companies.', true),
  F('Conexión', 'connection.europe', 'Europa',
    'Plataforma comercial en Madrid: desarrollo de mercado, representación y relación con clientes.',
    'Commercial platform in Madrid: market development, representation and client relationships.', true),
  F('Conexión', 'connection.markets', 'Mercados internacionales',
    'Distribución y nuevas oportunidades de negocio para distribuidores, fabricantes e industrias.',
    'Distribution and new business opportunities for distributors, manufacturers and industries.', true),

  // Contacto
  F('Contacto', 'contact.title1', 'Título · línea 1', 'CONSTRUYAMOS UNA ALIANZA', 'LET’S BUILD A STRONGER'),
  F('Contacto', 'contact.title2', 'Título · línea 2', 'DE SUMINISTRO MÁS SÓLIDA.', 'SUPPLY PARTNERSHIP.'),
  F('Contacto', 'contact.intro', 'Introducción',
    'Cuéntenos qué producto, volumen y destino necesita. Nuestro equipo comercial le responderá.',
    'Tell us the product, volume and destination you need. Our commercial team will get back to you.', true),

  // Pie
  F('Pie de página', 'footer.description', 'Descripción',
    'Plataforma comercial europea de Morano Gruppo. Aceites y grasas vegetales de palma y palmiste para distribuidores, fabricantes e industrias.',
    'European commercial platform of Morano Gruppo. Palm and palm kernel vegetable oils and fats for distributors, manufacturers and industries.', true),
];

export const COPY_KEYS = new Set(COPY.map((c) => c.key));

export type CopyMap = Record<string, string>;

export function defaults(locale: Locale): CopyMap {
  return Object.fromEntries(COPY.map((c) => [c.key, c[locale]]));
}
