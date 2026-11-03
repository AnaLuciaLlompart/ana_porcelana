const ICONO_FLECHA = 'M9 5l7 7-7 7'


// El botón chico "Avanzar a Secado →" que va debajo del chip de una etapa,
// en Inicio y en la ficha del pedido (corrección del tutor: las etapas solo
// avanzan de a una, con confirmación). Solo dibuja: quien lo usa abre la
// confirmación y hace el pedido a la API.
//
// deshabilitado es opcional, como en BotonAccion: el botón queda en su
// lugar, apagado, y motivo va en el title para explicar por qué.
export default function BotonAvanzar({ texto, onClick, deshabilitado = false, motivo }) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      title={deshabilitado ? motivo : undefined}
      className="btn-reponer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        border: '1px solid #8C5A66',
        background: 'white',
        color: '#8C5A66',
        borderRadius: 6,
        cursor: deshabilitado ? 'default' : 'pointer',
        opacity: deshabilitado ? 0.45 : undefined,
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        whiteSpace: 'nowrap',
      }}
    >
      {texto}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
      </svg>
    </button>
  )
}
