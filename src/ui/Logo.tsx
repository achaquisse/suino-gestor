import { useId } from 'react'

/** Suino Gestor app mark: a white pig face on the brand gradient tile. Keep in sync with public/favicon.svg. */
export function Logo({ size = 42, className, title }: { size?: number; className?: string; title?: string }) {
  const g = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset=".55" stopColor="#5B4CF5" />
          <stop offset="1" stopColor="#22B8F0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${g})`} />
      <PigFace />
    </svg>
  )
}

/** The pig alone (64×64 coordinate space), for placing on any background. */
export function PigFace({ className }: { className?: string }) {
  return (
    <g className={className}>
      <path d="M14.5 27C12.6 19.5 13.6 13.4 16.6 11.6c4 .9 8.6 4.6 11 9.4z" fill="#fff" />
      <path d="M49.5 27c1.9-7.5.9-13.6-2.1-15.4-4 .9-8.6 4.6-11 9.4z" fill="#fff" />
      <path d="M17 22.5c-.6-3.6-.2-6.4.9-7.6 2.2.7 4.6 2.6 6 5z" fill="#E4DEFF" />
      <path d="M47 22.5c.6-3.6.2-6.4-.9-7.6-2.2.7-4.6 2.6-6 5z" fill="#E4DEFF" />
      <ellipse cx="32" cy="35.5" rx="19.5" ry="17" fill="#fff" />
      <circle cx="19.5" cy="40" r="3" fill="#FFC9DE" />
      <circle cx="44.5" cy="40" r="3" fill="#FFC9DE" />
      <g className="pig-eyes">
        <circle cx="24.5" cy="31" r="2.4" fill="#2B2470" />
        <circle cx="39.5" cy="31" r="2.4" fill="#2B2470" />
      </g>
      <ellipse cx="32" cy="41" rx="8.5" ry="6" fill="#E4DEFF" />
      <ellipse cx="29" cy="41" rx="1.6" ry="2.4" fill="#5B4CF0" />
      <ellipse cx="35" cy="41" rx="1.6" ry="2.4" fill="#5B4CF0" />
    </g>
  )
}
