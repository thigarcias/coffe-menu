// Teste de verdade da IA do chat do painel (chama o GPT-6 Luna). Uso:
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt OPENAI_API_KEY=proxy-injected node scripts/chat-smoke.mjs ["pergunta 1" "pergunta 2" ...]
// (na nuvem do Claude o proxy injeta a chave; na máquina do usuário basta a OPENAI_API_KEY do .env)
import { runAdminChat } from '../server/adminChat.mjs'

try { process.loadEnvFile(new URL('../.env', import.meta.url)) } catch { /* sem .env */ }

const DEFAULT = [
  'Como foram as vendas dos últimos 7 dias comparado com a semana anterior?',
  'Crie para mim um script em Python que faz um scraper de preços',
  'Qual a capital da França?',
]
const prompts = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT

async function one(prompt) {
  const t0 = Date.now()
  const events = []
  await runAdminChat({ prompt, history: [], emit: (e) => events.push(e), log: (m) => events.push({ type: 'log', text: m }) }).catch((e) => events.push({ type: 'error', message: e.message }))
  return { prompt, ms: Date.now() - t0, events }
}

const results = await Promise.all(prompts.map(one))
for (const r of results) {
  console.log(`\n=== ${r.prompt}  (${(r.ms / 1000).toFixed(1)} s)`)
  for (const e of r.events) {
    if (e.type === 'status') continue
    if (e.type === 'text') console.log('  [texto]', e.text)
    else if (e.type === 'suggest') console.log('  [sugestões]', e.items.join(' | '))
    else if (e.type === 'plan') console.log('  [plano]', e.plan.blocks.map((b) => `${b.type}(${b.metric ?? b.metrics.join('+')}/${b.group_by ?? '-'}/${b.period}${b.compare ? '/comp' : ''})`).join(', '))
    else if (e.type === 'log' || e.type === 'error' || e.type === 'done') console.log(`  [${e.type}]`, e.text ?? e.message ?? '')
    else console.log(`  [bloco ${e.type}]`, e.title ?? '', e.rows ? `${e.rows.length} linhas` : '')
  }
}
