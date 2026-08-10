export const BABY_CATEGORIES = [
  { id: 'dormir',       label: 'Dormir',               icon: '🛏️' },
  { id: 'ropa',         label: 'Ropa',                  icon: '👕' },
  { id: 'higiene',      label: 'Higiene',               icon: '🧼' },
  { id: 'alimentacion', label: 'Alimentación',          icon: '🍼' },
  { id: 'transporte',   label: 'Transporte',            icon: '🚗' },
  { id: 'habitacion',   label: 'Habitación',            icon: '🏠' },
  { id: 'hospital',     label: 'Hospital / Nacimiento', icon: '🏥' },
  { id: 'mama',         label: 'Mamá',                  icon: '👩‍🍼' },
  { id: 'documentos',   label: 'Documentos / Trámites', icon: '📄' },
  { id: 'otros',        label: 'Otros',                 icon: '🧰' },
]

export const STATUSES = [
  { id: 'pendiente',    label: 'Pendiente',    color: '#8A8F85' },
  { id: 'por_comprar',  label: 'Por comprar',  color: '#D9A14B' },
  { id: 'comprado',     label: 'Comprado',     color: '#4C9A5B' },
  { id: 'no_necesario', label: 'No necesario', color: '#A0A0A0' },
  { id: 'para_despues', label: 'Para después', color: '#8B6BC4' },
]

export const PRIORITIES = [
  { id: 'esencial',   label: 'Esencial',   emoji: '🔴', color: '#C43B3B' },
  { id: 'importante', label: 'Importante', emoji: '🟡', color: '#D9A14B' },
  { id: 'opcional',   label: 'Opcional',   emoji: '🟢', color: '#4C9A5B' },
]

export const RESPONSIBLES = [
  { id: 'ambos',  label: 'Ambos' },
  { id: 'hanel',  label: 'Hanel' },
  { id: 'esposa', label: 'Esposa' },
]

export const CATEGORY_MAP = Object.fromEntries(BABY_CATEGORIES.map(c => [c.id, c]))
export const STATUS_MAP   = Object.fromEntries(STATUSES.map(s => [s.id, s]))
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]))

export const INITIAL_CHECKLIST = [
  { name: 'Cuna o moises',            category: 'dormir',       priority: 'esencial',   qty_needed: 1 },
  { name: 'Colchon para cuna',         category: 'dormir',       priority: 'esencial',   qty_needed: 1 },
  { name: 'Sabanas para cuna',         category: 'dormir',       priority: 'esencial',   qty_needed: 3 },
  { name: 'Mantas o cobertores',       category: 'dormir',       priority: 'importante', qty_needed: 2 },
  { name: 'Bodies manga corta 0-3m',   category: 'ropa',         priority: 'esencial',   qty_needed: 6 },
  { name: 'Bodies manga larga 0-3m',   category: 'ropa',         priority: 'esencial',   qty_needed: 4 },
  { name: 'Pijamas 0-3m',              category: 'ropa',         priority: 'esencial',   qty_needed: 4 },
  { name: 'Medias de bebe',            category: 'ropa',         priority: 'esencial',   qty_needed: 6 },
  { name: 'Gorros de recien nacido',   category: 'ropa',         priority: 'esencial',   qty_needed: 3 },
  { name: 'Ropa de salida',            category: 'ropa',         priority: 'importante', qty_needed: 2 },
  { name: 'Swaddles muselinas',        category: 'ropa',         priority: 'importante', qty_needed: 4 },
  { name: 'Panales recien nacido',     category: 'higiene',      priority: 'esencial',   qty_needed: 3 },
  { name: 'Toallitas humedas',         category: 'higiene',      priority: 'esencial',   qty_needed: 5 },
  { name: 'Crema para panal',          category: 'higiene',      priority: 'esencial',   qty_needed: 2 },
  { name: 'Jabon liquido bebe',        category: 'higiene',      priority: 'esencial',   qty_needed: 1 },
  { name: 'Shampoo de bebe',           category: 'higiene',      priority: 'esencial',   qty_needed: 1 },
  { name: 'Termometro digital',        category: 'higiene',      priority: 'esencial',   qty_needed: 1 },
  { name: 'Toallas de bano bebe',      category: 'higiene',      priority: 'esencial',   qty_needed: 3 },
  { name: 'Tina de bano',              category: 'higiene',      priority: 'importante', qty_needed: 1 },
  { name: 'Aspirador nasal',           category: 'higiene',      priority: 'importante', qty_needed: 1 },
  { name: 'Biberones',                 category: 'alimentacion', priority: 'esencial',   qty_needed: 4 },
  { name: 'Esterilizador',             category: 'alimentacion', priority: 'importante', qty_needed: 1 },
  { name: 'Extractor de leche',        category: 'alimentacion', priority: 'importante', qty_needed: 1 },
  { name: 'Baberos',                   category: 'alimentacion', priority: 'importante', qty_needed: 6 },
  { name: 'Cojin de lactancia',        category: 'alimentacion', priority: 'importante', qty_needed: 1 },
  { name: 'Car seat silla de auto',    category: 'transporte',   priority: 'esencial',   qty_needed: 1 },
  { name: 'Coche stroller',            category: 'transporte',   priority: 'esencial',   qty_needed: 1 },
  { name: 'Portabebe',                 category: 'transporte',   priority: 'opcional',   qty_needed: 1 },
  { name: 'Cambiador',                 category: 'habitacion',   priority: 'esencial',   qty_needed: 1 },
  { name: 'Monitor de bebe',           category: 'habitacion',   priority: 'importante', qty_needed: 1 },
  { name: 'Luz nocturna',              category: 'habitacion',   priority: 'importante', qty_needed: 1 },
  { name: 'Organizadores canastas',    category: 'habitacion',   priority: 'opcional',   qty_needed: 3 },
  { name: 'Bolso del bebe hospital',   category: 'hospital',     priority: 'esencial',   qty_needed: 1 },
  { name: 'Bolso de mama hospital',    category: 'hospital',     priority: 'esencial',   qty_needed: 1 },
  { name: 'Ropa llevar bebe a casa',   category: 'hospital',     priority: 'esencial',   qty_needed: 1 },
  { name: 'Ropa de maternidad',        category: 'mama',         priority: 'importante', qty_needed: 3 },
  { name: 'Sujetadores lactancia',     category: 'mama',         priority: 'importante', qty_needed: 3 },
  { name: 'Protectores lactancia',     category: 'mama',         priority: 'importante', qty_needed: 2 },
  { name: 'Registrar nacimiento',      category: 'documentos',   priority: 'esencial',   qty_needed: 1 },
  { name: 'Seguro medico del bebe',    category: 'documentos',   priority: 'esencial',   qty_needed: 1 },
  { name: 'Citas pediatricas',         category: 'documentos',   priority: 'esencial',   qty_needed: 1 },
]
