import { useEffect, useState } from 'react'
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import CajaMensaje from './CajaMensaje'
import FiltrosCatalogo from './FiltrosCatalogo'
import TarjetaCatalogo from './TarjetaCatalogo'
import { alternarFiltro, escribirFiltros, filtrarProductos, leerFiltros } from './filtros'
import { ICONO_CERRAR, ICONO_FILTROS, QUICKSAND, textoPiezas } from './presentacion'

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
  const filtrados = filtrarProductos(productos, grupos, idsElegidos)

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

  // replace: true para que tildar tres filtros no deje tres pasos en el
  // historial. Así el "atrás" del navegador sale del catálogo en vez de
  // ir destildando de a uno.
  function alternar(id) {
    setParametros(escribirFiltros(alternarFiltro(idsElegidos, id)), { replace: true })
  }

  function quitarFiltros() {
    setParametros(escribirFiltros([]), { replace: true })
  }

  return (
    <section>
      <div className="catalogo-portada" style={{ padding: '8px 0 24px', textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: QUICKSAND,
            fontWeight: 700,
            fontSize: 28,
            lineHeight: 1.15,
            color: '#5A7A8C',
            textWrap: 'pretty',
          }}
        >
          Accesorios en porcelana fría, hechos a mano con ❤
        </h1>
      </div>

      {/* Solo en celular: cuántas piezas se están viendo y el botón que
          abre el panel de filtros. */}
      {!esEscritorio && productos.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, color: '#708085' }}>{textoPiezas(filtrados.length)}</span>

          {grupos.length > 0 && (
            <button
              onClick={() => setFiltrosAbierto(true)}
              className="catalogo-suave"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '0 16px',
                border: '1px solid #5A7A8C',
                background: 'white',
                color: '#5A7A8C',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
              </svg>
              {idsElegidos.length > 0 ? `Filtrar (${idsElegidos.length})` : 'Filtrar'}
            </button>
          )}
        </div>
      )}

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
          {productos.length === 0 && (
            <CajaMensaje titulo="Todavía no hay productos en el catálogo." />
          )}

          {productos.length > 0 && filtrados.length === 0 && (
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
              {filtrados.map((producto) => (
                <TarjetaCatalogo
                  key={producto.id}
                  producto={producto}
                  filtros={ubicacion.search}
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
                  background: '#5A7A8C',
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
