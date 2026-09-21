import { useState } from 'react'
import { modificarMaterialDelGasto, registrarMaterialDelGasto } from './api'
import { formatearPrecio, mensajeDeError } from './presentacion'


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.06em',
}

// El borde se pinta de rojo solo después de intentar guardar, no mientras
// se escribe, igual que en los modales de Pedidos.
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

// Lo que se muestra pero no se escribe: el material al editar y el subtotal
// siempre.
const FONDO_APAGADO = '#F7F3F4'


// El mismo modal agrega y edita un material del gasto, según llegue o no una
// fila. Es el patrón de ModalCobro: "si llega uno, está en modo edición". Acá
// encaja porque los tres campos son los mismos en los dos casos; lo único
// que cambia es que al editar el material queda bloqueado.
//
// El material se bloquea porque el backend no deja cambiarlo: el serializer
// de modificación no tiene ese campo. Para anotar otro material se quita la
// fila y se agrega otra, porque cambiarlo sería otra cosa comprada.
//
// A DIFERENCIA de ModalCobro, este modal llama él mismo a la API, como hace
// ModalCliente. El motivo es que los errores del backend se tienen que ver
// ACÁ ADENTRO, con el formulario todavía abierto para corregirlo: si la
// llamada la hiciera la ficha después de cerrar el modal, el error saldría
// en la ficha y lo escrito se perdería.
//
// Al salir bien le entrega a la ficha el gasto completo que devolvió el
// backend, con la fila y el monto ya actualizados.
export default function ModalMaterial({ gastoId, fila, materiales, onCerrar, onGuardado }) {
  const editando = Boolean(fila)

  // El material va como texto porque el value de un <select> siempre lo es;
  // se convierte a número al enviar.
  const [material, setMaterial] = useState(editando ? String(fila.material) : '')
  const [cantidad, setCantidad] = useState(editando ? String(fila.cantidad) : '1')
  const [precio, setPrecio] = useState(
    editando ? String(Math.round(Number(fila.precio_unitario))) : ''
  )
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const sinMaterial = material === ''
  // Entera y de 1 para arriba: es lo mismo que exige el backend, que la
  // guarda como entero positivo con mínimo 1.
  const cantidadInvalida = !(Number.isInteger(Number(cantidad)) && Number(cantidad) >= 1)
  const precioInvalido = !(Number(precio) > 0)

  // Solo una vista previa para que ella vea cuánto va a sumar la fila antes
  // de guardarla. El subtotal de verdad, y el monto del gasto, los calcula
  // el backend y vuelven en la respuesta.
  const subtotal = Math.max(0, Number(cantidad) || 0) * Number(precio)

  async function guardar() {
    if (sinMaterial || cantidadInvalida || precioInvalido) {
      setTocado(true)
      return
    }

    setError('')
    setEnviando(true)

    try {
      // Al editar no viaja el material: el backend lo ignoraría igual.
      const res = editando
        ? await modificarMaterialDelGasto(gastoId, fila.id, {
            cantidad: Number(cantidad),
            precio_unitario: precio,
          })
        : await registrarMaterialDelGasto(gastoId, {
            material: Number(material),
            cantidad: Number(cantidad),
            precio_unitario: precio,
          })

      onGuardado(res.data)
    } catch (err) {
      // Por ejemplo, "El gasto ya tiene «X» entre sus materiales", si el
      // mismo material se cargó desde otra pestaña mientras este modal
      // estaba abierto.
      setError(mensajeDeError(err))
      setEnviando(false)
    }
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
            {editando ? 'Editar material del gasto' : 'Agregar material'}
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
            <label htmlFor="material" style={estiloEtiqueta}>
              MATERIAL *
            </label>

            {/* Al editar, la única opción es el material de la fila: puede
                estar discontinuado o no figurar entre los disponibles, así
                que no se lo busca en la lista. El nombre y la etiqueta del
                estado vienen en la fila. */}
            <select
              id="material"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              disabled={editando}
              style={{
                ...estiloCampo(tocado && sinMaterial),
                background: editando ? FONDO_APAGADO : 'white',
                cursor: editando ? 'default' : 'pointer',
              }}
            >
              {editando ? (
                <option value={fila.material}>
                  {fila.material_nombre}
                  {fila.material_estado === 'DISCONTINUADO'
                    ? ` (${fila.material_estado_display.toLowerCase()})`
                    : ''}
                </option>
              ) : (
                <>
                  <option value="">Elegí un material...</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </>
              )}
            </select>

            {tocado && sinMaterial && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#C0442F' }}>
                Elegí un material.
              </p>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label htmlFor="cantidad" style={estiloEtiqueta}>
                CANTIDAD *
              </label>
              <input
                id="cantidad"
                type="number"
                min="1"
                step="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                style={estiloCampo(tocado && cantidadInvalida)}
              />
            </div>

            <div>
              <label htmlFor="precio" style={estiloEtiqueta}>
                PRECIO UNITARIO *
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

            <div>
              <span style={estiloEtiqueta}>SUBTOTAL</span>
              <p
                style={{
                  margin: 0,
                  padding: '10px 13px',
                  border: '1px solid #EBE0E2',
                  borderRadius: 5,
                  background: FONDO_APAGADO,
                  fontSize: 16,
                  color: '#3D3238',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatearPrecio(subtotal)}
              </p>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                background: '#FAEAE8',
                border: '1px solid #F0C4BC',
                borderRadius: 6,
                fontSize: 14,
                color: '#C0442F',
                textWrap: 'pretty',
              }}
            >
              {error}
            </p>
          )}
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
            onClick={guardar}
            disabled={enviando}
            style={{
              padding: '10px 18px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: enviando ? 'default' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {editando
              ? (enviando ? 'Guardando…' : 'Guardar')
              : (enviando ? 'Agregando…' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  )
}
