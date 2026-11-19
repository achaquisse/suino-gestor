import type { Pen, PenRole } from './database.types'

/** Pen roles with their default icon and colour (tile background is derived from the colour). */
export const PEN_ROLES: readonly { id: PenRole; label: string; icon: string; color: string }[] = [
  { id: 'maternidade', label: 'Maternidade', icon: 'child_care', color: '#B0306E' },
  { id: 'gestacao', label: 'Gestação', icon: 'favorite', color: '#C1579B' },
  { id: 'creche', label: 'Creche', icon: 'nest_eco_leaf', color: '#1F7894' },
  { id: 'recria', label: 'Recria', icon: 'trending_up', color: '#0F7A44' },
  { id: 'engorda', label: 'Engorda', icon: 'scale', color: '#4B3CD6' },
  { id: 'varrasco', label: 'Varrasco', icon: 'male', color: '#A2601A' },
  { id: 'quarentena', label: 'Quarentena', icon: 'shield', color: '#C77A1A' },
  { id: 'enfermaria', label: 'Enfermaria', icon: 'medical_services', color: '#C0302A' },
  { id: 'outro', label: 'Outro', icon: 'fence', color: '#55556A' },
]

/** Icons offered when overriding a pen's icon. */
export const PEN_ICONS = ['fence', 'child_care', 'favorite', 'nest_eco_leaf', 'trending_up', 'scale', 'male', 'female', 'shield',
  'medical_services', 'pets', 'grass', 'water_drop', 'warehouse', 'agriculture', 'home'] as const

export const roleOf = (id: PenRole) => PEN_ROLES.find((r) => r.id === id) ?? PEN_ROLES[PEN_ROLES.length - 1]

/** A light tint of a #RRGGBB colour, for tile backgrounds. */
export const tint = (hex: string, alpha = 0.14) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** [icon, background, foreground] for a pen: its own overrides, else its role's. */
export function penVisual(p: Pick<Pen, 'role' | 'color' | 'icon'>): readonly [icon: string, bg: string, fg: string] {
  const r = roleOf(p.role)
  const fg = p.color || r.color
  return [p.icon || r.icon, tint(fg), fg]
}

/** Free places, or Infinity when the pen has no capacity limit. */
export const freePlaces = (p: Pick<Pen, 'capacity'>, occupied: number) => (p.capacity == null ? Infinity : p.capacity - occupied)
export const capacityLabel = (p: Pick<Pen, 'capacity'>) => (p.capacity == null ? 'sem limite' : String(p.capacity))
