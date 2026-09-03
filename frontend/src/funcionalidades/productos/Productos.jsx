import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarProductos, reactivarProducto } from './api'
import BotonAccion from './BotonAccion'
import TarjetaProducto from './TarjetaProducto'
import SeccionBajas from './SeccionBajas'
import ModalBajaProducto from './ModalBajaProducto'
import ModalEliminarProducto from './ModalEliminarProducto'
import ModalReactivarCategoria from './ModalReactivarCategoria'
import ModalFiltros from './ModalFiltros'
import { FILTROS_VACIOS, candidatos, contarFiltros, rangoDePrecios } from './filtros'

// Segundo import que cruza de funcionalidad, con el mismo criterio que el
// modal de reactivar: el endpoint de categorías vive en su carpeta y ahí se
// queda. Acá hace falta la lista completa para el filtro por categoría.
import { listarCategorias } from '../categorias/api'
import {
  ICONO_NUEVO,
  ICONO_CAJA,
  ICONO_BUSCAR,
  ICONO_FILTROS,
  ICONO_ALERTA,
  ICONO_GRILLA,
  ICONO_LISTA,
  CHEVRON_ABAJO,
  CHEVRON_ARRIBA,
  ORDEN_SIN_USAR,
  COLOR_DIFICULTAD,
  formatearPrecio,
  estadoCatalogo,
  avisoMateriales,
  textoDificultad,
  accionesDe,
} from './presentacion'


// Para ordenar por dificultad hay que decir el orden a mano: alfabéticamente
// daría ALTA, BAJA, MEDIA, que no significa nada.
const ORDEN_DIFICULTAD = { BAJA: 0, MEDIA: 1, ALTA: 2 }

const ORDENES = [
  { valor: '', label: 'Sin ordenar' },
  { valor: 'nombre:asc', label: 'Nombre A–Z' },
  { valor: 'nombre:desc', label: 'Nombre Z–A' },
  { valor: 'precio:asc', label: 'Precio: menor primero' },
  { valor: 'precio:desc', label: 'Precio: mayor primero' },
  { valor: 'dificultad:asc', label: 'Dificultad: baja primero' },
  { valor: 'dificultad:desc', label: 'Dificultad: alta primero' },
]


function FilaProducto({ producto, acciones }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogo(producto)
  const aviso = avisoMateriales(producto)

  return (
    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
      <td style={{ padding: 16 }}>
        <button
          onClick={() => acciones.onVer(producto)}
          className="btn-nombre-producto"
          style={{
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            color: '#3D3238',
            textAlign: 'left',
          }}
        >
          {producto.nombre}
        </button>

        {aviso && (
          <span
            title={aviso}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              verticalAlign: 'middle',
              marginLeft: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              border: '1px solid #EEDCB4',
              background: '#FDF3E0',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8862B" strokeWidth="2.1">
              <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALERTA} />
            </svg>
          </span>
        )}
      </td>

      <td
        style={{
          padding: 16,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: '#8C5A66',
        }}
      >
        {formatearPrecio(producto.precio_actual)}
      </td>

      <td style={{ padding: 16 }}>
        <span
          style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 20,
            padding: '6px 16px',
            border: `1px solid ${dificultad.color}`,
            background: dificultad.fondo,
            color: dificultad.color,
          }}
        >
          {textoDificultad(producto)}
        </span>
      </td>

      <td style={{ padding: 16, fontSize: 14, color: '#857078' }}>
        {producto.categorias.length === 0
          ? 'Sin categorías'
          : producto.categorias.map((c) => c.nombre).join(' · ')}
      </td>

      <td style={{ padding: 16 }}>
        <span
          title={catalogo.title}
          style={{
            display: 'inline-block',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: 20,
            padding: '6px 16px',
            border: `1px solid ${catalogo.color}`,
            background: catalogo.fondo,
            color: catalogo.color,
          }}
        >
          {catalogo.texto}
        </span>
      </td>

      <td style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {accionesDe(producto, acciones).map((a) => (
            <BotonAccion
              key={a.title}
              onClick={a.onClick}
              titulo={a.title}
              color={a.color}
              hover={a.hover}
              icono={a.icono}
            />
          ))}
        </div>
      </td>
    </tr>
  )
}

function EstadoVacio({ onNuevo }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: '64px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 16,
          background: '#FAF7F7',
          border: '1px solid #EBE0E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DCC9CD" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAJA} />
        </svg>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 19,
          color: '#3D3238',
        }}
      >
        Todavía no cargaste ningún producto
      </p>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Cargá tus piezas con su precio y dificultad. Después podés sumarles
        materiales, fotos y categorías.
      </p>

      <button
        onClick={onNuevo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
          padding: '10px 20px',
          background: '#8C5A66',
          color: 'white',
          border: 0,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" d={ICONO_NUEVO} />
        </svg>
        Cargar el primero
      </button>
    </div>
  )
}

