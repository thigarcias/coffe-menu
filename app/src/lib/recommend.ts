import type { MenuItem } from '../types'

export type Want = 'quente' | 'gelada' | 'comer' | 'tanto-faz'
export type Taste = 'doce' | 'equilibrado' | 'forte'
export type Avoid = 'leite' | 'gluten' | 'cafeina'

export interface QuizAnswers {
  want: Want
  taste: Taste
  avoid: Avoid[]
}

export interface Suggestion {
  item: MenuItem
  score: number
  reasons: string[]
}

const hasAllergen = (item: MenuItem, word: string) =>
  (item.allergens ?? []).some((a) => a.toLowerCase().includes(word))

/**
 * Recomendação por regras sobre as etiquetas de cada item.
 * Filtra o que a pessoa quer evitar e pontua o resto pelo desejo e pelo paladar.
 */
export function recommend(items: MenuItem[], a: QuizAnswers, limit = 3): Suggestion[] {
  const out: Suggestion[] = []

  for (const item of items) {
    const t = item.tags
    if (a.avoid.includes('leite') && (t.milk || hasAllergen(item, 'lact') || hasAllergen(item, 'leite'))) continue
    if (a.avoid.includes('gluten') && hasAllergen(item, 'glút')) continue
    if (a.avoid.includes('gluten') && hasAllergen(item, 'glut')) continue
    if (a.avoid.includes('cafeina') && t.caffeine) continue

    let score = 0
    const reasons: string[] = []

    switch (a.want) {
      case 'quente':
        if (t.iced || t.hunger >= 2) continue
        score += 3
        reasons.push('quentinho')
        break
      case 'gelada':
        if (!t.iced || t.hunger >= 2) continue
        score += 3
        reasons.push('gelado')
        break
      case 'comer':
        if (t.hunger < 2) continue
        score += 2 + t.hunger
        reasons.push('mata a fome')
        break
      case 'tanto-faz':
        score += 1
    }

    switch (a.taste) {
      case 'doce':
        score += t.sweet * 2 - t.bitter
        if (t.sweet >= 2) reasons.push('docinho')
        break
      case 'equilibrado':
        score += 3 - Math.abs(t.sweet - 1.5) * 2 - Math.max(0, t.bitter - 2)
        if (t.milk) {
          score += 1
          reasons.push('suave, com leite')
        }
        break
      case 'forte':
        score += t.bitter * 2 - t.sweet
        if (t.bitter >= 2) reasons.push('café marcante')
        break
    }

    if (item.badges?.length) score += 0.5
    out.push({ item, score, reasons })
  }

  return out.sort((x, y) => y.score - x.score).slice(0, limit)
}
