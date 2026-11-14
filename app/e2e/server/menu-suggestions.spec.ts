import { test, expect } from '@playwright/test'
import { suggestMenuDetails } from '../../server/menuSuggestions.mjs'

test('a sugestão aceita apenas etiquetas existentes e não confirma alérgenos', async () => {
  const result = await suggestMenuDetails({ name: 'Café', description: '', ingredients: ['leite'] }, [{ tags: [{ id: 'cafe', label: 'Café' }] }], async () => ({ labels: ['cafe', 'inexistente', 'cafe'], allergens: ['Leite', 'Leite'] }))
  expect(result).toEqual({ labels: ['cafe'], allergens: ['Leite'], allergensVerified: false })
})

test('rejeita dados de produto inválidos antes de chamar IA', async () => {
  let called = false
  await expect(suggestMenuDetails({ name: '', description: '', ingredients: [] }, [], async () => { called = true; return {} })).rejects.toThrow('Informe o nome')
  expect(called).toBe(false)
})

