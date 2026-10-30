import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  exportarProductosAExcel,
  listarProductos,
  reactivarProducto,
  resumenDeProductos,
  urlExportarProductosPdf,
} from './api'
import BotonAccion from '../../componentes/BotonAccion'
import BotonesExportar from '../../componentes/BotonesExportar'
import ModalAviso from '../../componentes/ModalAviso'
import EnlaceCatalogo from '../../componentes/EnlaceCatalogo'
import Paginacion from '../../componentes/Paginacion'
import TarjetaProducto from './TarjetaProducto'
import SeccionBajas from './SeccionBajas'
import ModalBajaProducto from './ModalBajaProducto'
import ModalEliminarProducto from './ModalEliminarProducto'
import ModalVerProducto from './ModalVerProducto'
import ModalReactivarCategoria from './ModalReactivarCategoria'
import ModalFiltros from './ModalFiltros'
import {
  FILTROS_VACIOS,
  contarFiltros,
  parametrosDelListado,
  parametrosParaExportar,
  rangoDePrecios,
} from './filtros'

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
import { BASE_GESTION } from '../../constantes'


const ORDENES = [
  { valor: '', label: 'Sin ordenar' },
  { valor: 'nombre:asc', label: 'Nombre A–Z' },
  { valor: 'nombre:desc', label: 'Nombre Z–A' },
  { valor: 'precio:asc', label: 'Precio: menor primero' },
  { valor: 'precio:desc', label: 'Precio: mayor primero' },
  { valor: 'dificultad:asc', label: 'Dificultad: baja primero' },
  { valor: 'dificultad:desc', label: 'Dificultad: alta primero' },
  { valor: 'categorias:asc', label: 'Categorías: menos primero' },
  { valor: 'categorias:desc', label: 'Categorías: más primero' },
]


