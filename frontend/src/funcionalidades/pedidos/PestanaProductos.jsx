import { useNavigate } from 'react-router-dom'

import BotonAccion from '../../componentes/BotonAccion'
import {
  COLOR_ETAPA,
  ETAPAS,
  ICONO_CRUZ,
  ICONO_EDITAR,
  ICONO_MAS,
  ICONO_MATERIALES,
  diasEnEtapa,
  formatearPrecio,
} from './presentacion'


const estiloTh = {
  padding: '10px 8px',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#8C5A66',
}


// Una fila de la tabla: una pieza encargada, con su cantidad, su precio
// congelado y en qué etapa productiva está.
function Fila({ producto, onEditar, onCambiarEtapa, onQuitar }) {
  const navegar = useNavigate()

  const etapa = COLOR_ETAPA[producto.estado]
  const desde = diasEnEtapa(producto)

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
        <select
          value={producto.estado}
          onChange={(e) => onCambiarEtapa(producto, e.target.value)}
          style={{
            width: '100%',
            maxWidth: 190,
            padding: '8px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            outline: 'none',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            border: `1px solid ${etapa.borde}`,
            background: etapa.fondo,
            color: etapa.color,
          }}
        >
          {ETAPAS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.label}
            </option>
          ))}
        </select>

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
          {/* El de materiales no aparece si la pieza no tiene ninguno
              cargado: llevaría a una pantalla filtrada sin nada que
              mostrar. En esas filas van dos botones y no tres.

              Navega con navegar() y no con una etiqueta <a>, aunque en el
              diseño sea un enlace: un <a> recargaría la aplicación entera
              en vez de cambiar de pantalla. */}
          {producto.producto_tiene_materiales && (
            <BotonAccion
              onClick={() => navegar(`/materiales?producto=${producto.producto}`)}
              titulo={`Ver los materiales de ${producto.producto_nombre}`}
              color="#8C5A66"
              hover="#F0E2E4"
              tamanoIcono={20}
              icono={ICONO_MATERIALES}
            />
          )}

          <BotonAccion
            onClick={() => onEditar(producto)}
            titulo="Editar"
            color="#8C5A66"
            hover="#F0E2E4"
            tamanoIcono={20}
            icono={ICONO_EDITAR}
          />

          <BotonAccion
            onClick={() => onQuitar(producto)}
            titulo="Quitar producto"
            color="#C0442F"
            hover="#FAEAE8"
            tamanoIcono={20}
            icono={ICONO_CRUZ}
          />
        </div>
      </td>
    </tr>
  )
}


export default function PestanaProductos({
  productos,
  subtotal,
  onAgregar,
  onEditar,
  onCambiarEtapa,
  onQuitar,
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
        maxWidth: 1140,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid #EBE0E2',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#8C5A66',
            letterSpacing: '.06em',
          }}
        >
          PRODUCTOS DEL PEDIDO
        </h2>

        <button
          onClick={onAgregar}
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
            cursor: 'pointer',
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
      </div>

      {/* DIFERENCIA DELIBERADA CON EL DISEÑO, decidida por la usuaria: el
          prototipo no tiene columna de acciones ni forma de editar un
          producto ya cargado, solo deja cambiar la etapa. Acá los tres
          botones viven juntos en ACCIONES, como en las otras pantallas, y
          el del lápiz abre un modal que el diseño no contempla.

          No es un descuido de implementación: es un agregado pedido. */}
      {productos.length > 0 && (
        <>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F0E2E4' }}>
                <th style={{ ...estiloTh, width: '28%', padding: '10px 20px', textAlign: 'left' }}>
                  PRODUCTO
                </th>
                <th style={{ ...estiloTh, width: '10%', textAlign: 'center' }}>CANTIDAD</th>
                <th style={{ ...estiloTh, width: '18%', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  PRECIO UNITARIO
                </th>
                <th style={{ ...estiloTh, width: '12%', textAlign: 'right' }}>SUBTOTAL</th>
                <th style={{ ...estiloTh, width: '18%', textAlign: 'left' }}>ETAPA</th>
                <th style={{ ...estiloTh, width: '14%', textAlign: 'center' }}>ACCIONES</th>
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
                  onEditar={onEditar}
                  onCambiarEtapa={onCambiarEtapa}
                  onQuitar={onQuitar}
                />
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 24,
              padding: '14px 20px',
              borderTop: '1px solid #EBE0E2',
              background: '#FAF7F7',
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
            El pedido no tiene productos todavía
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#857078', textWrap: 'pretty' }}>
            Cargá cada producto con su cantidad y el precio que acordaron. Si el
            mismo modelo va en dos colores, cargalo dos veces.
          </p>
        </div>
      )}
    </div>
  )
}
