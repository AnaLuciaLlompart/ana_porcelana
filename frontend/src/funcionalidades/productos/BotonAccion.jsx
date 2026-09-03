// El botón cuadrado con icono que usan la tarjeta, la tabla y la
// sección de dados de baja.

export default function BotonAccion({ onClick, titulo, color, hover, icono, lado = 36 }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className="btn-accion"
      style={{
        width: lado,
        height: lado,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        borderRadius: 5,
        cursor: 'pointer',
        color,
        '--hover': hover,
      }}
    >
      <svg
        width={lado > 34 ? 19 : 18}
        height={lado > 34 ? 19 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}