function FilaProducto({ producto, acciones }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const catalogo = estadoCatalogo(producto)
  const aviso = avisoMateriales(producto)

  return (
    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
      <td style={{ padding: 16 }}>
        <button
          onClick={() => acciones.onEditar(producto)}
          className="btn-ver-productos"
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

// El título y el texto del modal de aviso, según lo que dejó en el state la
// pantalla de la que se viene, o null si no dejó nada.
function avisoDeLaNavegacion(state) {
  if (state?.creado) {
    return {
      titulo: 'Producto creado',
      texto: `«${state.creado}» quedó creado y ya aparece en el listado.`,
    }
  }

  if (state?.guardado) {
    return { titulo: 'Cambios guardados', texto: `«${state.guardado}» quedó guardado.` }
  }

  return null
}

export default function Productos() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [parametros] = useSearchParams()
  // La página de la grilla que mandó el backend y cuántos productos hay en
  // total con los filtros puestos (el count de la paginación).
  const [productos, setProductos] = useState([])
  const [total, setTotal] = useState(0)
  // Los de la sección de abajo, enteros: los dados de baja y los activos
  // con una categoría de baja (corrección D3: se piden aparte).
  const [bajas, setBajas] = useState([])
  // Los números del encabezado y el rango de precios, de /productos/resumen/.
  const [resumenDatos, setResumenDatos] = useState(null)
  // Solo la primera carga, como en Pedidos.
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Cuántos productos irían al archivo exportado, o null mientras no se sabe.
  const [cantidadParaExportar, setCantidadParaExportar] = useState(null)
  // Lo que se escribe en el buscador, y lo que se manda 300 ms después de
  // la última tecla (debounce).
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')
  const [vista, setVista] = useState('grid')
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)
  const [sortBy, setSortBy] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  // Sube en uno cada vez que hay que volver a pedir las listas.
  const [version, setVersion] = useState(0)
  const [bajasAbierto, setBajasAbierto] = useState(false)
  const [catsColapsadas, setCatsColapsadas] = useState([])
  const [productoDandoBaja, setProductoDandoBaja] = useState(null)
  const [productoEliminando, setProductoEliminando] = useState(null)
  const [productoViendo, setProductoViendo] = useState(null)
  const [categoriaReactivando, setCategoriaReactivando] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAbierto, setFiltrosAbierto] = useState(false)
  const [categorias, setCategorias] = useState([])

  // El modal de aviso de lo que pasó antes de llegar: el alta deja en el
  // state de la navegación el nombre del producto que creó, y la ficha el
  // del que guardó. Se lee al montar.
  const [aviso, setAviso] = useState(() => avisoDeLaNavegacion(ubicacion.state))

  // Para el link "Ver productos" de una categoría: /productos?categoria=3
  const seccionBajas = useRef(null)
  const irABajas = useRef(false)

  // El link "Ver productos" de una categoría llega como /productos?categoria=3.
  //
  // Un solo parámetro para los dos casos: el link significa "los productos
  // de esta categoría", y DÓNDE se ven depende de si está activa o de baja,
  // que se resuelve al llegar. Con un parámetro distinto para cada caso, el
  // link quedaría atado al estado que la categoría tenía cuando se copió.
  //
  // Se llama una sola vez, desde la carga inicial, así que no puede pisar lo
  // que la usuaria toque después.
  function abrirCategoriaDeLaUrl(lista) {
    const pedida = parametros.get('categoria')
    if (!pedida) return

    const categoria = lista.find((c) => String(c.id) === pedida)

    // Un id que no existe se ignora: la pantalla abre normal.
    if (!categoria) return

    if (categoria.estado === 'ACTIVO') {
      setFiltros({ ...FILTROS_VACIOS, categorias: [categoria.id] })
      return
    }

    // Los productos de una categoría de baja no están en la grilla, así que
    // no hay filtro que aplicar ni chip que mostrar: están abajo, agrupados
    // bajo su categoría. Se abre la sección con ese grupo desplegado y se
    // deja pedido el deslizamiento.
    setBajasAbierto(true)
    setCatsColapsadas(
      lista.filter((c) => c.estado === 'BAJA' && c.id !== categoria.id).map((c) => c.id)
    )
    irABajas.current = true
  }


  useEffect(() => {
    // Las categorías se piden acá y no adentro del modal porque hacen falta
    // también afuera: el filtro guarda ids, y los chips de arriba de la
    // grilla tienen que mostrar el nombre de cada una.
    listarCategorias()
      .then((res) => {
        setCategorias(res.data)
        abrirCategoriaDeLaUrl(res.data)
      })
      .catch(() => setError('No se pudieron cargar las categorías.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // El debounce del buscador, como en Pedidos: 300 ms después de la última
  // tecla se manda el texto y se vuelve a la página 1.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaEnviada(busqueda)
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La página de la grilla, cada vez que cambia algo de lo que la define. Si
  // llegan dos respuestas fuera de orden, vigente descarta la vieja.
  useEffect(() => {
    let vigente = true
    const orden = { campo: sortBy, dir: sortDir }
    const parametros = parametrosDelListado({ filtros, busqueda: busquedaEnviada, orden, pagina, porPagina })

    listarProductos(parametros)
      .then((res) => {
        if (!vigente) return
        setProductos(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los productos.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, sortBy, sortDir, pagina, porPagina, version])

  // Cuántos productos irían al archivo exportado (corrección E10). Sin
  // filtro de estado son más que los de la grilla, porque se suman los de
  // la sección de bajas que cumplen los filtros: total no alcanza. Se pide
  // una página de una sola fila, que trae el count. Con 0 se apagan PDF y
  // Excel.
  useEffect(() => {
    let vigente = true
    const parametros = parametrosParaExportar({ filtros, busqueda: busquedaEnviada, orden: { campo: null } })
    parametros.append('pagina', 1)
    parametros.append('por_pagina', 1)

    listarProductos(parametros)
      .then((res) => {
        if (vigente) setCantidadParaExportar(res.data.count)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, version])

  // La sección de abajo, entera y sin los filtros, como antes: con
  // estado=BAJA el backend devuelve los dados de baja y, además, todos los
  // que tienen una categoría de baja. Acá se separan en los dos bloques. Se
  // pide recién al abrir la sección, que arranca cerrada: mientras tanto el
  // botón muestra los dos números del resumen, y la entrada a la pantalla
  // no espera una lista que nadie está mirando.
  useEffect(() => {
    if (!bajasAbierto) return

    listarProductos({ estado: 'BAJA' })
      .then((res) => setBajas(res.data))
      .catch(() => {})
  }, [bajasAbierto, version])

  // El resumen cuenta sobre todos los productos: se pide al entrar y
  // después de cada cambio.
  useEffect(() => {
    resumenDeProductos()
      .then((res) => setResumenDatos(res.data))
      .catch(() => {})
  }, [version])


  // Deslizar hasta la sección es lo único que no se puede hacer en el
  // callback: ahí la sección todavía no está en la pantalla. Este efecto no
  // toca estado, solo el DOM, y se apaga solo con la marca.
  useEffect(() => {
    if (!irABajas.current || !seccionBajas.current) return

    irABajas.current = false
    seccionBajas.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Depende también de categorias: la marca la pone el callback de las
    // categorías, y si los productos llegaron antes, este efecto ya había
    // corrido sin verla.
  }, [bajas, categorias])


  // Ya leído, el state se borra, así el aviso no reaparece al recargar ni al
  // volver con Atrás.
  useEffect(() => {
    if (!ubicacion.state) return
    navegar(`${ubicacion.pathname}${ubicacion.search}`, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // Vuelve a pedir la página, la sección de abajo y el resumen.
  function recargar() {
    setVersion((v) => v + 1)
  }

  // Cambiar los filtros vuelve a la página 1.
  function cambiarFiltros(nuevos) {
    setFiltros(nuevos)
    setPagina(1)
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
    setPagina(1)
  }


  // Derivados: se calculan en cada render a partir del estado y no se
  // guardan. Los campos visible_en_catalogo, oculto_por_categoria y
  // categorias_de_baja vienen ya resueltos del backend.
  //
  // La sección de abajo sale de la lista aparte (bajas): los dados de baja
  // por un lado y, por el otro, los activos con una categoría de baja, que
  // NO van a la grilla: salen solo acá, agrupados bajo su categoría. Así
  // ningún producto aparece en dos lugares a la vez.
  const deBaja = bajas.filter((p) => p.estado === 'BAJA')
  const porCategoria = bajas.filter((p) => p.estado === 'ACTIVO')

  const cantidadFiltros = contarFiltros(filtros)

  // Sin productos de ningún tipo: la grilla vino vacía sin filtros ni
  // búsqueda, y el resumen dice que tampoco hay en la sección de abajo.
  const moduloVacio =
    !cargando &&
    resumenDatos !== null &&
    total === 0 &&
    resumenDatos.de_baja + resumenDatos.por_categoria === 0 &&
    cantidadFiltros === 0 &&
    busquedaEnviada.trim() === ''

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo:
  // saca su valor del criterio al que pertenece y deja el resto igual.
  function quitarDe(campo, valor) {
    cambiarFiltros({ ...filtros, [campo]: filtros[campo].filter((v) => v !== valor) })
  }

  // Lo que se exporta: los mismos filtros, la búsqueda ya enviada y el
  // orden, sin página (corrección E10).
  const parametrosExportar = parametrosParaExportar({
    filtros, busqueda: busquedaEnviada, orden: { campo: sortBy, dir: sortDir },
  })

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
    const rango = rangoDePrecios(resumenDatos)
    chips.push({
      clave: 'precio',
      label: `${formatearPrecio(filtros.desde === null ? rango.min : filtros.desde)} – ${formatearPrecio(
        filtros.hasta === null ? rango.max : filtros.hasta
      )}`,
      onQuitar: () => cambiarFiltros({ ...filtros, desde: null, hasta: null }),
    })
  }

  // El pie de páginas de las dos vistas, que dibujan la misma página. El
  // orden y el corte ya vienen hechos del backend (corrección D3).
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = (pagina - 1) * porPagina

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
    onVer: (p) => setProductoViendo(p),
    onEditar: (p) => navegar(`${BASE_GESTION}/productos/${p.id}`),
    onDarDeBaja: (p) => setProductoDandoBaja(p),
    onEliminar: (p) => setProductoEliminando(p),
  }

  return (
    <div>
      <div
        className="encabezado-pantalla"
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

        <div className="acciones-encabezado" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EnlaceCatalogo />
          <button
            onClick={() => navegar(`${BASE_GESTION}/productos/nuevo`)}
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
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>
        {resumenDatos &&
          `${resumenDatos.activos} productos activos · ${resumenDatos.visibles_en_catalogo} visibles en el catálogo público`}
      </p>


      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}
      {cargando && <p style={{ color: '#857078' }}>Cargando…</p>}


      {moduloVacio && (
        <EstadoVacio onNuevo={() => navegar(`${BASE_GESTION}/productos/nuevo`)} />
      )}

      {!cargando && !moduloVacio && (
        <>
          <div
            className="barra-herramientas"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* 320 y no 420 como en los otros listados: esta barra lleva
                además Ordenar y la vista, y con 420 no entraba en una
                notebook de 1366. */}
            <div className="buscador" style={{ position: 'relative', width: 320 }}>
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
                  height: 40,
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

            <select
              className="orden-listado"
              value={sortBy ? `${sortBy}:${sortDir}` : ''}
              onChange={(e) => {
                const valor = e.target.value
                setPagina(1)
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
                height: 40,
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

            <button
              className="boton-filtros"
              onClick={() => setFiltrosAbierto(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 12px',
                minWidth: 130,
                height: 40,
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

            {/* A la derecha, la vista y exportar. En pantalla chica bajan
                juntos a un renglón propio (acciones-derecha en index.css). */}
            <div className="acciones-derecha" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  height: 40,
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

              <BotonesExportar
                urlPdf={urlExportarProductosPdf(parametrosExportar)}
                pedirExcel={() => exportarProductosAExcel(parametrosExportar)}
                deshabilitado={!cantidadParaExportar}
                motivo="No hay productos para exportar"
              />
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
                onClick={() => cambiarFiltros(FILTROS_VACIOS)}
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
              {productos.map((p) => (
                <TarjetaProducto key={p.id} producto={p} acciones={acciones} />
              ))}

              {productos.length === 0 && <SinResultados />}
            </div>
          )}

          {vista === 'grid' && (
            <div
              style={{
                background: 'white',
                border: '1px solid #EBE0E2',
                borderRadius: 8,
                marginTop: 16,
              }}
            >
              <Paginacion
                total={total}
                desde={desde}
                porPagina={porPagina}
                pagina={pagina}
                totalPaginas={totalPaginas}
                onPorPagina={(n) => {
                  setPorPagina(n)
                  setPagina(1)
                }}
                onPagina={setPagina}
                borde={false}
              />
            </div>
          )}

          {vista === 'lista' && (
            <div style={{ background: 'white', border: '1px solid #EBE0E2', borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#8C5A66' }}>
                    {COLUMNAS.map((col) => (
                      <th key={col.campo} style={{ textAlign: 'left', padding: 0 }}>
                        <button
                          onClick={() => ordenarPor(col.campo)}
                          className="th-orden"
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
                            color: 'white',
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
                        color: 'white',
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
                        color: 'white',
                        letterSpacing: '.06em',
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {productos.map((p) => (
                    <FilaProducto key={p.id} producto={p} acciones={acciones} />
                  ))}

                  {productos.length === 0 && (
                    <tr style={{ borderTop: '1px solid #EBE0E2' }}>
                      <td colSpan="6" style={{ padding: 32, textAlign: 'center', fontSize: 15, color: '#857078' }}>
                        Ningún producto coincide con esos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <Paginacion
                total={total}
                desde={desde}
                porPagina={porPagina}
                pagina={pagina}
                totalPaginas={totalPaginas}
                onPorPagina={(n) => {
                  setPorPagina(n)
                  setPagina(1)
                }}
                onPagina={setPagina}
              />
            </div>
          )}


          {!filtros.estados.includes('BAJA') && (
          <div ref={seccionBajas}>
          <SeccionBajas
            deBaja={deBaja}
            grupos={grupos}
            cantidadDeBaja={resumenDatos ? resumenDatos.de_baja : 0}
            cantidadPorCategoria={resumenDatos ? resumenDatos.por_categoria : 0}
            abierto={bajasAbierto}
            onToggle={() => setBajasAbierto((v) => !v)}
            colapsadas={catsColapsadas}
            onToggleCategoria={(id) =>
              setCatsColapsadas((actual) =>
                actual.includes(id) ? actual.filter((x) => x !== id) : actual.concat(id)
              )
            }
            onVer={acciones.onVer}
            onEditar={acciones.onEditar}
            onReactivarProducto={(p) => cambiarEstado(p, reactivarProducto)}
            onReactivarCategoria={(categoria) => setCategoriaReactivando(categoria)}
          />
          </div>
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

      {productoViendo && (
        <ModalVerProducto
          producto={productoViendo}
          onCerrar={() => setProductoViendo(null)}
          onEditar={() => acciones.onEditar(productoViendo)}
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
          resumen={resumenDatos}
          // Solo las activas: filtrar por una categoría de baja no tendría
          // sentido, porque sus productos no están en la grilla.
          categorias={categorias.filter((c) => c.estado === 'ACTIVO')}
          onCerrar={() => setFiltrosAbierto(false)}
          onAplicar={(borrador) => {
            cambiarFiltros(borrador)
            setFiltrosAbierto(false)
          }}
        />
      )}

      {categoriaReactivando && (
        <ModalReactivarCategoria
          categoria={categoriaReactivando}
          // Cuántos productos vuelven al catálogo con ella: sale del grupo
          // que ya armamos más arriba para el árbol de dados de baja.
          // Solo los que vuelven de verdad: los que tienen OTRA categoría
          // de baja siguen afuera, y los personalizados no van al catálogo.
          cantidadProductos={
            (grupos.find((g) => g.categoria.id === categoriaReactivando.id)?.productos ?? [])
              .filter((p) => p.categorias_de_baja.length === 1 && !p.es_personalizado).length
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

      {aviso && (
        <ModalAviso titulo={aviso.titulo} texto={aviso.texto} onCerrar={() => setAviso(null)} />
      )}
    </div>
  )
}
