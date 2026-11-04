// Catálogo inicial. Fuentes: brief PAGINA-WEB.pdf (productos, presentaciones),
// moranogruppo.com (Productos y soluciones, Morano Oleo, Famar) y la web actual
// moranoeurope.com. Sin precios (los fija el administrador), sin
// especificaciones técnicas ni certificaciones que no estén documentadas.

export interface SeedProduct {
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  name: [string, string];
  subtitle: [string, string];
  description: [string, string];
  features: [string[], string[]];
  applications: [string[], string[]];
  photo?: string;
}

const SIZES: { grams: number; label: string }[] = [
  { grams: 500, label: '500 g' },
  { grams: 1000, label: '1 kg' },
  { grams: 2000, label: '2 kg' },
  { grams: 5000, label: '5 kg' },
  { grams: 20000, label: '20 kg' },
];

export const DIRECT_SIZES = SIZES;

const specOnRequest: [string, string] = ['Ficha técnica disponible bajo solicitud', 'Technical data sheet available on request'];
const formatsByAgreement: [string, string] = ['Formato y volumen según acuerdo comercial', 'Format and volume by commercial agreement'];

const f = (...pairs: [string, string][]): [string[], string[]] => [pairs.map((p) => p[0]), pairs.map((p) => p[1])];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: 'cpko',
    code: 'CPKO',
    kind: 'direct',
    name: ['Aceite crudo de palmiste', 'Crude Palm Kernel Oil'],
    subtitle: ['Crude Palm Kernel Oil', 'Aceite crudo de palmiste'],
    description: [
      'Aceite crudo extraído de la almendra del fruto de la palma, producido en la planta de beneficio del grupo en Colombia.',
      'Crude oil extracted from the kernel of the palm fruit, produced at the group’s palm oil mill in Colombia.',
    ],
    features: f(
      ['Producto crudo, sin refinar', 'Crude, unrefined product'],
      ['Origen: Colombia · Morano Oleo, Morano Gruppo', 'Origin: Colombia · Morano Oleo, Morano Gruppo'],
      ['Presentaciones de 500 g, 1 kg, 2 kg, 5 kg y 20 kg', 'Pack sizes: 500 g, 1 kg, 2 kg, 5 kg and 20 kg'],
      specOnRequest
    ),
    applications: f(
      ['Industria alimentaria', 'Food industry'],
      ['Oleoquímica', 'Oleochemicals'],
      ['Cosmética y cuidado personal', 'Cosmetics and personal care'],
      ['Jabones y detergentes', 'Soaps and detergents']
    ),
    photo: 'muestra-aceite',
  },
  {
    slug: 'pke',
    code: 'PKE',
    kind: 'direct',
    name: ['Torta de palmiste', 'Palm Kernel Expeller'],
    subtitle: ['Palm Kernel Expeller', 'Torta de palmiste'],
    description: [
      'Coproducto sólido de la extracción del aceite de palmiste, utilizado como ingrediente en alimentación animal.',
      'Solid co-product of palm kernel oil extraction, used as an ingredient in animal feed.',
    ],
    features: f(
      ['Coproducto de la extracción de aceite de palmiste', 'Co-product of palm kernel oil extraction'],
      ['Origen: Colombia · Morano Oleo, Morano Gruppo', 'Origin: Colombia · Morano Oleo, Morano Gruppo'],
      ['Presentaciones de 500 g, 1 kg, 2 kg, 5 kg y 20 kg', 'Pack sizes: 500 g, 1 kg, 2 kg, 5 kg and 20 kg'],
      specOnRequest
    ),
    applications: f(['Nutrición animal', 'Animal nutrition'], ['Fabricantes de piensos', 'Feed manufacturers']),
    photo: 'ensacado-planta',
  },
  {
    slug: 'cpo',
    code: 'CPO',
    kind: 'quote',
    name: ['Aceite crudo de palma', 'Crude Palm Oil'],
    subtitle: ['Crude Palm Oil', 'Aceite crudo de palma'],
    description: [
      'Aceite crudo extraído del fruto de la palma. Materia prima para refinación, fraccionamiento y aplicaciones industriales.',
      'Crude oil extracted from the palm fruit. Raw material for refining, fractionation and industrial applications.',
    ],
    features: f(
      ['Producto crudo, sin refinar', 'Crude, unrefined product'],
      ['Extracción en la planta de beneficio del grupo', 'Extracted at the group’s palm oil mill'],
      formatsByAgreement,
      ['Especificaciones bajo solicitud', 'Specifications on request']
    ),
    applications: f(
      ['Refinación y fraccionamiento', 'Refining and fractionation'],
      ['Industria alimentaria', 'Food industry'],
      ['Oleoquímica', 'Oleochemicals'],
      ['Biocombustibles', 'Biofuels']
    ),
  },
  {
    slug: 'rbd-palm-oil',
    code: 'RBD PO',
    kind: 'quote',
    name: ['Aceite de palma refinado', 'RBD Palm Oil'],
    subtitle: ['RBD Palm Oil', 'Aceite de palma refinado'],
    description: [
      'Aceite de palma refinado, blanqueado y desodorizado (RBD).',
      'Refined, bleached and deodorised palm oil (RBD).',
    ],
    features: f(['Refinado, blanqueado y desodorizado', 'Refined, bleached and deodorised'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Fabricación de alimentos', 'Food manufacturing'], ['Panadería y confitería', 'Bakery and confectionery'], ['Oleoquímica', 'Oleochemicals']),
  },
  {
    slug: 'rbd-palm-olein',
    code: 'RBD POL',
    kind: 'quote',
    name: ['Oleína de palma refinada', 'RBD Palm Olein'],
    subtitle: ['RBD Palm Olein', 'Oleína de palma refinada'],
    description: ['Fracción líquida del aceite de palma refinado.', 'Liquid fraction of refined palm oil.'],
    features: f(['Fracción líquida, de menor punto de fusión', 'Liquid fraction with a lower melting point'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Fabricación de alimentos', 'Food manufacturing'], ['Foodservice y cocinas profesionales', 'Foodservice and professional kitchens'], ['Aceites envasados', 'Packaged oils']),
  },
  {
    slug: 'rbd-palm-stearin',
    code: 'RBD PS',
    kind: 'quote',
    name: ['Estearina de palma refinada', 'RBD Palm Stearin'],
    subtitle: ['RBD Palm Stearin', 'Estearina de palma refinada'],
    description: ['Fracción sólida del aceite de palma refinado.', 'Solid fraction of refined palm oil.'],
    features: f(['Fracción sólida, de mayor punto de fusión', 'Solid fraction with a higher melting point'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Grasas especiales y shortening', 'Specialty fats and shortening'], ['Margarinas', 'Margarines'], ['Oleoquímica', 'Oleochemicals'], ['Jabones y detergentes', 'Soaps and detergents']),
  },
  {
    slug: 'rbd-palm-kernel-oil',
    code: 'RBD PKO',
    kind: 'quote',
    name: ['Aceite de palmiste refinado', 'RBD Palm Kernel Oil'],
    subtitle: ['RBD Palm Kernel Oil', 'Aceite de palmiste refinado'],
    description: [
      'Aceite de palmiste refinado para aplicaciones alimentarias e industriales.',
      'Refined palm kernel oil for food and industrial applications.',
    ],
    features: f(['Refinado, blanqueado y desodorizado', 'Refined, bleached and deodorised'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Fabricación de alimentos', 'Food manufacturing'], ['Confitería', 'Confectionery'], ['Cosmética y cuidado personal', 'Cosmetics and personal care'], ['Oleoquímica', 'Oleochemicals']),
  },
  {
    slug: 'specialty-fats-shortening',
    code: 'SF',
    kind: 'quote',
    name: ['Grasas especiales y shortening', 'Specialty Fats & Shortening'],
    subtitle: ['Specialty Fats & Shortening', 'Grasas especiales y shortening'],
    description: [
      'Shortenings, margarinas y grasas especiales para la fabricación de alimentos, elaborados en las empresas del grupo.',
      'Shortenings, margarines and specialty fats for food manufacturing, produced by the group’s companies.',
    ],
    features: f(['Fabricación en Famar, empresa de Morano Gruppo', 'Manufactured by Famar, a Morano Gruppo company'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Panadería y pastelería', 'Bakery and pastry'], ['Confitería', 'Confectionery'], ['Alimentos preparados', 'Prepared foods'], ['Foodservice', 'Foodservice']),
  },
  {
    slug: 'pfad',
    code: 'PFAD',
    kind: 'quote',
    name: ['Destilado de ácidos grasos de palma', 'Palm Fatty Acid Distillate'],
    subtitle: ['PFAD', 'PFAD'],
    description: [
      'Coproducto de la refinación del aceite de palma, destinado a la transformación industrial.',
      'Co-product of palm oil refining, intended for industrial processing.',
    ],
    features: f(['Coproducto de la refinación', 'Refining co-product'], formatsByAgreement, ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Oleoquímica', 'Oleochemicals'], ['Industria química', 'Chemical industry'], ['Jabones y detergentes', 'Soaps and detergents'], ['Biocombustibles', 'Biofuels']),
  },
  {
    slug: 'vegetable-oils',
    code: 'VO',
    kind: 'quote',
    name: ['Aceites vegetales envasados', 'Packaged Vegetable Oils'],
    subtitle: ['Vegetable Oils', 'Aceites vegetales'],
    description: [
      'Aceites comestibles envasados en distintas presentaciones y formatos para distribución, retail y foodservice.',
      'Edible oils packaged in different sizes and formats for distribution, retail and foodservice.',
    ],
    features: f(['Envasado en empresas del grupo', 'Packed by the group’s companies'], ['Diversas presentaciones y formatos', 'Various pack sizes and formats'], ['Especificaciones bajo solicitud', 'Specifications on request']),
    applications: f(['Retail y gran distribución', 'Retail and large-scale distribution'], ['Mayoristas y distribuidores', 'Wholesalers and distributors'], ['Foodservice', 'Foodservice']),
  },
  {
    slug: 'private-label',
    code: 'PL',
    kind: 'quote',
    name: ['Soluciones de marca privada', 'Private Label Solutions'],
    subtitle: ['Private Label', 'Marca privada'],
    description: [
      'Aceites y grasas fabricados y envasados con la marca del cliente.',
      'Oils and fats manufactured and packed under the client’s own brand.',
    ],
    features: f(
      ['Definición de producto y especificación', 'Product definition and specification'],
      ['Formatos de envase y apoyo en etiquetado', 'Packaging formats and labelling support'],
      ['Documentación para el mercado europeo', 'Documentation for the European market'],
      ['Programas de suministro a largo plazo', 'Long-term supply programmes']
    ),
    applications: f(['Distribuidores', 'Distributors'], ['Cadenas de retail', 'Retail chains'], ['Marcas de alimentación', 'Food brands']),
  },
];
