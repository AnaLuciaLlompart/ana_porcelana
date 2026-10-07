import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ESCRITORIO_CATALOGO, INSTAGRAM_URL, INSTAGRAM_USUARIO } from '../constantes'
import IconoInstagram from './IconoInstagram'
import PiePublico from './PiePublico'

// Estos imports cruzan a una funcionalidad, al revés de lo habitual: el
// layout público es el que carga el catálogo, arma el árbol de categorías
// y guarda la selección, pero los endpoints, la lectura de los filtros y
// las operaciones de la selección viven en la carpeta del catálogo, que
// es donde corresponde. Se usan desde ahí en vez de copiarse acá.
import {
  listarCategoriasDelCatalogo,
  listarProductosDelCatalogo,
} from '../funcionalidades/catalogo/api'
import { agruparCategorias, leerFiltros } from '../funcionalidades/catalogo/filtros'
import {
  LARGO_MAXIMO_ACLARACIONES,
  agregar,
  cantidadTotal,
  guardarSeleccion,
  itemsDeLaSeleccion,
  leerSeleccionGuardada,
  modificar,
  quitar,
  totalOrientativo,
} from '../funcionalidades/catalogo/seleccion'
import { ICONO_CORAZON } from '../funcionalidades/catalogo/presentacion'
import ToastCatalogo from '../funcionalidades/catalogo/ToastCatalogo'

// El layout del catálogo público: lo que ve un visitante sin sesión. Es
// independiente de Layout.jsx, el de la gestión: no usa AuthContext ni
// comparte nada con él. Se diseñó primero para celular, así que los
// estilos en línea son la versión de celular y lo que cambia en escritorio
// lo decide useEsEscritorio (la estructura) o una clase catalogo-* de
// index.css (las medidas).

const QUICKSAND = "'Quicksand', sans-serif"

const ICONO_MENU = 'M4 6h16M4 12h16M4 18h16'
const ICONO_CERRAR = 'M6 18L18 6M6 6l12 12'
const ICONO_FLECHA = 'M19 9l-7 7-7-7'


// Dice si el ancho es de escritorio (900px o más) y se actualiza solo
// cuando la ventana cruza ese ancho. Es usePantallaChica de Layout.jsx con
// la consulta del catálogo. El layout es el único que lo llama y le pasa
// el resultado a las pantallas, así hay una sola escucha y todas cambian a
// la vez.
function useEsEscritorio() {
  const [esEscritorio, setEsEscritorio] = useState(() => window.matchMedia(ESCRITORIO_CATALOGO).matches)

  useEffect(() => {
    const consulta = window.matchMedia(ESCRITORIO_CATALOGO)
    const actualizar = (evento) => setEsEscritorio(evento.matches)
    consulta.addEventListener('change', actualizar)
    return () => consulta.removeEventListener('change', actualizar)
  }, [])

  return esEscritorio
}


