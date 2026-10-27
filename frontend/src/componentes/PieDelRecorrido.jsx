import { ANCHO_MAXIMO } from '../constantes'


const estiloSecundario = {
  padding: '10px 20px',
  border: '1px solid #EBE0E2',
  background: 'white',
  color: '#8C5A66',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 15,
}


// Los botones de abajo del recorrido del alta, con los estilos del pie de
// PestanaDatos: Cancelar, Anterior desde el segundo paso, y Siguiente, que
// en el último paso dice textoTerminar. pasos es la misma lista que
// BarraDePasos.
//
// onCancelar es opcional: sin él no hay Cancelar. ocupado apaga los tres
// botones mientras se crea el registro, y el principal muestra textoOcupado
// (el avance: "Subiendo foto 2 de 5…").
export default function PieDelRecorrido({
  pasos,
  paso,
  onIr,
  onCancelar,
  onTerminar,
  textoTerminar = 'Terminar',
  ocupado = false,
  textoOcupado = '',
}) {
  const i = pasos.findIndex((p) => p.id === paso)
  const anterior = i > 0 ? pasos[i - 1] : null
  // En el último paso no hay siguiente: queda undefined.
  const siguiente = pasos[i + 1]

  // En el celular los tres botones no entran en una fila: el pie envuelve y
  // ningún botón parte su texto.
  return (
    <div
      className="ancho-pantalla"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 20,
        maxWidth: ANCHO_MAXIMO,
      }}
    >
      {onCancelar && (
        <button
          onClick={onCancelar}
          disabled={ocupado}
          style={{
            ...estiloSecundario,
            cursor: ocupado ? 'default' : 'pointer',
            opacity: ocupado ? 0.5 : undefined,
          }}
        >
          Cancelar
        </button>
      )}

      {anterior && (
        <button
          onClick={() => onIr(anterior.id)}
          disabled={ocupado}
          style={{
            ...estiloSecundario,
            cursor: ocupado ? 'default' : 'pointer',
            opacity: ocupado ? 0.5 : undefined,
          }}
        >
          Anterior
        </button>
      )}

      <button
        onClick={siguiente ? () => onIr(siguiente.id) : onTerminar}
        disabled={ocupado}
        style={{
          padding: '10px 20px',
          border: 0,
          background: '#8C5A66',
          color: 'white',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          cursor: ocupado ? 'default' : 'pointer',
          opacity: ocupado ? 0.7 : undefined,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        {ocupado ? textoOcupado : siguiente ? 'Siguiente' : textoTerminar}
      </button>
    </div>
  )
}
