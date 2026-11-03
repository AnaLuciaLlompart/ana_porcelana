import BotonAccion from '../../componentes/BotonAccion'
import BotonAvanzar from '../../componentes/BotonAvanzar'
import EncabezadoDeTarjeta from '../../componentes/EncabezadoDeTarjeta'
import { ANCHO_MAXIMO } from '../../constantes'
import {
  COLOR_ETAPA,
  ICONO_CRUZ,
  ICONO_EDITAR,
  ICONO_MAS,
  diasEnEtapa,
  formatearPrecio,
  siguienteEtapa,
} from './presentacion'


// Los títulos de columna van en gris sobre blanco, con una línea rosa
// debajo, y no con la franja rosa de los listados: dentro de la ficha la
// tabla es parte de una tarjeta, y el que manda es su encabezado rosa
// oscuro. El blanco los separa del gris de los campos del formulario.
const estiloTh = {
  padding: '10px 8px',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#857078',
  borderBottom: '2px solid #F0E2E4',
}

const estiloCartelError = {
  margin: 0,
  padding: '10px 12px',
  background: '#FAEAE8',
  border: '1px solid #F0C4BC',
  borderRadius: 6,
  fontSize: 14,
  color: '#C0442F',
  textWrap: 'pretty',
}


// Una fila de la tabla: una pieza encargada, con su cantidad, su precio
// congelado y en qué etapa productiva está.
//
// La etapa es un chip y, debajo, "Avanzar a …" (corrección del tutor: avanza
// de a una, con confirmación). Es una acción que se aplica al instante,
// aunque la tabla sea parte del formulario: la excepción a "Formulario o
// acción" que decidió la usuaria. Sin onAvanzarEtapa (el alta) solo va el
// chip; en una pieza todavía sin guardar el botón va apagado, porque el
// PATCH necesita la fila guardada. bloqueado es el motivo por el que el
// lápiz y la cruz van apagados, o ''.
function Fila({ producto, bloqueado, onEditar, onAvanzarEtapa, onQuitar }) {
  const etapa = COLOR_ETAPA[producto.estado]
  const desde = diasEnEtapa(producto)
  const siguiente = siguienteEtapa(producto.estado)

  return (
    <tr style={{ borderTop: '1px solid #EBE0E2', verticalAlign: 'top' }}>
      <td style={{ padding: '14px 20px' }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.3, color: '#3D3238' }}>
          {producto.producto_nombre}
        </p>

        {producto.descripcion && (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: 13,
              lineHeight: 1.4,
              color: '#857078',
              textWrap: 'pretty',
            }}
          >
            {producto.descripcion}
          </p>
        )}
      </td>

      <td style={{ padding: '14px 8px', textAlign: 'center', fontSize: 15, color: '#3D3238' }}>
        {producto.cantidad}
      </td>

      <td
        style={{
          padding: '14px 8px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontSize: 15,
          color: '#3D3238',
        }}
      >
        {formatearPrecio(producto.precio)}
      </td>

      <td
        style={{
          padding: '14px 8px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 600,
          fontSize: 15,
          color: '#3D3238',
        }}
      >
        {formatearPrecio(producto.subtotal)}
      </td>

      <td style={{ padding: '11px 8px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '5px 10px',
            borderRadius: 6,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            border: `1px solid ${etapa.borde}`,
            background: etapa.fondo,
            color: etapa.color,
          }}
        >
          {producto.estado_display}
        </span>

        {onAvanzarEtapa && siguiente && (
          <div style={{ marginTop: 6 }}>
            <BotonAvanzar
              texto={`Avanzar a ${siguiente.label}`}
              onClick={() => onAvanzarEtapa(producto)}
              deshabilitado={producto.id < 0}
              motivo="Guardá el pedido para avanzar esta pieza"
            />
          </div>
        )}

        {desde && (
          <p
            style={{
              margin: '5px 0 0 10px',
              whiteSpace: 'nowrap',
              fontSize: 13,
              color: desde.color,
            }}
          >
            {desde.texto}
          </p>
        )}
      </td>

      <td style={{ padding: '11px 8px' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <BotonAccion
            onClick={() => onEditar(producto)}
            titulo={bloqueado || 'Editar'}
            color="#8C5A66"
            hover="#F0E2E4"
            tamanoIcono={20}
            icono={ICONO_EDITAR}
            deshabilitado={Boolean(bloqueado)}
          />

          <BotonAccion
            onClick={() => onQuitar(producto)}
            titulo={bloqueado || 'Quitar producto'}
            color="#C0442F"
            hover="#FAEAE8"
            tamanoIcono={20}
            icono={ICONO_CRUZ}
            deshabilitado={Boolean(bloqueado)}
          />
        </div>
      </td>
    </tr>
  )
}


