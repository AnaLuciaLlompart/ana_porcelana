import { useEffect, useState } from 'react'
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import CajaMensaje from './CajaMensaje'
import FiltrosCatalogo from './FiltrosCatalogo'
import TarjetaCatalogo from './TarjetaCatalogo'
import {
  alternarFiltro,
  buscarProductos,
  escribirBusqueda,
  escribirFiltros,
  escribirOrden,
  filtrarProductos,
  leerBusqueda,
  leerFiltros,
  leerOrden,
  ORDENES,
  ordenarProductos,
} from './filtros'
import { ICONO_CERRAR, ICONO_CORAZON, ICONO_FILTROS, ICONO_LUPA, QUICKSAND, textoPiezas } from './presentacion'

// El listado del catálogo público: CU63 (visualizar el catálogo) y CU64
// (filtrar por categoría).
//
// Esta pantalla no le pide nada al servidor. Los productos y las
// categorías los cargó el layout una sola vez y llegan por
// useOutletContext; el filtrado es local, sobre esa lista.

export default function Catalogo() {
  const { productos, grupos, esEscritorio } = useOutletContext()
  const ubicacion = useLocation()
  const [parametros, setParametros] = useSearchParams()
  const [filtrosAbierto, setFiltrosAbierto] = useState(false)

  // Derivados: se calculan en cada dibujo a partir de la dirección y de
  // las listas, y no se guardan en estado. La dirección es la única que
  // sabe qué filtros hay.
  const idsElegidos = leerFiltros(parametros, grupos)
  const orden = leerOrden(parametros)
  const busqueda = leerBusqueda(parametros)
  const filtrados = ordenarProductos(
    buscarProductos(filtrarProductos(productos, grupos, idsElegidos), busqueda),
    orden
  )
  const hayBusqueda = busqueda.trim() !== ''

  // El panel de filtros solo existe en celular. Si la ventana pasa a
  // escritorio con el panel abierto, filtrosAbierto queda en true pero no
  // se ve nada: en escritorio los filtros están a la vista.
  const panelAbierto = !esEscritorio && filtrosAbierto

  // Escape cierra el panel. Se escucha solo mientras está abierto.
  useEffect(() => {
    if (!panelAbierto) return
    function alTeclear(evento) {
      if (evento.key === 'Escape') setFiltrosAbierto(false)
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [panelAbierto])

  // Todo lo que vive en la dirección se escribe junto, porque setParametros
  // reemplaza todos los parámetros: se parte de lo que hay y se pisa solo lo
  // que cambia. Si no, tildar una categoría borraría el orden y la búsqueda.
  // replace: true para que tildar tres filtros o escribir seis letras no
  // deje seis pasos en el historial: así el "atrás" del navegador sale del
  // catálogo en vez de ir destildando de a uno.
  function escribirDireccion(cambios) {
    const nuevo = { ids: idsElegidos, orden, busqueda, ...cambios }
    setParametros(
      {
        ...escribirFiltros(nuevo.ids),
        ...escribirOrden(nuevo.orden),
        ...escribirBusqueda(nuevo.busqueda),
      },
      { replace: true }
    )
  }

  function alternar(id) {
    escribirDireccion({ ids: alternarFiltro(idsElegidos, id) })
  }

  function quitarFiltros() {
    escribirDireccion({ ids: [] })
  }

  function cambiarOrden(evento) {
    escribirDireccion({ orden: evento.target.value })
  }

  function cambiarBusqueda(evento) {
    escribirDireccion({ busqueda: evento.target.value })
  }

  function limpiarBusqueda() {
    escribirDireccion({ busqueda: '' })
  }

  // El texto "N piezas" y el desplegable de orden se dibujan en un lugar
  // distinto según el ancho, así que se definen una vez acá y se ubican
  // más abajo.
  const selectorDeOrden = (
    <select
      value={orden}
      onChange={cambiarOrden}
      aria-label="Ordenar por"
      className="catalogo-campo"
      style={{
        minHeight: 38,
        padding: '0 10px',
        border: '1px solid #E0E8EB',
        background: 'white',
        color: '#323A3D',
        borderRadius: 6,
        outline: 'none',
        cursor: 'pointer',
        fontFamily: QUICKSAND,
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {ORDENES.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.label}
        </option>
      ))}
    </select>
  )

  return (
    <section>
      <div className="catalogo-portada" style={{ padding: '4px 0 18px', textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: QUICKSAND,
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.2,
            color: '#557385',
            textWrap: 'pretty',
          }}
        >
          {/* El corazón es un SVG y no el carácter ❤ (U+2764): Unicode lo
              lista entre los emojis y cada sistema decide cómo dibujarlo.
              Windows lo dibuja como texto, con el color del título; iPhone
              y Android lo dibujan como emoji rojo. Dibujado acá sale igual
              en todos y toma el color por currentColor. El span evita que
              el corazón quede solo en un renglón, separado de "con". */}
          Accesorios en porcelana fría, hechos a mano{' '}
          <span style={{ whiteSpace: 'nowrap' }}>
            con{' '}
            <svg
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="corazón"
              style={{ verticalAlign: '-0.15em' }}
            >
              <path d={ICONO_CORAZON} />
            </svg>
          </span>
        </h1>
      </div>

      {/* En celular es una sola columna. La clase la parte en dos de 900px
          para arriba, y por eso va solo cuando hay filtros que poner en la
          primera: sin ellos la grilla caería en la columna angosta. */}
      <div
        className={grupos.length > 0 ? 'catalogo-columnas' : undefined}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28, alignItems: 'start' }}
      >
        {/* Solo en escritorio: los filtros a la vista, que quedan fijos al
            bajar por la página. El 126 es el alto del encabezado más el de
            la barra de navegación, con un poco de aire. */}
        {esEscritorio && grupos.length > 0 && (
          <aside
            style={{
              position: 'sticky',
              top: 126,
              padding: 20,
              background: 'white',
              border: '1px solid #E0E8EB',
              borderRadius: 8,
            }}
          >
            <FiltrosCatalogo
              grupos={grupos}
              idsElegidos={idsElegidos}
              onAlternar={alternar}
              onQuitar={quitarFiltros}
            />
          </aside>
        )}

        <div style={{ minWidth: 0 }}>
          {/* Arriba de la grilla: el buscador, cuántas piezas se están
              viendo, el orden y, solo en celular, el botón que abre el panel
              de filtros. En celular son dos filas (buscador y Filtrar;
              cantidad y orden); en escritorio una sola, con el buscador a la
              izquierda y el resto a la derecha. */}
          {productos.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: esEscritorio ? 16 : 10,
                  marginBottom: esEscritorio ? 16 : 10,
                }}
              >
                {/* fontSize 16 es el mínimo con el que iPhone no hace zoom
                    al enfocar un campo. catalogo-campo le gana a la regla
                    global input:focus de index.css, que pintaría el borde
                    rosa de la gestión. */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: esEscritorio ? 360 : 'none' }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#64727A"
                    strokeWidth="2"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  >
                    <path strokeLinecap="round" d={ICONO_LUPA} />
                  </svg>
                  <input
                    value={busqueda}
                    onChange={cambiarBusqueda}
                    placeholder="¿Qué estás buscando?"
                    aria-label="Buscar"
                    className="catalogo-campo"
                    style={{
                      width: '100%',
                      minHeight: 44,
                      padding: '8px 40px 8px 36px',
                      border: '1px solid #E0E8EB',
                      background: 'white',
                      fontSize: 16,
                      color: '#323A3D',
                      borderRadius: 6,
                      outline: 'none',
                    }}
                  />
                  {hayBusqueda && (
                    <button
                      onClick={limpiarBusqueda}
                      title="Borrar búsqueda"
                      className="catalogo-suave"
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 0,
                        background: 'transparent',
                        borderRadius: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64727A" strokeWidth="2">
                        <path strokeLinecap="round" d={ICONO_CERRAR} />
                      </svg>
                    </button>
                  )}
                </div>

                {!esEscritorio && grupos.length > 0 && (
                  <button
                    onClick={() => setFiltrosAbierto(true)}
                    className="catalogo-suave"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 38,
                      padding: '0 12px',
                      border: '1px solid #557385',
                      background: 'white',
                      color: '#557385',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: QUICKSAND,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
                    </svg>
                    {idsElegidos.length > 0 ? `Filtrar (${idsElegidos.length})` : 'Filtrar'}
                  </button>
                )}

                {esEscritorio && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 14, color: '#64727A' }}>Ordenar por</span>
                    {selectorDeOrden}
                  </div>
                )}
              </div>

              {!esEscritorio && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ marginLeft: 'auto' }}>{selectorDeOrden}</div>
                </div>
              )}
            </>
          )}

          {productos.length === 0 && (
            <CajaMensaje titulo="Todavía no hay productos en el catálogo." />
          )}

          {/* Sin resultados por la búsqueda, la salida limpia solo la
              búsqueda y deja los filtros; sin resultados por los filtros,
              lleva a todo el catálogo. */}
          {productos.length > 0 && filtrados.length === 0 && hayBusqueda && (
            <CajaMensaje
              titulo="No encontramos productos con ese nombre"
              texto={
                idsElegidos.length > 0
                  ? 'Probá con otra palabra o quitá los filtros.'
                  : 'Probá con otra palabra o mirá todo el catálogo.'
              }
              textoSalida="Limpiar búsqueda"
              onSalida={limpiarBusqueda}
            />
          )}

          {productos.length > 0 && filtrados.length === 0 && !hayBusqueda && (
            <CajaMensaje
              titulo="No hay piezas en esta categoría"
              texto="Probá con otra combinación o mirá todo el catálogo."
              textoSalida="Ver todas las piezas"
              ruta="/"
            />
          )}

          {filtrados.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 14,
              }}
            >
              {/* La posición es sobre la lista ya filtrada y ordenada: las
                  primeras son las que se ven al entrar, sea cual sea el
                  filtro, y son las que cargan su foto sin esperar. */}
              {filtrados.map((producto, indice) => (
                <TarjetaCatalogo
                  key={producto.id}
                  producto={producto}
                  filtros={ubicacion.search}
                  indice={indice}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* El panel de filtros de celular: sube desde abajo, con el fondo
          oscuro detrás. Tocar el fondo lo cierra. */}
      {panelAbierto && (
        <>
          <div
            onClick={() => setFiltrosAbierto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(50,58,61,.5)' }}
          />

          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 61,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'white',
              borderRadius: '14px 14px 0 0',
              boxShadow: '0 -10px 40px rgba(50,58,61,.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 8px 14px 20px',
                borderBottom: '1px solid #E0E8EB',
              }}
            >
              <span style={{ fontFamily: QUICKSAND, fontWeight: 600, fontSize: 17, color: '#323A3D' }}>
                Filtrar
              </span>
              <button
                onClick={() => setFiltrosAbierto(false)}
                title="Cerrar"
                className="catalogo-suave"
                style={{
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  background: 'transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#323A3D" strokeWidth="2">
                  <path strokeLinecap="round" d={ICONO_CERRAR} />
                </svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
              <FiltrosCatalogo
                grupos={grupos}
                idsElegidos={idsElegidos}
                onAlternar={alternar}
                onQuitar={quitarFiltros}
              />
            </div>

            <div style={{ padding: '14px 20px 20px', borderTop: '1px solid #E0E8EB' }}>
              <button
                onClick={() => setFiltrosAbierto(false)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  border: 0,
                  background: '#557385',
                  color: 'white',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                {filtrados.length === 0 ? 'Sin resultados' : `Ver ${textoPiezas(filtrados.length)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
