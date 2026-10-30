import { useEffect, useRef } from 'react'

const ICONO_TILDE = 'M5 13l4 4L19 7'

// Lo que mide el trazo del tilde (dos segmentos de 5,7 y 14,1). Sirve para
// dibujarlo de a poco: se arranca con el trazo corrido entero y se lo trae.
const LARGO_TILDE = 20

// La posición de siempre: centrado en la pantalla. La animación la repite
// porque, al animar transform, pisa la que está en el estilo.
const CENTRADO = 'translate(-50%, -50%)'


// accion y onAccion son opcionales. Si llega accion, el aviso lleva al final
// un botón con ese texto, que al tocarlo llama a onAccion: hoy es el
// «Deshacer» de la ficha de un gasto. Sin ellos se dibuja exactamente igual
// que siempre, que es como lo usan las demás pantallas.
export default function Toast({ texto, accion, onAccion }) {
  const caja = useRef(null)
  const tilde = useRef(null)

  // Cada aviso nuevo entra con un pequeño salto y el tilde se dibuja solo.
  // element.animate() es la API de animaciones del navegador: anima sin
  // tocar el estado de React ni index.css. Depende de texto para que un
  // aviso que llega con el anterior todavía a la vista también se anime.
  useEffect(() => {
    caja.current.animate(
      [
        { opacity: 0, transform: `${CENTRADO} scale(.85)` },
        { opacity: 1, transform: `${CENTRADO} scale(1)` },
      ],
      { duration: 320, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
    )
    tilde.current.animate(
      [{ strokeDashoffset: LARGO_TILDE }, { strokeDashoffset: 0 }],
      { duration: 300, delay: 160, easing: 'ease-out', fill: 'backwards' }
    )
  }, [texto])

  return (
    <div
      ref={caja}
      role="status"
      className="toast"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: CENTRADO,
        zIndex: 120,
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 22px',
        borderRadius: 10,
        background: '#E8F5EF',
        border: '1px solid #4E8C6A',
        boxShadow: '0 12px 32px rgba(61,50,56,.18)',
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: '#4E8C6A',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6">
          <path
            ref={tilde}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LARGO_TILDE}
            d={ICONO_TILDE}
          />
        </svg>
      </span>

      <span
        style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 16,
          color: '#4E8C6A',
          textWrap: 'pretty',
        }}
      >
        {texto}
      </span>

      {accion && (
        <button
          onClick={onAccion}
          style={{
            flexShrink: 0,
            marginLeft: 4,
            padding: '6px 14px',
            border: '1px solid #4E8C6A',
            background: 'white',
            color: '#4E8C6A',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {accion}
        </button>
      )}
    </div>
  )
}
