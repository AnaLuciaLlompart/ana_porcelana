import { useEffect, useState } from 'react'
import BotonAccion from './BotonAccion'

// Tres circulitos de radio 1: con el trazo de BotonAccion se ven llenos.
const ICONO_MAS_ACCIONES =
  'M4 12a1 1 0 102 0 1 1 0 10-2 0zm7 0a1 1 0 102 0 1 1 0 10-2 0zm7 0a1 1 0 102 0 1 1 0 10-2 0z'

const ALTO_ITEM = 40


// El botón ⋯ de "Más acciones": las acciones de una fila que no entran en
// sus cuatro iconos. Cada ítem es { texto, icono, onClick } y puede llevar
// deshabilitado y motivo, que va en el title, y color, para que Eliminar
// siga siendo rojo adentro del menú.
//
// La lista va con position: fixed, calculada desde el botón, y no
// absoluta: la tabla vive en una caja con overflowX: auto, que recortaría
// todo lo que se salga de ella. Abre hacia abajo, o hacia arriba si no
// entra. Se cierra con un clic afuera (una capa invisible, como el
// desplegable del catálogo), con Escape y al hacer scroll, porque la lista
// fija se quedaría donde estaba mientras la fila se mueve.
export default function MenuMasAcciones({ items }) {
  // null es cerrado; abierto guarda dónde se dibuja la lista.
  const [posicion, setPosicion] = useState(null)

  function abrir(evento) {
    const boton = evento.currentTarget.getBoundingClientRect()
    const altoLista = items.length * ALTO_ITEM + 12
    const entraAbajo = boton.bottom + 4 + altoLista <= window.innerHeight

    setPosicion({
      top: entraAbajo ? boton.bottom + 4 : undefined,
      bottom: entraAbajo ? undefined : window.innerHeight - boton.top + 4,
      right: window.innerWidth - boton.right,
    })
  }

  function cerrar() {
    setPosicion(null)
  }

  useEffect(() => {
    if (!posicion) return

    function alTeclear(evento) {
      if (evento.key === 'Escape') setPosicion(null)
    }
    function alMoverse() {
      setPosicion(null)
    }

    document.addEventListener('keydown', alTeclear)
    // true: el scroll de la caja de la tabla no sube hasta window, así que
    // se escucha en la fase de captura, que pasa por todos.
    window.addEventListener('scroll', alMoverse, true)
    window.addEventListener('resize', alMoverse)

    return () => {
      document.removeEventListener('keydown', alTeclear)
      window.removeEventListener('scroll', alMoverse, true)
      window.removeEventListener('resize', alMoverse)
    }
  }, [posicion])

  return (
    <>
      <BotonAccion
        onClick={(evento) => (posicion ? cerrar() : abrir(evento))}
        titulo="Más acciones"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_MAS_ACCIONES}
        tamanoIcono={22}
      />

      {posicion && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 92 }} />

          <div
            role="menu"
            style={{
              position: 'fixed',
              ...posicion,
              zIndex: 93,
              minWidth: 200,
              padding: 6,
              background: 'white',
              border: '1px solid #EBE0E2',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(61,50,56,.15)',
            }}
          >
            {items.map((item) => (
              <button
                key={item.texto}
                role="menuitem"
                onClick={() => {
                  cerrar()
                  item.onClick()
                }}
                disabled={item.deshabilitado}
                title={item.deshabilitado ? item.motivo : undefined}
                className="btn-reponer"
                style={{
                  width: '100%',
                  height: ALTO_ITEM,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 12px',
                  border: 0,
                  borderRadius: 5,
                  background: 'transparent',
                  cursor: item.deshabilitado ? 'default' : 'pointer',
                  opacity: item.deshabilitado ? 0.45 : undefined,
                  whiteSpace: 'nowrap',
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 14,
                  color: item.color || '#8C5A66',
                  textAlign: 'left',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icono} />
                </svg>
                {item.texto}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
