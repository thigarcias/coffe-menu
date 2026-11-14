import { useMemo } from 'react'
import { normalizePlan, resolveBlock } from '../../../shared/blocks.mjs'
import { BlockView } from '../chat/Blocks'
import type { Block } from '../chat/types'
import type { BlockSpec, Span } from './model'

/**
 * Bloco criado pela IA e salvo no painel. Só a receita fica guardada: os números saem do
 * motor a cada abertura, então acompanham o período e nunca ficam velhos.
 */
export function SpecCard({ spec, span, wrapped }: { spec: BlockSpec; span: Span; wrapped?: boolean }) {
  const block = useMemo<Block | null>(() => {
    try {
      const [clean] = normalizePlan({ blocks: [spec] })
      return clean ? resolveBlock(clean).block : null
    } catch {
      return null // receita que o motor não entende mais: o cartão avisa em vez de quebrar a página
    }
  }, [spec])

  return (
    <div className={`adm-pin adm-s${span}${wrapped ? ' is-wrapped' : ''}`}>
      {block ? (
        <BlockView block={block} />
      ) : (
        <section className="adm-bk">
          <p className="adm-pin__gone">Este bloco não está disponível agora. Dá para tirá-lo em Personalizar.</p>
        </section>
      )}
    </div>
  )
}
