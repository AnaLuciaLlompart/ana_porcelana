// El botón cuadrado con icono que usan la tarjeta, la tabla y la
// sección de dados de baja.

// tamanoIcono es opcional: si no se pasa, el icono se deduce del lado del
// botón, que es como venía funcionando. Sirve para los casos donde el
// botón tiene que medir una cosa y el icono otra.
//
// deshabilitado también es opcional, y sin él el botón se dibuja igual que
// siempre. Sirve para una acción que en esa fila no corresponde, como
// marcar en disponibilidad Alta un material que ya está en Alta: el botón
// queda en su lugar, apagado, y el titulo explica por qué.
export default function BotonAccion({
  onClick,
  titulo,
  color,
  hover,
  icono,
  lado = 36,
  tamanoIcono,
  deshabilitado = false,
}) {
  const medidaIcono = tamanoIcono ?? (lado > 34 ? 19 : 18)

  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
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
        cursor: deshabilitado ? 'default' : 'pointer',
        // La opacidad se escribe SOLO cuando está apagado. Si fuera un 1 fijo
        // en los demás casos, le ganaría a la regla de index.css que baja la
        // opacidad de los botones al pasar el mouse, y todos los botones de
        // acción perderían ese efecto.
        opacity: deshabilitado ? 0.35 : undefined,
        color,
        // La clase btn-accion pinta el fondo con esta variable al pasar el
        // mouse. Apagado va transparente, para que no parezca cliqueable.
        '--hover': deshabilitado ? 'transparent' : hover,
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
