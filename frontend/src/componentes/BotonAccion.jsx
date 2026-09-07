// El botón cuadrado con icono que usan la tarjeta, la tabla y la
// sección de dados de baja.

// tamanoIcono es opcional: si no se pasa, el icono se deduce del lado del
// botón, que es como venía funcionando. Sirve para los casos donde el
// botón tiene que medir una cosa y el icono otra.
export default function BotonAccion({ onClick, titulo, color, hover, icono, lado = 36, tamanoIcono }) {
  const medidaIcono = tamanoIcono ?? (lado > 34 ? 19 : 18)

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
        width={medidaIcono}
        height={medidaIcono}
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