// bloqueado y onAvanzarEtapa son opcionales: los pasa la ficha y no el alta.
export default function PestanaProductos({
  productos,
  subtotal,
  error,
  bloqueado = '',
  onAgregar,
  onEditar,
  onAvanzarEtapa,
  onQuitar,
}) {
  return (
    <div
      className="ancho-pantalla"
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
        maxWidth: ANCHO_MAXIMO,
      }}
    >
      <EncabezadoDeTarjeta titulo="PRODUCTOS DEL PEDIDO">
        <button
          onClick={onAgregar}
          disabled={Boolean(bloqueado)}
          title={bloqueado || undefined}
          className="btn-reponer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            flexShrink: 0,
            padding: '8px 14px',
            border: '1px solid #8C5A66',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 5,
            cursor: bloqueado ? 'default' : 'pointer',
            opacity: bloqueado ? 0.5 : undefined,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" d={ICONO_MAS} />
          </svg>
          Agregar producto
        </button>
      </EncabezadoDeTarjeta>

      {/* El error de guardar los productos o de avanzar una etapa va acá,
          pegado a la tabla, como en los materiales del gasto. */}
      {error && (
        <div style={{ padding: '14px 20px 0' }}>
          <p role="alert" style={estiloCartelError}>
            {error}
          </p>
        </div>
      )}

      {/* DIFERENCIA DELIBERADA CON EL DISEÑO, decidida por la usuaria: el
          prototipo no tiene columna de acciones ni forma de editar un
          producto ya cargado, solo deja cambiar la etapa. Acá los dos
          botones viven juntos en ACCIONES, como en las otras pantallas, y
          el del lápiz abre un modal que el diseño no contempla.

          No es un descuido de implementación: es un agregado pedido. */}
      {productos.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 940, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...estiloTh, width: '32%', padding: '10px 20px', textAlign: 'left' }}>
                    PRODUCTO
                  </th>
                  <th style={{ ...estiloTh, width: '9%', textAlign: 'center' }}>CANTIDAD</th>
                  <th style={{ ...estiloTh, width: '15%', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    PRECIO UNITARIO
                  </th>
                  <th style={{ ...estiloTh, width: '11%', textAlign: 'right' }}>SUBTOTAL</th>
                  {/* 23 % y no 18: "Avanzar a Pintura-Barniz" mide 191 px y,
                      con la tabla en su mínimo de 940, necesita 207. */}
                  <th style={{ ...estiloTh, width: '23%', textAlign: 'left' }}>ETAPA</th>
                  <th style={{ ...estiloTh, width: '10%', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {productos.map((p) => (
                  // La key es el id del PRODUCTO DEL PEDIDO, no el del
                  // producto: el mismo producto puede estar dos veces en el
                  // mismo pedido y ahí los ids se repetirían.
                  <Fila
                    key={p.id}
                    producto={p}
                    bloqueado={bloqueado}
                    onEditar={onEditar}
                    onAvanzarEtapa={onAvanzarEtapa}
                    onQuitar={onQuitar}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 24,
              padding: '14px 20px',
              borderTop: '2px solid #F0E2E4',
            }}
          >
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: '#8C5A66',
              }}
            >
              {formatearPrecio(subtotal)}
            </span>
          </div>
        </>
      )}

      {productos.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p
            style={{
              margin: '0 0 6px',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: '#3D3238',
            }}
          >
            Todavía no hay productos
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            Sin productos no se puede cobrar el pedido.
          </p>
        </div>
      )}
    </div>
  )
}
