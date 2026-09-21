const ICONO_TILDE = 'M5 13l4 4L19 7'


// accion y onAccion son opcionales. Si llega accion, el aviso lleva al final
// un botón con ese texto, que al tocarlo llama a onAccion: hoy es el
// «Deshacer» de la ficha de un gasto. Sin ellos se dibuja exactamente igual
// que siempre, que es como lo usan las demás pantallas.
export default function Toast({ texto, accion, onAccion }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '11px 20px',
        borderRadius: 24,
        background: '#E8F5EF',
        border: '1px solid #4E8C6A',
        boxShadow: '0 4px 12px rgba(61,50,56,.12)',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4E8C6A" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
      </svg>
      <span
        style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 15,
          color: '#4E8C6A',
        }}
      >
        {texto}
      </span>

      {accion && (
        <button
          onClick={onAccion}
          style={{
            marginLeft: 4,
            padding: '4px 12px',
            border: '1px solid #4E8C6A',
            background: 'white',
            color: '#4E8C6A',
            borderRadius: 14,
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
