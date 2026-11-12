import { useState, type CSSProperties } from 'react'

interface Props {
  src: string | null
  alt: string
  eager?: boolean
  className?: string
}

/**
 * Foto do produto inteira (sem corte) sobre um fundo feito da própria foto,
 * ampliada e desfocada. Assim o 9:16 fica preenchido com as cores da imagem.
 * A caixa da foto segue a proporção real dela, para a máscara esfumar
 * exatamente as bordas da foto e ela se fundir ao fundo.
 */
export function ProductImage({ src, alt, eager, className = '' }: Props) {
  const [ratio, setRatio] = useState(0.75)
  if (!src) return <div className={`pimg pimg--empty ${className}`} />
  const loading = eager ? 'eager' : 'lazy'
  return (
    <div className={`pimg ${className}`}>
      <img className="pimg__bg" src={src} alt="" aria-hidden loading={loading} />
      <div className="pimg__box">
        <img
          className="pimg__fg"
          src={src}
          alt={alt}
          loading={loading}
          style={{ '--ar': ratio } as CSSProperties}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget
            if (w && h) setRatio(w / h)
          }}
        />
      </div>
    </div>
  )
}
