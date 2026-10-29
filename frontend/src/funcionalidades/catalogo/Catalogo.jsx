import { useEffect, useState } from 'react'
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import { listarProductosDelCatalogo } from './api'
import CajaMensaje from './CajaMensaje'
import FiltrosCatalogo from './FiltrosCatalogo'
import TarjetaCatalogo from './TarjetaCatalogo'
import {
  alternarFiltro,
  escribirBusqueda,
  escribirFiltros,
  escribirOrden,
  leerBusqueda,
  leerFiltros,
  leerOrden,
  ORDENES,
  parametrosDelCatalogo,
} from './filtros'
import { ICONO_CERRAR, ICONO_CORAZON, ICONO_FILTROS, ICONO_LUPA, QUICKSAND, textoPiezas } from './presentacion'

// El listado del catálogo público: CU63 (visualizar el catálogo) y CU64
// (filtrar por categoría).
//
// Los productos se piden de a 20 al backend, que filtra, busca y ordena
// (corrección D3); "Cargar más" suma los 20 siguientes. Las categorías, con
// su cantidad de productos, las cargó el layout y llegan por
// useOutletContext.

export default function Catalogo() {
  const { grupos, esEscritorio } = useOutletContext()
  const ubicacion = useLocation()
  const [parametros, setParametros] = useSearchParams()
  const [filtrosAbierto, setFiltrosAbierto] = useState(false)

  // Lo que ya llegó del backend: los productos de las páginas pedidas, uno
  // detrás del otro, cuántos hay en total con los filtros puestos y cuál es
  // la última página pedida.
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState('')

  // Derivados: se calculan en cada dibujo a partir de la dirección y de
  // las listas, y no se guardan en estado. La dirección es la única que
  // sabe qué filtros hay.
  const idsElegidos = leerFiltros(parametros, grupos)
  const orden = leerOrden(parametros)
  const busqueda = leerBusqueda(parametros)
  const hayBusqueda = busqueda.trim() !== ''

  // La búsqueda se escribe en la dirección con cada letra, pero al backend
  // se manda 300 ms después de la última (debounce), para no pedir una
  // página por letra.
  const [busquedaEnviada, setBusquedaEnviada] = useState(busqueda)
  useEffect(() => {
    const espera = setTimeout(() => setBusquedaEnviada(busqueda), 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La primera página, cada vez que cambian los filtros, el orden o la
  // búsqueda: lo que se había cargado deja de valer y se vuelve a empezar.
  // Los ids van como texto para que el efecto compare valores y no la lista
  // nueva de cada dibujo. Si llegan dos respuestas fuera de orden, vigente
  // descarta la vieja.
  const claveDeFiltros = idsElegidos.join(',')
  useEffect(() => {
    let vigente = true
    const ids = claveDeFiltros === '' ? [] : claveDeFiltros.split(',')

    listarProductosDelCatalogo(parametrosDelCatalogo({ idsElegidos: ids, orden, busqueda: busquedaEnviada, pagina: 1 }))
      .then((res) => {
        if (!vigente) return
        setProductos(res.data.results)
        setTotal(res.data.count)
        setPagina(1)
        setError('')
      })
      .catch(() => {
        if (vigente) setError('No se pudo cargar el catálogo.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [claveDeFiltros, orden, busquedaEnviada])

  // "Cargar más": la página siguiente, que se suma debajo de las que ya
  // están.
  function cargarMas() {
    setCargandoMas(true)
    listarProductosDelCatalogo(parametrosDelCatalogo({ idsElegidos, orden, busqueda: busquedaEnviada, pagina: pagina + 1 }))
      .then((res) => {
        setProductos((anteriores) => [...anteriores, ...res.data.results])
        setTotal(res.data.count)
        setPagina(pagina + 1)
      })
      .catch(() => setError('No se pudieron cargar más productos.'))
      .finally(() => setCargandoMas(false))
  }

  // Sin productos de ningún tipo: el catálogo está vacío, no es que los
  // filtros no encontraron nada.
  const catalogoVacio = !cargando && total === 0 && idsElegidos.length === 0 && busquedaEnviada.trim() === ''

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

  // El desplegable de orden se dibuja en un lugar distinto según el ancho,
  // así que se define una vez acá y se ubica más abajo. Mide lo mismo que
  // el buscador y que Filtrar (44 de alto, letra 16, el mismo borde y
  // radio) y lleva el texto en el mismo celeste que Filtrar, para que la
  // barra sea pareja.
  //
  // La flecha nativa del desplegable la ubica cada navegador a su gusto, y
  // queda más pegada al borde que el texto. Por eso se apaga (appearance
  // none) y se dibuja una propia, a 12px del borde derecho, igual que el
  // texto está a 12px del izquierdo. pointerEvents none deja que el toque
  // sobre la flecha llegue al desplegable.
  const selectorDeOrden = (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <select
        value={orden}
        onChange={cambiarOrden}
        aria-label="Ordenar por"
        className="catalogo-campo"
        style={{
          appearance: 'none',
          minHeight: 44,
          padding: '0 38px 0 12px',
          border: '1px solid #E0E8EB',
          background: 'white',
          color: '#557385',
          borderRadius: 6,
          outline: 'none',
          cursor: 'pointer',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        {ORDENES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#557385"
        strokeWidth="2.2"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
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
          {/* Arriba de la grilla: el buscador, el orden y, solo en celular,
              el botón que abre el panel de filtros. En celular son dos
              filas: el buscador solo, y debajo el orden a la izquierda y
              Filtrar a la derecha, los tres con el mismo alto, borde, radio
              y letra. En escritorio es una sola fila, con el buscador a la
              izquierda y "Ordenar por" con el desplegable a la derecha. */}
          {!catalogoVacio && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginBottom: esEscritorio ? 16 : 12,
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

                {esEscritorio && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                    <span style={{ fontSize: 14, color: '#64727A' }}>Ordenar por</span>
                    {selectorDeOrden}
                  </div>
                )}
              </div>

              {!esEscritorio && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {selectorDeOrden}

                  {grupos.length > 0 && (
                    <button
                      onClick={() => setFiltrosAbierto(true)}
                      className="catalogo-suave"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        minHeight: 44,
                        padding: '0 14px',
                        border: '1px solid #E0E8EB',
                        background: 'white',
                        color: '#557385',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontFamily: QUICKSAND,
                        fontWeight: 600,
                        fontSize: 16,
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
            </>
          )}

          {cargando && (
            <p style={{ margin: 0, fontSize: 15, color: '#64727A' }}>Cargando…</p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                margin: '0 0 12px',
                padding: '14px 16px',
                background: '#FAEAE8',
                border: '1px solid #F0C4BC',
                borderRadius: 8,
                fontSize: 15,
                color: '#C0442F',
              }}
            >
              {error}
            </p>
          )}

          {catalogoVacio && (
            <CajaMensaje titulo="Todavía no hay productos en el catálogo." />
          )}

          {/* Sin resultados por la búsqueda, la salida limpia solo la
              búsqueda y deja los filtros; sin resultados por los filtros,
              lleva a todo el catálogo. */}
          {!cargando && !catalogoVacio && total === 0 && hayBusqueda && (
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

          {!cargando && !catalogoVacio && total === 0 && !hayBusqueda && (
            <CajaMensaje
              titulo="No hay piezas en esta categoría"
              texto="Probá con otra combinación o mirá todo el catálogo."
              textoSalida="Ver todas las piezas"
              ruta="/"
            />
          )}

          {productos.length > 0 && (
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
              {productos.map((producto, indice) => (
                <TarjetaCatalogo
                  key={producto.id}
                  producto={producto}
                  filtros={ubicacion.search}
                  indice={indice}
                />
              ))}
            </div>
          )}

          {/* De a 20: mientras queden productos sin mostrar, el botón trae
              los siguientes. Es un botón y no un enlace porque no cambia la
              dirección. */}
          {productos.length > 0 && productos.length < total && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="catalogo-suave"
                style={{
                  minHeight: 44,
                  padding: '0 24px',
                  border: '1px solid #E0E8EB',
                  background: 'white',
                  color: '#557385',
                  borderRadius: 6,
                  cursor: cargandoMas ? 'default' : 'pointer',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                {cargandoMas ? 'Cargando…' : 'Cargar más'}
              </button>
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
                {total === 0 ? 'Sin resultados' : `Ver ${textoPiezas(total)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
