type P = { size?: number; filled?: boolean }

export const Grid = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
)

export const Reels = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="2.5" width="14" height="19" rx="3" />
    <path d="M10 9.5v5l4-2.5-4-2.5Z" fill="currentColor" />
  </svg>
)

export const Sparkle = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5Z" />
    <path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
  </svg>
)

export const Info = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" strokeLinecap="round" />
  </svg>
)

export const Close = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)


const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Bag = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M5.6 8.8h12.8l.9 10.2a2 2 0 0 1-2 2.2H6.7a2 2 0 0 1-2-2.2l.9-10.2Z" />
    <path d="M8.6 8.8V6.8a3.4 3.4 0 0 1 6.8 0v2" />
  </svg>
)

/** Sacola com "+": adicionar ao pedido. */
export const BagPlus = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M5.6 8.8h12.8l.9 10.2a2 2 0 0 1-2 2.2H6.7a2 2 0 0 1-2-2.2l.9-10.2Z" />
    <path d="M8.6 8.8V6.8a3.4 3.4 0 0 1 6.8 0v2" />
    <path d="M12 11.7v5.4M9.3 14.4h5.4" />
  </svg>
)

export const Plus = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
)

export const Minus = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M5.5 12h13" />
  </svg>
)

export const Trash = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M4.5 7h15M9.5 7V5.2c0-.7.6-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.5 7l.8 11.2c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8L17.5 7M10 11v5.5M14 11v5.5" />
  </svg>
)

export const Pencil = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M4.5 19.5l.9-3.9L16.3 4.7a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8.4 18.6l-3.9.9Z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
)

export const Check = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
