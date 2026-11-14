export const HEX: RegExp
export const MOODS: readonly string[]
export function rgb(h: string): number[]
export function toHex(c: number[]): string
export function mix(a: string, b: string, t: number): string
export function contrast(a: string, b: string): number
export function satLight(h: string): { sat: number; light: number }
export function ensureContrast(color: string, against: string[], min?: number): string
export function buildPalette(accent: string, secondary: string, mood?: string): { accent: string; secondary: string; background: string; soft: string }
