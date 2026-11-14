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


import { fillProductDetails } from '../../server/menuSuggestions.mjs'

test('preencher com IA: normaliza os campos, descarta etiqueta fora do catálogo e nunca confirma alérgeno', async () => {
  const groups = [{ tags: [{ id: 'cremoso', label: 'Cremoso' }, { id: 'doce', label: 'Doce' }] }]
  const result = await fillProductDetails({ brief: 'Latte de pistache com leite de aveia', name: '', description: '', ingredients: [] }, groups, async () => ({
    name: 'Latte de Pistache', description: 'Cremoso e doce.', lookalike: 'Parecido com um latte de avelã.', ingredients: ['café', 'pistache', 'café'], allergens: ['Castanhas', ' '],
    labels: ['cremoso', 'inventada'], new_labels: ['Pistache', 'cremoso', 'Verde', 'a'.repeat(50)], sweet: 2, bitter: 9, hunger: -1, milk: 'sim', iced: 'incerto', caffeine: 'nao',
  }))
  expect(result).toEqual({
    name: 'Latte de Pistache', description: 'Cremoso e doce.', lookalike: 'Parecido com um latte de avelã.', ingredients: ['café', 'pistache'], allergens: ['Castanhas'],
    labels: ['cremoso'], newLabels: ['Pistache', 'Verde'], tags: { sweet: '2', bitter: '', hunger: '', milk: 'true', iced: '', caffeine: 'false' }, allergensVerified: false,
  })
})

test('preencher com IA exige texto ou nome antes de chamar o modelo', async () => {
  let called = false
  await expect(fillProductDetails({ brief: '  ', name: '' }, [], async () => { called = true; return {} })).rejects.toThrow('Descreva o produto')
  expect(called).toBe(false)
})