// La flecha de lo que se abre y se cierra: apunta para abajo y gira cuando
// está abierto.
function Flecha({ lado, abierto }) {
  return (
    <svg
      width={lado}
      height={lado}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      style={{ flexShrink: 0, transition: 'transform .15s', transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
    </svg>
  )
}


// Un renglón del panel de celular. Puede ser de dos clases:
//
// - Con `ruta` es un enlace: lleva al catálogo o a una categoría, y se
//   puede abrir en otra pestaña.
// - Sin ella es un botón: abre o cierra una rama del árbol, no lleva a
//   ningún lado. En ese caso recibe `abierto`, que dibuja la flecha.
function ItemPanel({ texto, sangria = 10, activo = false, ruta, abierto, onClick }) {
  const estilo = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: 44,
    padding: `0 10px 0 ${sangria}px`,
    borderRadius: 6,
    border: 0,
    cursor: 'pointer',
    textAlign: 'left',
    textDecoration: 'none',
    color: activo ? 'white' : 'rgba(255,255,255,.85)',
    background: activo ? 'rgba(255,255,255,.18)' : 'transparent',
  }

  const nombre = (
    <span style={{ flex: 1, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
      {texto}
    </span>
  )

  if (ruta) {
    return (
      <Link to={ruta} onClick={onClick} className="catalogo-item-panel" style={estilo}>
        {nombre}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className="catalogo-item-panel" style={estilo}>
      {nombre}
      <Flecha lado={16} abierto={abierto} />
    </button>
  )
}


export default function LayoutPublico() {
  const esEscritorio = useEsEscritorio()
  const ubicacion = useLocation()
  const [parametros] = useSearchParams()

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // La selección (CU66 a CU69): las cantidades por producto y las
  // aclaraciones. Arrancan con lo guardado en localStorage, si hay, y se
  // vuelven a guardar cada vez que cambian (el efecto de más abajo). Viven
  // acá y no en una pantalla porque las leen el encabezado, el detalle, la
  // selección y el mensaje.
  const [cantidades, setCantidades] = useState(() => leerSeleccionGuardada().cantidades)
  const [aclaraciones, setAclaraciones] = useState(() => leerSeleccionGuardada().aclaraciones)

  // El aviso flotante: { texto, rutaAccion } o null. Vive acá para seguir
  // a la vista aunque cambie la pantalla: su "Ver" lleva a otra.
  const [aviso, setAviso] = useState(null)
  const temporizadorAviso = useRef(null)

  // El panel de celular y el desplegable de escritorio. Son dos estados
  // porque son dos cosas distintas, aunque muestren el mismo árbol.
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [desplegableAbierto, setDesplegableAbierto] = useState(false)

  // Las ramas del árbol del panel de celular. Arrancan como en el diseño:
  // Productos abierto y Categorías cerrado.
  const [productosAbierto, setProductosAbierto] = useState(true)
  const [categoriasAbierto, setCategoriasAbierto] = useState(false)

  // El catálogo se carga UNA vez, acá, y no en cada pantalla: el listado y
  // el árbol de categorías del encabezado usan las mismas dos listas.
  // Promise.all espera a las dos juntas, así no hay un momento con los
  // productos ya cargados y las categorías todavía no.
  useEffect(() => {
    Promise.all([listarProductosDelCatalogo(), listarCategoriasDelCatalogo()])
      .then(([resProductos, resCategorias]) => {
        setProductos(resProductos.data)
        setCategorias(resCategorias.data)
      })
      .catch(() => setError('No se pudo cargar el catálogo.'))
      .finally(() => setCargando(false))
  }, [])

  // Cada cambio de la selección se guarda. Corre también al montar, con lo
  // recién leído: escribe lo mismo que había.
  useEffect(() => {
    guardarSeleccion(cantidades, aclaraciones)
  }, [cantidades, aclaraciones])

  // Al cambiar de pantalla se vuelve arriba, como el ir() del diseño. Sin
  // esto, al abrir un producto desde el final del listado el detalle
  // aparecería ya bajado. Depende de la ruta y no de la consulta: tildar
  // un filtro no tiene que mover la página.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [ubicacion.pathname])

  // El panel solo existe en celular y el desplegable solo en escritorio.
  // Si la ventana cruza los 900px con uno abierto, su estado queda en true
  // pero no se ve nada, y al volver reaparece como se lo dejó.
  const panelAbierto = !esEscritorio && menuAbierto
  const desplegableVisible = esEscritorio && desplegableAbierto
  const algoAbierto = panelAbierto || desplegableVisible

  // Escape cierra lo que esté abierto. Se escucha solo mientras lo está.
  useEffect(() => {
    if (!algoAbierto) return
    function alTeclear(evento) {
      if (evento.key === 'Escape') {
        setMenuAbierto(false)
        setDesplegableAbierto(false)
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [algoAbierto])

  // Derivados: se calculan en cada dibujo y no se guardan en estado.
  const grupos = agruparCategorias(categorias, productos)
  const enCatalogo = ubicacion.pathname === '/'
  const enProductos = enCatalogo || ubicacion.pathname.startsWith('/productos/')
  const enComoPedir = ubicacion.pathname === '/como-hacer-un-pedido'
  const enTips = ubicacion.pathname === '/tips'
  // Los filtros solo significan algo en el listado. En el detalle la
  // dirección no los lleva, y no hay que marcar ninguna categoría.
  const idsElegidos = enCatalogo ? leerFiltros(parametros, grupos) : []

  // Los ítems de la selección con su producto, y cuántas piezas suman. Se
  // calculan acá porque el encabezado necesita el contador; el total va en
  // el contexto, para la pantalla de la selección.
  const items = itemsDeLaSeleccion(cantidades, productos)
  const piezas = cantidadTotal(items)

  // Lo que pasa al elegir algo del árbol o tocar el logo: se cierra lo que
  // estuviera abierto y se vuelve arriba. El scroll va a mano porque al
  // elegir una categoría desde el listado la ruta no cambia, solo la
  // consulta, y el efecto de más arriba no se entera.
  function alElegir() {
    setMenuAbierto(false)
    setDesplegableAbierto(false)
    window.scrollTo(0, 0)
  }

  // El estilo de los tres ítems de la barra de escritorio. El activo lleva
  // la línea celeste debajo y el texto celeste; los otros, el texto gris.
  function estiloItemBarra(activo) {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 46,
      padding: '0 16px',
      border: 0,
      borderBottom: `2px solid ${activo ? '#5A7A8C' : 'transparent'}`,
      background: 'transparent',
      cursor: 'pointer',
      textDecoration: 'none',
      fontFamily: QUICKSAND,
      fontWeight: 600,
      fontSize: 15,
      color: activo ? '#5A7A8C' : '#323A3D',
    }
  }

  // Las cuatro operaciones de la selección, con los verbos de los casos de
  // uso. Cada una le pide a seleccion.js el objeto nuevo a partir del
  // actual: el estado nunca se modifica en el lugar.

  // CU66 - Agregar producto a la selección.
  function agregarProducto(id) {
    setCantidades((actuales) => agregar(actuales, id))
  }

  // CU67 - Modificar cantidad.
  function modificarCantidad(id, cantidad) {
    setCantidades((actuales) => modificar(actuales, id, cantidad))
  }

  // CU68 - Quitar producto de la selección.
  function quitarProducto(id) {
    setCantidades((actuales) => quitar(actuales, id))
  }

  // CU69 - Registrar aclaraciones.
  function registrarAclaraciones(texto) {
    setAclaraciones(texto.slice(0, LARGO_MAXIMO_ACLARACIONES))
  }

  // Muestra el aviso 2,8 segundos, el tiempo del diseño, y cancela el
  // anterior, como mostrarToast en Clientes: si no, al agregar dos piezas
  // seguidas el temporizador de la primera apagaría el aviso de la segunda
  // antes de tiempo.
  function mostrarAviso(texto, rutaAccion) {
    setAviso({ texto, rutaAccion })
    clearTimeout(temporizadorAviso.current)
    temporizadorAviso.current = setTimeout(() => setAviso(null), 2800)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#F7F9FA',
        color: '#323A3D',
      }}
    >
      <div
        style={{
          background: '#5A7A8C',
          textAlign: 'center',
          padding: '8px 16px',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 13,
          color: 'white',
          textWrap: 'pretty',
        }}
      >
        Piezas hechas a mano en porcelana fría · Entregas en Tucumán · Consultas por Instagram
      </div>

      <header style={{ background: 'white', borderBottom: '1px solid #E0E8EB', position: 'sticky', top: 0, zIndex: 50 }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 64,
            padding: '0 12px',
          }}
        >
          {/* Los dos costados miden lo mismo (flex: 1), así el logo queda
              centrado tengan lo que tengan adentro. */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            {esEscritorio ? (
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="catalogo-instagram"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#5A7A8C',
                }}
              >
                <IconoInstagram lado={18} />
                @{INSTAGRAM_USUARIO}
              </a>
            ) : (
              <button
                onClick={() => setMenuAbierto(true)}
                title="Menú"
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
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5A7A8C" strokeWidth="2">
                  <path strokeLinecap="round" d={ICONO_MENU} />
                </svg>
              </button>
            )}
          </div>

          <Link
            to="/"
            onClick={alElegir}
            className="catalogo-logo"
            style={{
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              fontFamily: QUICKSAND,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '.02em',
              color: '#5A7A8C',
            }}
          >
            Ana Porcelana
          </Link>

          {/* "Mi selección" lleva a la pantalla de la selección: es un
              enlace. El contador aparece recién cuando hay algo elegido. */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              to="/seleccion"
              title="Mi selección"
              className="catalogo-suave"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 44,
                padding: '0 8px',
                whiteSpace: 'nowrap',
                borderRadius: 6,
                textDecoration: 'none',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 14,
                color: '#5A7A8C',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5A7A8C" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CORAZON} />
              </svg>
              <span>Mi selección</span>
              {piezas > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 10,
                    background: '#5A7A8C',
                    fontFamily: QUICKSAND,
                    fontWeight: 700,
                    fontSize: 12,
                    color: 'white',
                  }}
                >
                  {piezas}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Solo en escritorio: la barra de navegación. Hoy tiene un solo
            ítem; los otros dos del diseño son de la etapa E. */}
        {esEscritorio && (
          <nav style={{ borderTop: '1px solid #E0E8EB', position: 'relative' }}>
            <div
              style={{
                maxWidth: 1200,
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '0 12px',
              }}
            >
              {/* "Productos" es un botón: abre el desplegable, no navega.
                  Los otros dos son enlaces a sus páginas. */}
              <button
                onClick={() => setDesplegableAbierto((abierto) => !abierto)}
                className="catalogo-item"
                style={estiloItemBarra(enProductos)}
              >
                Productos
                <Flecha lado={14} abierto={desplegableAbierto} />
              </button>
              <Link to="/como-hacer-un-pedido" onClick={alElegir} className="catalogo-item" style={estiloItemBarra(enComoPedir)}>
                Cómo hacer un pedido
              </Link>
              <Link to="/tips" onClick={alElegir} className="catalogo-item" style={estiloItemBarra(enTips)}>
                Tips para tus piezas
              </Link>
            </div>

            {desplegableAbierto && (
              <>
                {/* Una capa invisible que ocupa toda la pantalla, por
                    debajo del desplegable: un clic en cualquier lugar de
                    afuera cae en ella y lo cierra. */}
                <div
                  onClick={() => setDesplegableAbierto(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />

                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '100%',
                    transform: 'translateX(-50%)',
                    zIndex: 45,
                    display: 'grid',
                    // Una columna para "Ver todos" y una más por cada grupo
                    // de categorías que haya.
                    gridTemplateColumns: `repeat(${grupos.length + 1}, minmax(160px, auto))`,
                    gap: 28,
                    padding: '22px 28px',
                    background: 'white',
                    border: '1px solid #E0E8EB',
                    borderTop: 0,
                    borderRadius: '0 0 10px 10px',
                    boxShadow: '0 12px 30px rgba(50,58,61,.08)',
                  }}
                >
                  <div>
                    <Link
                      to="/"
                      onClick={alElegir}
                      className="catalogo-subrayado"
                      style={{
                        display: 'block',
                        padding: '6px 0',
                        textDecoration: 'none',
                        fontFamily: QUICKSAND,
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#5A7A8C',
                      }}
                    >
                      Ver todos los productos
                    </Link>
                  </div>

                  {grupos.map((grupo) => (
                    <div key={grupo.tipo}>
                      <p
                        style={{
                          margin: '0 0 8px',
                          fontFamily: QUICKSAND,
                          fontWeight: 600,
                          fontSize: 12,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          color: '#708085',
                        }}
                      >
                        {grupo.titulo}
                      </p>

                      {grupo.categorias.map((categoria) => (
                        <Link
                          key={categoria.id}
                          to={`/?categoria=${categoria.id}`}
                          onClick={alElegir}
                          className="catalogo-item"
                          style={{
                            display: 'block',
                            padding: '5px 0',
                            textDecoration: 'none',
                            fontSize: 15,
                            color: '#323A3D',
                          }}
                        >
                          {categoria.nombre}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </nav>
        )}
      </header>

      <main
        className="catalogo-contenido"
        style={{ flex: 1, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '16px 16px 0' }}
      >
        {cargando && (
          <p style={{ margin: 0, fontSize: 15, color: '#708085' }}>Cargando…</p>
        )}

        {!cargando && error && (
          <p
            role="alert"
            style={{
              margin: 0,
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

        {/* Las pantallas recién se dibujan cuando el catálogo ya llegó, y
            lo leen con useOutletContext. Así ninguna tiene que preguntarse
            si la lista todavía está en camino. */}
        {!cargando && !error && (
          <Outlet
            context={{
              productos,
              grupos,
              esEscritorio,
              seleccion: {
                cantidades,
                items,
                piezas,
                total: totalOrientativo(items),
                aclaraciones,
                agregarProducto,
                modificarCantidad,
                quitarProducto,
                registrarAclaraciones,
              },
              mostrarAviso,
            }}
          />
        )}
      </main>

      <PiePublico grupos={grupos} alElegir={alElegir} />

      {/* Fondo oscuro detrás del panel de celular. Tocarlo cierra el menú. */}
      {panelAbierto && (
        <div
          onClick={() => setMenuAbierto(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(50,58,61,.5)' }}
        />
      )}

      {/* El panel de celular. Está siempre en la página, corrido fuera de
          la pantalla, y lo que lo trae es el transform: por eso se desliza
          en vez de aparecer de golpe. Va todo en línea y sin clase porque
          esta ES la versión de celular. inert hace que, mientras está
          cerrado, el teclado y los lectores de pantalla no entren a
          botones que no se ven. */}
      {!esEscritorio && (
        <aside
          inert={!menuAbierto}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 61,
            width: 290,
            maxWidth: '85vw',
            display: 'flex',
            flexDirection: 'column',
            background: '#5A7A8C',
            boxShadow: menuAbierto ? '0 0 40px rgba(50,58,61,.3)' : 'none',
            transform: menuAbierto ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .2s',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
              flexShrink: 0,
              padding: '0 8px 0 16px',
              borderBottom: '1px solid rgba(255,255,255,.15)',
            }}
          >
            <span style={{ fontFamily: QUICKSAND, fontWeight: 600, fontSize: 17, color: 'white' }}>
              Ana Porcelana
            </span>
            <button
              onClick={() => setMenuAbierto(false)}
              title="Cerrar"
              className="catalogo-item-panel"
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path strokeLinecap="round" d={ICONO_CERRAR} />
              </svg>
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '10px 8px',
            }}
          >
            <ItemPanel
              texto="Productos"
              abierto={productosAbierto}
              onClick={() => setProductosAbierto((abierto) => !abierto)}
            />

            {productosAbierto && (
              <ItemPanel
                texto="Ver todos los productos"
                sangria={22}
                ruta="/"
                activo={enCatalogo && idsElegidos.length === 0}
                onClick={alElegir}
              />
            )}

            {productosAbierto && grupos.length > 0 && (
              <ItemPanel
                texto="Categorías"
                sangria={22}
                abierto={categoriasAbierto}
                onClick={() => setCategoriasAbierto((abierto) => !abierto)}
              />
            )}

            {productosAbierto && categoriasAbierto && grupos.map((grupo) => (
              <div key={grupo.tipo} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <p
                  style={{
                    margin: '10px 0 4px',
                    padding: '0 10px 0 34px',
                    fontFamily: QUICKSAND,
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.55)',
                  }}
                >
                  {grupo.titulo}
                </p>

                {grupo.categorias.map((categoria) => (
                  <ItemPanel
                    key={categoria.id}
                    texto={categoria.nombre}
                    sangria={34}
                    ruta={`/?categoria=${categoria.id}`}
                    activo={idsElegidos.includes(categoria.id)}
                    onClick={alElegir}
                  />
                ))}
              </div>
            ))}

            {/* Las dos páginas de texto, al mismo nivel que Productos. */}
            <ItemPanel
              texto="Cómo hacer un pedido"
              ruta="/como-hacer-un-pedido"
              activo={enComoPedir}
              onClick={alElegir}
            />
            <ItemPanel
              texto="Tips para tus piezas"
              ruta="/tips"
              activo={enTips}
              onClick={alElegir}
            />
          </div>

          <div style={{ flexShrink: 0, padding: '8px 8px 16px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="catalogo-item-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                height: 44,
                padding: '0 10px',
                borderRadius: 6,
                textDecoration: 'none',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 15,
                color: 'rgba(255,255,255,.85)',
              }}
            >
              <IconoInstagram lado={20} />
              @{INSTAGRAM_USUARIO}
            </a>
          </div>
        </aside>
      )}

      {/* El aviso flotante, por encima de todo lo demás. */}
      {aviso && (
        <ToastCatalogo
          texto={aviso.texto}
          rutaAccion={aviso.rutaAccion}
          onAccion={() => setAviso(null)}
        />
      )}
    </div>
  )
}
