// El encabezado de una tarjeta con título: una franja rosa oscuro con el
// título en blanco, como la cabecera de los modales, para que cada sección
// de una pantalla se reconozca de un vistazo. Lo usan las fichas de pedido y
// de gasto (Datos y la tabla de cada una), los tres paneles de Inicio y los
// dos de Finanzas (INGRESOS y GASTOS).
//
// nota es la aclaración chica al lado del título (opcional), y children lo
// que va a la derecha, como el botón de agregar. La tarjeta que lo contiene
// lleva overflow: 'hidden', así la franja toma las esquinas redondeadas.
export default function EncabezadoDeTarjeta({ titulo, nota, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '14px 20px',
        background: '#8C5A66',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 17,
            color: 'white',
            letterSpacing: '.06em',
          }}
        >
          {titulo}
        </h2>
        {nota && <span style={{ fontSize: 13, color: 'rgba(255,255,255,.8)' }}>{nota}</span>}
      </div>

      {children}
    </div>
  )
}
