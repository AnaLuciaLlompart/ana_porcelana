import { useState } from 'react'
import { formatearPrecio } from './presentacion'


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.06em',
}

// El borde se pinta de rojo solo después de intentar agregar, no mientras
// se escribe: marcar en rojo un campo que la usuaria todavía no terminó de
// completar es apurarla.
function estiloCampo(enRojo) {
  return {
    width: '100%',
    padding: '10px 13px',
    border: `1px solid ${enRojo ? '#C0442F' : '#EBE0E2'}`,
    fontSize: 16,
    color: '#3D3238',
    background: 'white',
    borderRadius: 5,
    outline: 'none',
    fontFamily: 'inherit',
  }
}


export default function ModalAgregarProducto({ productos, onCerrar, onAgregar }) {
  const [producto, setProducto] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tocado, setTocado] = useState(false)

  const faltaProducto = !producto
  const cantidadInvalida = !(Number(cantidad) >= 1)
  const precioInvalido = !(Number(precio) > 0)

  // Al elegir la pieza, el precio se completa con el del catálogo y queda
  // EDITABLE. Es el precio congelado: lo que se acordó con este cliente,
  // que puede ser otro por un descuento o por una variante más trabajosa.
  // Lo que se guarde acá no se vuelve a mirar contra el catálogo.
  function elegirProducto(id) {
    setProducto(id)

    const elegido = productos.find((p) => String(p.id) === id)

    if (elegido) setPrecio(String(Math.round(Number(elegido.precio_actual))))
  }

  function agregar() {
    if (faltaProducto || cantidadInvalida || precioInvalido) {
      setTocado(true)
      return
    }

    onAgregar({
      producto: Number(producto),
      cantidad: Number(cantidad),
      precio,
      descripcion: descripcion.trim(),
    })
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,50,56,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            flexShrink: 0,
            background: '#8C5A66',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            Agregar producto
          </h2>

          <button
            onClick={onCerrar}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'transparent',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
          }}
        >
          <div>
            <label htmlFor="producto" style={estiloEtiqueta}>
              PRODUCTO *
            </label>
            <select
              id="producto"
              value={producto}
              onChange={(e) => elegirProducto(e.target.value)}
              style={{ ...estiloCampo(tocado && faltaProducto), cursor: 'pointer' }}
            >
              <option value="">Elegí un producto...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {formatearPrecio(p.precio_actual)}
                </option>
              ))}
            </select>

            {tocado && faltaProducto && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                Elegí un producto.
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label htmlFor="cantidad" style={estiloEtiqueta}>
                CANTIDAD *
              </label>
              <input
                id="cantidad"
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                style={estiloCampo(tocado && cantidadInvalida)}
              />
            </div>

            <div>
              <label htmlFor="precio" style={estiloEtiqueta}>
                PRECIO ACORDADO *
              </label>
              <input
                id="precio"
                value={precio}
                // Se limpia todo lo que no sea dígito, como en el resto del
                // sistema: los importes se cargan en pesos enteros.
                onChange={(e) => setPrecio(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="$"
                style={estiloCampo(tocado && precioInvalido)}
              />
            </div>
          </div>

          <p style={{ margin: '-6px 0 0', fontSize: 12, color: '#B08791', textWrap: 'pretty' }}>
            Se guarda el precio de hoy: si después cambiás el del producto, este
            precio no se modifica.
          </p>

          <div>
            <label
              htmlFor="descripcion"
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}
            >
              <span style={{ ...estiloEtiqueta, display: 'inline', marginBottom: 0 }}>
                DESCRIPCIÓN
              </span>
              <span style={{ fontSize: 12, color: '#B08791' }}>
                Color, medida, lo que acordaron
              </span>
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={300}
              rows={3}
              style={{ ...estiloCampo(false), fontSize: 15, lineHeight: 1.5, resize: 'vertical' }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            flexShrink: 0,
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onCerrar}
            style={{
              padding: '10px 18px',
              border: '1px solid #EBE0E2',
              background: 'white',
              color: '#8C5A66',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Cancelar
          </button>

          <button
            onClick={agregar}
            style={{
              padding: '10px 18px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
