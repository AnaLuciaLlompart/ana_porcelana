import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { INSTAGRAM_URL, INSTAGRAM_USUARIO } from '../../constantes'
import IconoInstagram from '../../componentes/IconoInstagram'
import CajaMensaje from './CajaMensaje'
import { textoDelMensaje } from './seleccion'
import {
  ICONO_COPIAR,
  ICONO_CORAZON,
  ICONO_VOLVER,
  QUICKSAND,
  TEXTOS_SELECCION_VACIA,
} from './presentacion'

// La pantalla /mensaje: generar el mensaje de consulta (CU70).
//
// El mensaje se arma en cada dibujo a partir de la selección; no se guarda
// en ningún lado. Instagram no deja abrir un chat con un texto ya escrito,
// así que el camino es copiar el mensaje acá y pegarlo allá: por eso los
// dos botones.

export default function Mensaje() {
  const { seleccion, mostrarAviso } = useOutletContext()
  // Si ya se copió, el botón lo dice. Es estado local: al salir de la
  // pantalla vuelve a "Copiar mensaje".
  const [copiado, setCopiado] = useState(false)

  if (seleccion.items.length === 0) {
    return <CajaMensaje icono={ICONO_CORAZON} {...TEXTOS_SELECCION_VACIA} principal />
  }

  const texto = textoDelMensaje(seleccion.items, seleccion.aclaraciones)

  // navigator.clipboard existe solo en https y en localhost. Si no está, o
  // si el navegador no deja copiar, la vista previa se puede seleccionar y
  // copiar a mano, y el aviso lo dice. El diseño marca "Copiado" aunque
  // falle; acá solo cuando se copió de verdad.
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      mostrarAviso('Mensaje copiado')
    } catch {
      mostrarAviso('No se pudo copiar: seleccioná el texto y copialo a mano')
    }
  }

  return (
    <section>
      <Link
        to="/seleccion"
        className="catalogo-subrayado"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 16,
          textDecoration: 'none',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 15,
          color: '#5A7A8C',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_VOLVER} />
        </svg>
        Volver
      </Link>

      <h1 style={{ margin: '0 0 6px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 32, color: '#5A7A8C' }}>
        Tu mensaje está listo
      </h1>
      <p style={{ margin: '0 0 22px', fontSize: 15, color: '#708085', textWrap: 'pretty' }}>
        Copialo y pegalo en el chat de Instagram con @{INSTAGRAM_USUARIO}.
      </p>

      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'white', border: '1px solid #E0E8EB', borderRadius: 8, padding: 20 }}>
          <p
            style={{
              margin: '0 0 12px',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '.06em',
              color: '#708085',
            }}
          >
            VISTA PREVIA
          </p>
          {/* pre-wrap respeta los saltos de línea del texto y además lo
              parte si no entra en el ancho. El texto se puede seleccionar
              con el mouse, para copiarlo a mano si hace falta. */}
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: "'Nunito Sans', sans-serif",
              fontSize: 15,
              lineHeight: 1.6,
              color: '#323A3D',
            }}
          >
            {texto}
          </pre>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={copiar}
            className="catalogo-suave"
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
              padding: '12px 18px',
              border: '1px solid #5A7A8C',
              background: 'white',
              color: '#5A7A8C',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_COPIAR} />
            </svg>
            {copiado ? 'Copiado' : 'Copiar mensaje'}
          </button>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="catalogo-relleno"
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
              padding: '12px 18px',
              background: '#5A7A8C',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <IconoInstagram lado={18} />
            Abrir Instagram
          </a>
        </div>
      </div>
    </section>
  )
}
