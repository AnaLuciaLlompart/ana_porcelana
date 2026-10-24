import { ANCHO_MAXIMO } from '../constantes'


// Los botones de abajo del recorrido del alta, del segundo paso en adelante,
// con los estilos del pie de PestanaDatos. Anterior lleva al paso de antes,
// también a Datos, que se reabre con el registro ya creado; en el último el
// botón principal termina el recorrido. pasos es la misma lista que BarraDePasos.
export default function PieDelRecorrido({ pasos, paso, onIr, onTerminar }) {
  const i = pasos.findIndex((p) => p.id === paso)
  const anterior = i > 0 ? pasos[i - 1] : null
  // En el último paso no hay siguiente: queda undefined.
  const siguiente = pasos[i + 1]

  return (
    <div
      className="ancho-pantalla"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
        maxWidth: ANCHO_MAXIMO,
      }}
    >
      {anterior && (
        <button
          onClick={() => onIr(anterior.id)}
          style={{
            padding: '10px 20px',
            border: '1px solid #EBE0E2',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Anterior
        </button>
      )}

      <button
        onClick={siguiente ? () => onIr(siguiente.id) : onTerminar}
        style={{
          padding: '10px 20px',
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
        {siguiente ? 'Siguiente' : 'Terminar'}
      </button>
    </div>
  )
}
