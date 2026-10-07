import { Link, useOutletContext } from 'react-router-dom'
import IconoInstagram from '../../componentes/IconoInstagram'
import CajaMensaje from './CajaMensaje'
import { CANTIDAD_MAXIMA, LARGO_MAXIMO_ACLARACIONES } from './seleccion'
import {
  ICONO_CERRAR,
  ICONO_CORAZON,
  ICONO_MAS,
  ICONO_MENOS,
  QUICKSAND,
  TEXTOS_SELECCION_VACIA,
  formatearPrecio,
  textoCantidadElegida,
  tinteDe,
} from './presentacion'

// La pantalla /seleccion, "Mi selección": modificar la cantidad de un
// producto (CU67), quitarlo (CU68) y registrar las aclaraciones (CU69).
//
// No guarda nada: la selección y las funciones que la cambian llegan del
// layout por useOutletContext, y los ítems ya vienen armados con su
// producto. Acá solo se dibujan.
//
// Se llama MiSeleccion y no Seleccion porque al lado está seleccion.js, el
// de las funciones, y en Windows el disco no distingue mayúsculas: un
// import de "./Seleccion" encontraría primero al .js.


// Los botones − y + del control de cantidad. Son botones y no enlaces
// porque no cambian la dirección. Deshabilitado va con el atributo, así la
// regla global de hover de index.css no le cambia nada y el teclado lo
// saltea.
function BotonCantidad({ icono, title, deshabilitado, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={deshabilitado}
      className="catalogo-suave"
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        borderRadius: 5,
        cursor: deshabilitado ? 'default' : 'pointer',
        opacity: deshabilitado ? 0.35 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A7A8C" strokeWidth="2.3">
        <path strokeLinecap="round" d={icono} />
      </svg>
    </button>
  )
}


export default function MiSeleccion() {
  const { seleccion } = useOutletContext()
  const { items, piezas, total, aclaraciones, modificarCantidad, quitarProducto, registrarAclaraciones } = seleccion

  return (
    <section>
      <h1 style={{ margin: '0 0 6px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 32, color: '#5A7A8C' }}>
        Mi selección
      </h1>
      <p style={{ margin: '0 0 22px', fontSize: 15, color: '#708085' }}>
        {items.length === 0
          ? 'Acá vas a ver las piezas que elijas.'
          : `${textoCantidadElegida(piezas)} Ajustá cantidades y contame lo que necesites.`}
      </p>

      {items.length === 0 && (
        <CajaMensaje icono={ICONO_CORAZON} {...TEXTOS_SELECCION_VACIA} principal />
      )}

      {items.length > 0 && (
        /* En celular, la lista y después el resumen. La clase los pone lado
           a lado de 900px para arriba. */
        <div
          className="catalogo-seleccion"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24, alignItems: 'start' }}
        >
          <div style={{ background: 'white', border: '1px solid #E0E8EB', borderRadius: 8, overflow: 'hidden' }}>
            {items.map(({ producto, cantidad }) => (
              <div
                key={producto.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '14px 16px',
                  borderBottom: '1px solid #E0E8EB',
                }}
              >
                {/* La foto lleva al detalle del producto: es un enlace. */}
                <Link
                  to={`/productos/${producto.id}`}
                  style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    display: 'block',
                    overflow: 'hidden',
                    borderRadius: 6,
                    background: tinteDe(producto),
                  }}
                >
                  {producto.imagen_principal && (
                    <img
                      src={producto.imagen_principal}
                      alt={producto.nombre}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                </Link>

                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 15,
                      lineHeight: 1.3,
                      color: '#323A3D',
                      textWrap: 'pretty',
                    }}
                  >
                    {producto.nombre}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 14, color: '#708085' }}>
                    {formatearPrecio(producto.precio_actual)}
                  </p>
                </div>

                {/* El "−" se apaga en 1: para sacar la pieza está Quitar. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                    marginLeft: 'auto',
                    border: '1px solid #E0E8EB',
                    borderRadius: 6,
                  }}
                >
                  <BotonCantidad
                    icono={ICONO_MENOS}
                    title="Una menos"
                    deshabilitado={cantidad <= 1}
                    onClick={() => modificarCantidad(producto.id, cantidad - 1)}
                  />
                  <span
                    style={{
                      minWidth: 22,
                      textAlign: 'center',
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 15,
                      color: '#323A3D',
                    }}
                  >
                    {cantidad}
                  </span>
                  <BotonCantidad
                    icono={ICONO_MAS}
                    title="Una más"
                    deshabilitado={cantidad >= CANTIDAD_MAXIMA}
                    onClick={() => modificarCantidad(producto.id, cantidad + 1)}
                  />
                </div>

                <button
                  onClick={() => quitarProducto(producto.id)}
                  title="Quitar"
                  className="catalogo-quitar"
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 0,
                    background: 'transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C0442F" strokeWidth="1.9">
                    <path strokeLinecap="round" d={ICONO_CERRAR} />
                  </svg>
                </button>
              </div>
            ))}

            <div style={{ padding: 16 }}>
              <label
                htmlFor="aclaraciones"
                style={{
                  display: 'block',
                  marginBottom: 7,
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: '.06em',
                  color: '#708085',
                }}
              >
                ACLARACIONES
              </label>
              <textarea
                id="aclaraciones"
                value={aclaraciones}
                onChange={(e) => registrarAclaraciones(e.target.value)}
                rows={3}
                maxLength={LARGO_MAXIMO_ACLARACIONES}
                placeholder="Colores, fechas, lo que quieras contarme"
                className="catalogo-campo"
                style={{
                  width: '100%',
                  padding: '10px 13px',
                  border: '1px solid #E0E8EB',
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: '#323A3D',
                  background: 'white',
                  borderRadius: 6,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: 'white',
              border: '1px solid #E0E8EB',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: QUICKSAND, fontWeight: 600, fontSize: 15, color: '#323A3D' }}>
                Total orientativo
              </span>
              <span style={{ fontFamily: QUICKSAND, fontWeight: 700, fontSize: 24, color: '#5A7A8C' }}>
                {formatearPrecio(total)}
              </span>
            </div>

            <Link
              to="/mensaje"
              className="catalogo-relleno"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 48,
                padding: '12px 20px',
                background: '#5A7A8C',
                color: 'white',
                borderRadius: 6,
                textDecoration: 'none',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              <IconoInstagram lado={18} />
              Consultar por Instagram
            </Link>

            <Link
              to="/"
              className="catalogo-suave"
              style={{
                display: 'block',
                padding: '10px 18px',
                border: '1px solid #E0E8EB',
                background: 'white',
                color: '#5A7A8C',
                borderRadius: 6,
                textAlign: 'center',
                textDecoration: 'none',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Seguir mirando
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