function SinResultados() {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: 48,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: '#3D3238',
        }}
      >
        Ningún producto coincide
      </p>
      <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
        Probá con otra búsqueda o limpiá los filtros.
      </p>
    </div>
  )
}

export default function Productos() {
  const navegar = useNavigate()
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState('grid')
  const [sortBy, setSortBy] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [bajasAbierto, setBajasAbierto] = useState(false)
  const [catsColapsadas, setCatsColapsadas] = useState([])
  const [productoDandoBaja, setProductoDandoBaja] = useState(null)
  const [productoEliminando, setProductoEliminando] = useState(null)
  const [categoriaReactivando, setCategoriaReactivando] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAbierto, setFiltrosAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    listarProductos()
      .then((res) => setProductos(res.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setCargando(false))

    // Las categorías se piden acá y no adentro del modal porque hacen falta
    // también afuera: el filtro guarda ids, y los chips de arriba de la
    // grilla tienen que mostrar el nombre de cada una.
    listarCategorias()
      .then((res) => setCategorias(res.data))
      .catch(() => setError('No se pudieron cargar las categorías.'))
  }, [])


  function recargar() {
    setCargando(true)
    listarProductos()
      .then((res) => setProductos(res.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setCargando(false))
  }

  async function cambiarEstado(producto, accion) {
    try {
      await accion(producto.id)
      recargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
  }


  function ordenarPor(campo) {
    setSortDir(sortBy === campo && sortDir === 'asc' ? 'desc' : 'asc')
    setSortBy(campo)
  }


  // Derivados: se calculan en cada render a partir del estado y no se
  // guardan. Los campos visible_en_catalogo, oculto_por_categoria y
  // categorias_de_baja vienen ya resueltos del backend.
  const activos = productos.filter((p) => p.estado === 'ACTIVO')
  const deBaja = productos.filter((p) => p.estado === 'BAJA')

  // Un producto activo con una categoría de baja NO va a la grilla: sale
  // solo en la sección de abajo, agrupado bajo su categoría. Así ningún
  // producto aparece en dos lugares a la vez.
  const porCategoria = activos.filter((p) => p.categorias_de_baja.length > 0)
  const enGrilla = activos.filter((p) => p.categorias_de_baja.length === 0)

  const publicables = activos.filter((p) => p.visible_en_catalogo).length

  // enGrilla se usa solo para la línea de resumen, que cuenta los activos
  // sin importar los filtros: tiene que seguir diciendo la verdad aunque la
  // grilla esté filtrada.
  //
  // La grilla sale de candidatos(), que además del buscador aplica los
  // filtros y respeta el criterio de estado: sin elegir nada, los activos.
  const filtrados = candidatos(productos, filtros, busqueda)

  const cantidadFiltros = contarFiltros(filtros)

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo:
  // saca su valor del criterio al que pertenece y deja el resto igual.
  function quitarDe(campo, valor) {
    setFiltros({ ...filtros, [campo]: filtros[campo].filter((v) => v !== valor) })
  }

  const chips = []

  filtros.estados.forEach((e) =>
    chips.push({
      clave: `estado-${e}`,
      label: e === 'ACTIVO' ? 'Activos' : 'Dados de baja',
      onQuitar: () => quitarDe('estados', e),
    })
  )

  filtros.categorias.forEach((id) => {
    const categoria = categorias.find((c) => c.id === id)
    if (categoria) {
      chips.push({
        clave: `cat-${id}`,
        label: categoria.nombre,
        onQuitar: () => quitarDe('categorias', id),
      })
    }
  })

  filtros.dificultades.forEach((d) =>
    chips.push({
      clave: `dif-${d}`,
      label: `Dificultad ${d.toLowerCase()}`,
      onQuitar: () => quitarDe('dificultades', d),
    })
  )

  filtros.tipo.forEach((t) =>
    chips.push({ clave: `tipo-${t}`, label: t, onQuitar: () => quitarDe('tipo', t) })
  )

  if (filtros.desde !== null || filtros.hasta !== null) {
    const rango = rangoDePrecios(productos)
    chips.push({
      clave: 'precio',
      label: `${formatearPrecio(filtros.desde === null ? rango.min : filtros.desde)} – ${formatearPrecio(
        filtros.hasta === null ? rango.max : filtros.hasta
      )}`,
      onQuitar: () => setFiltros({ ...filtros, desde: null, hasta: null }),
    })
  }

  const visibles = !sortBy
    ? filtrados
    : filtrados.slice().sort((x, y) => {
        const dir = sortDir === 'asc' ? 1 : -1

        if (sortBy === 'nombre') return x.nombre.localeCompare(y.nombre, 'es') * dir
        if (sortBy === 'precio') return (Number(x.precio_actual) - Number(y.precio_actual)) * dir
        if (sortBy === 'dificultad') {
          return (ORDEN_DIFICULTAD[x.dificultad] - ORDEN_DIFICULTAD[y.dificultad]) * dir
        }
        return (x.categorias.length - y.categorias.length) * dir
      })

  // El árbol de bajas por categoría se arma con las categorías que ya
  // vienen adentro de cada producto, en categorias_de_baja: llegan
  // completas, con nombre, tipo y tipo_display. No hace falta pedirlas.
  const grupos = []
  porCategoria.forEach((producto) => {
    producto.categorias_de_baja.forEach((categoria) => {
      const grupo = grupos.find((g) => g.categoria.id === categoria.id)
      if (grupo) {
        grupo.productos.push(producto)
      } else {
        grupos.push({ categoria, productos: [producto] })
      }
    })
  })

  const COLUMNAS = [
    { campo: 'nombre', label: 'PRODUCTO' },
    { campo: 'precio', label: 'PRECIO' },
    { campo: 'dificultad', label: 'DIFICULTAD' },
    { campo: 'categorias', label: 'CATEGORÍAS' },
  ]

  const VISTAS = [
    { id: 'grid', title: 'Ver como imágenes', icono: ICONO_GRILLA },
    { id: 'lista', title: 'Ver como lista', icono: ICONO_LISTA },
  ]


  const acciones = {
    onVer: (p) => navegar(`/productos/${p.id}`),
    onDarDeBaja: (p) => setProductoDandoBaja(p),
    onEliminar: (p) => setProductoEliminando(p),
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 32,
            color: '#3D3238',
          }}
        >
          Gestión de Productos
        </h1>

        {/* TODO(paso siguiente): el alta abre la ficha vacía. */}
        <button
          onClick={() => {}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            background: '#8C5A66',
            color: 'white',
            border: 0,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" d={ICONO_NUEVO} />
          </svg>
          Nuevo producto
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>
        {`${enGrilla.length} productos activos · ${publicables} visibles en el catálogo público`}
      </p>


      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}
      {cargando && <p style={{ color: '#857078' }}>Cargando…</p>}


      {!cargando && productos.length === 0 && <EstadoVacio onNuevo={() => {}} />}

      {!cargando && productos.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', width: 420 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#857078"
                strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              >
                <path strokeLinecap="round" d={ICONO_BUSCAR} />
              </svg>

              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto..."
                style={{
                  width: '100%',
                  padding: '8px 16px 8px 36px',
                  border: '1px solid #EBE0E2',
                  background: 'white',
                  fontSize: 16,
                  color: '#3D3238',
                  borderRadius: 5,
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={() => setFiltrosAbierto(true)}
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 12px',
                minWidth: 130,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                border: cantidadFiltros > 0 ? '1px solid #8C5A66' : '1px solid #EBE0E2',
                background: cantidadFiltros > 0 ? '#F0E2E4' : 'white',
                color: '#8C5A66',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
              </svg>
              Filtros
              {cantidadFiltros > 0 && (
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                    borderRadius: 10,
                    background: '#8C5A66',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {cantidadFiltros}
                </span>
              )}
            </button>

            <select
              value={sortBy ? `${sortBy}:${sortDir}` : ''}
              onChange={(e) => {
                const valor = e.target.value
                if (!valor) {
                  setSortBy(null)
                  return
                }
                const [campo, direccion] = valor.split(':')
                setSortBy(campo)
                setSortDir(direccion)
              }}
              title="Ordenar"
              style={{
                padding: '8px 12px',
                border: '1px solid #EBE0E2',
                background: 'white',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                color: '#8C5A66',
                borderRadius: 5,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: 3,
                background: 'white',
                border: '1px solid #EBE0E2',
                borderRadius: 6,
              }}
            >
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVista(v.id)}
                  title={v.title}
                  style={{
                    width: 34,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 0,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: vista === v.id ? '#F0E2E4' : 'transparent',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={vista === v.id ? '#8C5A66' : '#B08791'}
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={v.icono} />
                  </svg>
                </button>
              ))}
            </div>
          </div>


          {chips.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 20,
              }}
            >
              {chips.map((chip) => (
                <button
                  key={chip.clave}
                  onClick={chip.onQuitar}
                  className="chip-filtro"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 12px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    border: '1px solid #8C5A66',
                    background: '#F0E2E4',
                    color: '#8C5A66',
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {chip.label}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}

              <button
                onClick={() => setFiltros(FILTROS_VACIOS)}
                style={{
                  padding: '6px 12px',
                  border: 0,
                  background: 'transparent',
                  color: '#857078',
                  cursor: 'pointer',
                  fontSize: 14,
                  textDecoration: 'underline',
                }}
              >
                Limpiar todo
              </button>
            </div>
          )}


          {vista === 'grid' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(238px, 1fr))',
                gap: 18,
              }}
            >
              {visibles.map((p) => (
                <TarjetaProducto key={p.id} producto={p} acciones={acciones} />
              ))}

              {visibles.length === 0 && <SinResultados />}
            </div>
          )}

          {vista === 'lista' && (
            <div style={{ background: 'white', border: '1px solid #EBE0E2', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0E2E4' }}>
                    {COLUMNAS.map((col) => (
                      <th key={col.campo} style={{ textAlign: 'left', padding: 0 }}>
                        <button
                          onClick={() => ordenarPor(col.campo)}
                          className="btn-columna"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            width: '100%',
                            padding: '12px 16px',
                            border: 0,
                            background: 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: "'Quicksand', sans-serif",
                            fontWeight: 600,
                            fontSize: 13,
                            color: '#8C5A66',
                            letterSpacing: '.06em',
                          }}
                        >
                          {col.label}
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ opacity: sortBy === col.campo ? 1 : 0.4 }}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={
                                sortBy === col.campo
                                  ? sortDir === 'asc'
                                    ? CHEVRON_ARRIBA
                                    : CHEVRON_ABAJO
                                  : ORDEN_SIN_USAR
                              }
                            />
                          </svg>
                        </button>
                      </th>
                    ))}

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#8C5A66',
                        letterSpacing: '.06em',
                      }}
                    >
                      CATÁLOGO
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#8C5A66',
                        letterSpacing: '.06em',
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibles.map((p) => (
                    <FilaProducto key={p.id} producto={p} acciones={acciones} />
                  ))}

                  {visibles.length === 0 && (
                    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
                      <td colSpan="6" style={{ padding: 32, textAlign: 'center', fontSize: 15, color: '#857078' }}>
                        Ningún producto coincide con esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}


          {!filtros.estados.includes('BAJA') && (
          <SeccionBajas
            deBaja={deBaja}
            grupos={grupos}
            abierto={bajasAbierto}
            onToggle={() => setBajasAbierto((v) => !v)}
            colapsadas={catsColapsadas}
            onToggleCategoria={(id) =>
              setCatsColapsadas((actual) =>
                actual.includes(id) ? actual.filter((x) => x !== id) : actual.concat(id)
              )
            }
            onVer={acciones.onVer}
            onReactivarProducto={(p) => cambiarEstado(p, reactivarProducto)}
            onReactivarCategoria={(categoria) => setCategoriaReactivando(categoria)}
          />
          )}
        </>
      )}


      {productoDandoBaja && (
        <ModalBajaProducto
          producto={productoDandoBaja}
          onCerrar={() => setProductoDandoBaja(null)}
          onConfirmado={() => {
            setProductoDandoBaja(null)
            recargar()
          }}
        />
      )}

      {productoEliminando && (
        <ModalEliminarProducto
          producto={productoEliminando}
          onCerrar={() => setProductoEliminando(null)}
          onEliminado={() => {
            setProductoEliminando(null)
            recargar()
          }}
        />
      )}

      {filtrosAbierto && (
        <ModalFiltros
          filtros={filtros}
          productos={productos}
          busqueda={busqueda}
          // Solo las activas: filtrar por una categoría de baja no tendría
          // sentido, porque sus productos no están en la grilla.
          categorias={categorias.filter((c) => c.estado === 'ACTIVO')}
          onCerrar={() => setFiltrosAbierto(false)}
          onAplicar={(borrador) => {
            setFiltros(borrador)
            setFiltrosAbierto(false)
          }}
        />
      )}

      {categoriaReactivando && (
        <ModalReactivarCategoria
          categoria={categoriaReactivando}
          // Cuántos productos vuelven al catálogo con ella: sale del grupo
          // que ya armamos más arriba para el árbol de dados de baja.
          cantidadProductos={
            grupos.find((g) => g.categoria.id === categoriaReactivando.id)
              ?.productos.length ?? 0
          }
          onCerrar={() => setCategoriaReactivando(null)}
          onConfirmado={() => {
            setCategoriaReactivando(null)
            // Se recargan los productos y no las categorías: reactivar la
            // categoría cambia la visibilidad de todos los suyos, y esos
            // campos los recalcula el backend en cada consulta.
            recargar()
          }}
        />
      )}
    </div>
  )
}
