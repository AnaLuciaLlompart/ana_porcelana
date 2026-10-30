import { useEffect, useRef } from 'react'

const ICONO_TILDE = 'M5 13l4 4L19 7'
const ICONO_ALERTA = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'


// El modal que avisa algo que ya pasó: un texto y Aceptar. Es hermano de
// ModalConfirmar, sin Cancelar porque no pregunta nada, y más angosto que
// los otros modales porque solo lleva una frase. Lo usan los seis listados
// (productos, pedidos, gastos, materiales, clientes y categorías) para
// confirmar el alta y la edición. Con error, el tilde verde pasa a ser un
// triángulo rojo: lo usa el listado de pedidos cuando el backend rechaza un
// cambio de estado, para que el motivo se vea esté donde esté la fila.
//
// No lleva la cabecera rosa de los demás modales: arriba va una franja
// verde (roja si es un error) con un círculo grande y el título, para que
// se lea como un aviso y no como un formulario. El botón sigue en rosa,
// porque el verde y el rojo son colores de estado y no de botón.
export default function ModalAviso({ titulo, texto, onCerrar, error = false }) {
  const circulo = useRef(null)
  const icono = useRef(null)

  const color = error ? '#C0442F' : '#4E8C6A'
  const fondo = error ? '#FAEAE8' : '#E8F5EF'

  // La misma entrada que el aviso flotante (Toast): el círculo aparece con
  // un pequeño salto y el icono se dibuja solo. pathLength="1" hace que el
  // trazo mida 1 sea cual sea el icono, así sirve para el tilde y el triángulo.
  useEffect(() => {
    circulo.current.animate(
      [
        { opacity: 0, transform: 'scale(.6)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 360, easing: 'cubic-bezier(.34, 1.56, .64, 1)' }
    )
    icono.current.animate(
      [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
      { duration: 350, delay: 200, easing: 'ease-out', fill: 'backwards' }
    )
  }, [])

  return (
    <div
      className="modal-fondo"
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,50,56,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100,
      }}
    >
      <div
        className="modal-caja"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 380,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '26px 20px 18px',
            background: fondo,
          }}
        >
          <span
            ref={circulo}
            style={{
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: color,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={error ? 2.2 : 2.6}>
              <path
                ref={icono}
                pathLength="1"
                strokeDasharray="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                d={error ? ICONO_ALERTA : ICONO_TILDE}
              />
            </svg>
          </span>

          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 18,
              color,
              textAlign: 'center',
            }}
          >
            {titulo}
          </h2>
        </div>

        <p
          style={{
            margin: 0,
            padding: '18px 24px 6px',
            fontSize: 15,
            color: '#3D3238',
            textAlign: 'center',
            textWrap: 'pretty',
          }}
        >
          {texto}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 16px' }}>
          <button
            onClick={onCerrar}
            style={{
              padding: '10px 18px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}
