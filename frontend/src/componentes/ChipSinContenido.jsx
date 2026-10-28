// El chip ámbar de los listados para un registro que quedó sin su contenido
// principal: "Sin materiales" en un gasto de materiales sin filas, "Sin
// productos" en un pedido sin productos. Ámbar es el color de "falta algo",
// no el de error. Mide 12px con poco padding, como el "+N" de CONTENIDO en
// Pedidos, para entrar en una columna angosta; el title dice qué hacer.
// Salió de Gastos, que lo tenía local, cuando Pedidos pasó a usarlo.
export default function ChipSinContenido({ texto, title }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        whiteSpace: 'nowrap',
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 12,
        borderRadius: 20,
        padding: '3px 7px',
        border: '1px solid #D9A441',
        background: '#FDF3E0',
        color: '#8A6320',
      }}
    >
      {texto}
    </span>
  )
}
