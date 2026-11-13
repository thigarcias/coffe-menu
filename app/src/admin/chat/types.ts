/**
 * Modelo das conversas com a IA do painel.
 *
 * Um "bloco" é uma peça de interface que a IA pode pôr numa resposta. Os blocos já chegam
 * com os DADOS resolvidos: a IA pede uma consulta, o servidor calcula, e o que chega aqui
 * são os números prontos. A IA nunca escreve número nem código. Quando a IA de verdade
 * entrar, ela devolve estes mesmos formatos.
 */
export type Block =
  | { type: 'text'; text: string }
  | { type: 'kpis'; title?: string; items: { label: string; value: string; note?: string }[] }
  | {
      type: 'line'
      title: string
      subtitle?: string
      labels: string[]
      tips: string[]
      current: number[]
      previous: number[]
      currentName: string
      previousName: string
      format: 'money' | 'number'
    }
  | { type: 'bars'; title: string; subtitle?: string; rows: { label: string; value: number; figure: string; note?: string }[] }
  | { type: 'funnel'; title: string; steps: { label: string; hint: string; value: number }[] }
  | { type: 'heat'; title: string; subtitle?: string; hours: number[]; rows: { label: string; cells: number[] }[] }
  | { type: 'table'; title: string; columns: string[]; rows: string[][] }

export type MessageState = 'streaming' | 'done' | 'interrupted' | 'stopped' | 'error'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  blocks: Block[]
  state: MessageState
  /** o que a IA está fazendo agora ("Consultando as vendas…"), só enquanto gera */
  status?: string
}

export type SessionStatus = 'idle' | 'running' | 'interrupted' | 'error'

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  status: SessionStatus
  /** guia (aba do navegador) que está rodando a resposta, e o último sinal de vida dela */
  owner?: string
  pulse?: number
  messages: Message[]
}
