// ─────────────────────────────────────────────────────────────
// CATÁLOGO DE MORANO EUROPE — único lugar donde se editan productos,
// presentaciones y precios.
//
// - precio: euros por unidad, con o sin IVA según src/data/ajustes.ts.
//   null = «Precio a consultar»: no se puede añadir al carrito y el botón
//   abre la solicitud de cotización por WhatsApp.
// - kind: 'direct' (tienda) o 'quote' (bajo cotización).
// - photo: nombre de una foto de src/data/images.json (opcional).
// Fuentes de los textos: brief PAGINA-WEB.pdf y moranogruppo.com. No añadir
// especificaciones técnicas ni certificaciones que la empresa no haya documentado.
// Tras editar, subir a GitHub: Vercel publica los cambios solo.
// ─────────────────────────────────────────────────────────────

export interface Texto {
  es: string;
  en: string;
}

export interface Presentacion {
  sku: string;
  gramos: number;
  etiqueta: string;
  precio: number | null;
}

export interface ProductoDef {
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  name: Texto;
  subtitle: Texto;
  description: Texto;
  features: { es: string[]; en: string[] };
  applications: { es: string[]; en: string[] };
  photo?: string;
  presentaciones?: Presentacion[];
}

export const CATALOGO: ProductoDef[] = [
  {
    slug: 'cpko',
    code: 'CPKO',
    kind: 'direct',
    name: { es: 'Aceite crudo de palmiste', en: 'Crude Palm Kernel Oil' },
    subtitle: { es: 'Crude Palm Kernel Oil', en: 'Aceite crudo de palmiste' },
    description: { es: 'Aceite crudo extraído de la almendra del fruto de la palma, producido en la planta de beneficio del grupo en Colombia.', en: 'Crude oil extracted from the kernel of the palm fruit, produced at the group’s palm oil mill in Colombia.' },
    features: {
      es: ['Producto crudo, sin refinar', 'Origen: Colombia · Morano Oleo, Morano Gruppo', 'Presentaciones de 500 g, 1 kg, 2 kg, 5 kg y 20 kg', 'Ficha técnica disponible bajo solicitud'],
      en: ['Crude, unrefined product', 'Origin: Colombia · Morano Oleo, Morano Gruppo', 'Pack sizes: 500 g, 1 kg, 2 kg, 5 kg and 20 kg', 'Technical data sheet available on request'],
    },
    applications: {
      es: ['Industria alimentaria', 'Oleoquímica', 'Cosmética y cuidado personal', 'Jabones y detergentes'],
      en: ['Food industry', 'Oleochemicals', 'Cosmetics and personal care', 'Soaps and detergents'],
    },
    photo: 'muestra-aceite',
    // precio: euros por unidad (null = «Precio a consultar», no se puede comprar)
    presentaciones: [
      { sku: 'CPKO-500G', gramos: 500, etiqueta: '500 g', precio: null },
      { sku: 'CPKO-1KG', gramos: 1000, etiqueta: '1 kg', precio: null },
      { sku: 'CPKO-2KG', gramos: 2000, etiqueta: '2 kg', precio: null },
      { sku: 'CPKO-5KG', gramos: 5000, etiqueta: '5 kg', precio: null },
      { sku: 'CPKO-20KG', gramos: 20000, etiqueta: '20 kg', precio: null },
    ],
  },
  {
    slug: 'pke',
    code: 'PKE',
    kind: 'direct',
    name: { es: 'Torta de palmiste', en: 'Palm Kernel Expeller' },
    subtitle: { es: 'Palm Kernel Expeller', en: 'Torta de palmiste' },
    description: { es: 'Coproducto sólido de la extracción del aceite de palmiste, utilizado como ingrediente en alimentación animal.', en: 'Solid co-product of palm kernel oil extraction, used as an ingredient in animal feed.' },
    features: {
      es: ['Coproducto de la extracción de aceite de palmiste', 'Origen: Colombia · Morano Oleo, Morano Gruppo', 'Presentaciones de 500 g, 1 kg, 2 kg, 5 kg y 20 kg', 'Ficha técnica disponible bajo solicitud'],
      en: ['Co-product of palm kernel oil extraction', 'Origin: Colombia · Morano Oleo, Morano Gruppo', 'Pack sizes: 500 g, 1 kg, 2 kg, 5 kg and 20 kg', 'Technical data sheet available on request'],
    },
    applications: {
      es: ['Nutrición animal', 'Fabricantes de piensos'],
      en: ['Animal nutrition', 'Feed manufacturers'],
    },
    photo: 'ensacado-planta',
    // precio: euros por unidad (null = «Precio a consultar», no se puede comprar)
    presentaciones: [
      { sku: 'PKE-500G', gramos: 500, etiqueta: '500 g', precio: null },
      { sku: 'PKE-1KG', gramos: 1000, etiqueta: '1 kg', precio: null },
      { sku: 'PKE-2KG', gramos: 2000, etiqueta: '2 kg', precio: null },
      { sku: 'PKE-5KG', gramos: 5000, etiqueta: '5 kg', precio: null },
      { sku: 'PKE-20KG', gramos: 20000, etiqueta: '20 kg', precio: null },
    ],
  },
  {
    slug: 'cpo',
    code: 'CPO',
    kind: 'quote',
    name: { es: 'Aceite crudo de palma', en: 'Crude Palm Oil' },
    subtitle: { es: 'Crude Palm Oil', en: 'Aceite crudo de palma' },
    description: { es: 'Aceite crudo extraído del fruto de la palma. Materia prima para refinación, fraccionamiento y aplicaciones industriales.', en: 'Crude oil extracted from the palm fruit. Raw material for refining, fractionation and industrial applications.' },
    features: {
      es: ['Producto crudo, sin refinar', 'Extracción en la planta de beneficio del grupo', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Crude, unrefined product', 'Extracted at the group’s palm oil mill', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Refinación y fraccionamiento', 'Industria alimentaria', 'Oleoquímica', 'Biocombustibles'],
      en: ['Refining and fractionation', 'Food industry', 'Oleochemicals', 'Biofuels'],
    },
  },
  {
    slug: 'rbd-palm-oil',
    code: 'RBD PO',
    kind: 'quote',
    name: { es: 'Aceite de palma refinado', en: 'RBD Palm Oil' },
    subtitle: { es: 'RBD Palm Oil', en: 'Aceite de palma refinado' },
    description: { es: 'Aceite de palma refinado, blanqueado y desodorizado (RBD).', en: 'Refined, bleached and deodorised palm oil (RBD).' },
    features: {
      es: ['Refinado, blanqueado y desodorizado', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Refined, bleached and deodorised', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Fabricación de alimentos', 'Panadería y confitería', 'Oleoquímica'],
      en: ['Food manufacturing', 'Bakery and confectionery', 'Oleochemicals'],
    },
  },
  {
    slug: 'rbd-palm-olein',
    code: 'RBD POL',
    kind: 'quote',
    name: { es: 'Oleína de palma refinada', en: 'RBD Palm Olein' },
    subtitle: { es: 'RBD Palm Olein', en: 'Oleína de palma refinada' },
    description: { es: 'Fracción líquida del aceite de palma refinado.', en: 'Liquid fraction of refined palm oil.' },
    features: {
      es: ['Fracción líquida, de menor punto de fusión', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Liquid fraction with a lower melting point', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Fabricación de alimentos', 'Foodservice y cocinas profesionales', 'Aceites envasados'],
      en: ['Food manufacturing', 'Foodservice and professional kitchens', 'Packaged oils'],
    },
  },
  {
    slug: 'rbd-palm-stearin',
    code: 'RBD PS',
    kind: 'quote',
    name: { es: 'Estearina de palma refinada', en: 'RBD Palm Stearin' },
    subtitle: { es: 'RBD Palm Stearin', en: 'Estearina de palma refinada' },
    description: { es: 'Fracción sólida del aceite de palma refinado.', en: 'Solid fraction of refined palm oil.' },
    features: {
      es: ['Fracción sólida, de mayor punto de fusión', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Solid fraction with a higher melting point', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Grasas especiales y shortening', 'Margarinas', 'Oleoquímica', 'Jabones y detergentes'],
      en: ['Specialty fats and shortening', 'Margarines', 'Oleochemicals', 'Soaps and detergents'],
    },
  },
  {
    slug: 'rbd-palm-kernel-oil',
    code: 'RBD PKO',
    kind: 'quote',
    name: { es: 'Aceite de palmiste refinado', en: 'RBD Palm Kernel Oil' },
    subtitle: { es: 'RBD Palm Kernel Oil', en: 'Aceite de palmiste refinado' },
    description: { es: 'Aceite de palmiste refinado para aplicaciones alimentarias e industriales.', en: 'Refined palm kernel oil for food and industrial applications.' },
    features: {
      es: ['Refinado, blanqueado y desodorizado', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Refined, bleached and deodorised', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Fabricación de alimentos', 'Confitería', 'Cosmética y cuidado personal', 'Oleoquímica'],
      en: ['Food manufacturing', 'Confectionery', 'Cosmetics and personal care', 'Oleochemicals'],
    },
  },
  {
    slug: 'specialty-fats-shortening',
    code: 'SF',
    kind: 'quote',
    name: { es: 'Grasas especiales y shortening', en: 'Specialty Fats & Shortening' },
    subtitle: { es: 'Specialty Fats & Shortening', en: 'Grasas especiales y shortening' },
    description: { es: 'Shortenings, margarinas y grasas especiales para la fabricación de alimentos, elaborados en las empresas del grupo.', en: 'Shortenings, margarines and specialty fats for food manufacturing, produced by the group’s companies.' },
    features: {
      es: ['Fabricación en Famar, empresa de Morano Gruppo', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Manufactured by Famar, a Morano Gruppo company', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Panadería y pastelería', 'Confitería', 'Alimentos preparados', 'Foodservice'],
      en: ['Bakery and pastry', 'Confectionery', 'Prepared foods', 'Foodservice'],
    },
  },
  {
    slug: 'pfad',
    code: 'PFAD',
    kind: 'quote',
    name: { es: 'Destilado de ácidos grasos de palma', en: 'Palm Fatty Acid Distillate' },
    subtitle: { es: 'PFAD', en: 'PFAD' },
    description: { es: 'Coproducto de la refinación del aceite de palma, destinado a la transformación industrial.', en: 'Co-product of palm oil refining, intended for industrial processing.' },
    features: {
      es: ['Coproducto de la refinación', 'Formato y volumen según acuerdo comercial', 'Especificaciones bajo solicitud'],
      en: ['Refining co-product', 'Format and volume by commercial agreement', 'Specifications on request'],
    },
    applications: {
      es: ['Oleoquímica', 'Industria química', 'Jabones y detergentes', 'Biocombustibles'],
      en: ['Oleochemicals', 'Chemical industry', 'Soaps and detergents', 'Biofuels'],
    },
  },
  {
    slug: 'vegetable-oils',
    code: 'VO',
    kind: 'quote',
    name: { es: 'Aceites vegetales envasados', en: 'Packaged Vegetable Oils' },
    subtitle: { es: 'Vegetable Oils', en: 'Aceites vegetales' },
    description: { es: 'Aceites comestibles envasados en distintas presentaciones y formatos para distribución, retail y foodservice.', en: 'Edible oils packaged in different sizes and formats for distribution, retail and foodservice.' },
    features: {
      es: ['Envasado en empresas del grupo', 'Diversas presentaciones y formatos', 'Especificaciones bajo solicitud'],
      en: ['Packed by the group’s companies', 'Various pack sizes and formats', 'Specifications on request'],
    },
    applications: {
      es: ['Retail y gran distribución', 'Mayoristas y distribuidores', 'Foodservice'],
      en: ['Retail and large-scale distribution', 'Wholesalers and distributors', 'Foodservice'],
    },
  },
  {
    slug: 'private-label',
    code: 'PL',
    kind: 'quote',
    name: { es: 'Soluciones de marca privada', en: 'Private Label Solutions' },
    subtitle: { es: 'Private Label', en: 'Marca privada' },
    description: { es: 'Aceites y grasas fabricados y envasados con la marca del cliente.', en: 'Oils and fats manufactured and packed under the client’s own brand.' },
    features: {
      es: ['Definición de producto y especificación', 'Formatos de envase y apoyo en etiquetado', 'Documentación para el mercado europeo', 'Programas de suministro a largo plazo'],
      en: ['Product definition and specification', 'Packaging formats and labelling support', 'Documentation for the European market', 'Long-term supply programmes'],
    },
    applications: {
      es: ['Distribuidores', 'Cadenas de retail', 'Marcas de alimentación'],
      en: ['Distributors', 'Retail chains', 'Food brands'],
    },
  },
];
