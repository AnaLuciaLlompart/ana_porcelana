// Uno de los dos chips de filtro, con su contador al lado.
//
// Vino de Clientes cuando Inicio pasó a ser la segunda pantalla que lo usa,
// para las etapas de EN PRODUCCIÓN.
export default function ChipFiltro({ label, cuenta, activo, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 15px',
        borderRadius: 20,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
        background: activo ? '#F0E2E4' : 'white',
        color: activo ? '#8C5A66' : '#857078',
      }}
    >
      {label}
      <span
        style={{
          minWidth: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
          borderRadius: 10,
          fontSize: 12,
          background: activo ? '#8C5A66' : '#F5F0F1',
          color: activo ? 'white' : '#857078',
        }}
      >
        {cuenta}
      </span>
    </button>
  )
}
