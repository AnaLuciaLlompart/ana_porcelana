// El chip "Cambios sin guardar" del breadcrumb de las tres fichas (producto,
// pedido y gasto). Lo dibuja la ficha cuando el borrador difiere de lo
// guardado; es el único aviso mientras se está en la ficha, porque salir por
// el breadcrumb descarta sin preguntar. Salió de la ficha de Producto, que
// lo tenía en línea, cuando pasó a usarse en las tres.
export default function ChipCambiosSinGuardar() {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 4,
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        borderRadius: 20,
        padding: '3px 11px',
        border: '1px solid #EEDCB4',
        background: '#FDF3E0',
        color: '#8A6320',
      }}
    >
      Cambios sin guardar
    </span>
  )
}
