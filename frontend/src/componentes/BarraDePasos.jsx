import { ANCHO_MAXIMO } from '../constantes'

const ICONO_TILDE = 'M5 13l4 4L19 7'


// La barra de arriba durante el recorrido del alta: el contenedor y el
// estilo de las pestañas, con el número del paso en el globito. Son botones
// apagados para que les llegue la regla .fila-pestanas > button de pantalla
// chica; se avanza solo con los botones del pie.
//
// pasos es la lista [{ id, label }] en el orden del recorrido, y el número
// de cada paso es su posición. conAnchoMaximo es opcional: con él la barra
// respeta el mismo tope que la fila de pestañas de la ficha de pedidos; sin
// él se dibuja como en productos, cuya fila no tiene tope.
export default function BarraDePasos({ pasos, pasoActual, conAnchoMaximo = false }) {
  const actual = pasos.findIndex((p) => p.id === pasoActual)

  return (
    <div
      className={conAnchoMaximo ? 'fila-pestanas ancho-pantalla' : 'fila-pestanas'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 20,
        borderBottom: '1px solid #EBE0E2',
        maxWidth: conAnchoMaximo ? ANCHO_MAXIMO : undefined,
      }}
    >
      {pasos.map((p, i) => {
        const activo = i === actual
        // Hecho es estar antes del actual: ningún paso es obligatorio, así
        // que no se mira si tiene algo cargado.
        const hecho = i < actual

        return (
          <button
            key={p.id}
            disabled
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '11px 18px',
              border: 0,
              borderBottom: `2px solid ${activo ? '#8C5A66' : 'transparent'}`,
              background: 'transparent',
              cursor: 'default',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: activo ? '#8C5A66' : '#857078',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                background: activo ? '#8C5A66' : hecho ? '#E8F5EF' : '#F0E2E4',
                color: activo ? 'white' : hecho ? '#4E8C6A' : '#8C5A66',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {hecho ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
                </svg>
              ) : (
                i + 1
              )}
            </span>

            {p.label}
          </button>
        )
      })}
    </div>
  )
}
