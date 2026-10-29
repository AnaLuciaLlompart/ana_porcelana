import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  cambiarEstadoPedido,
  listarPedidos,
  obtenerPedido,
  resumenDePedidos,
  urlComprobanteDeCobro,
} from './api'
import ModalFiltros from './ModalFiltros'
import ModalEliminarPedido from './ModalEliminarPedido'
import ModalCobros from './ModalCobros'
import ModalVerPedido from './ModalVerPedido'
import {
  FILTROS_VACIOS,
  OPCIONES_ENTREGA,
  contarFiltros,
  leerFiltrosDeLaUrl,
  parametrosDelListado,
} from './filtros'
import {
  COLOR_ESTADO,
  ESTADOS,
  ICONO_BORRAR,
  ICONO_BUSCAR,
  ICONO_COBRO,
  ICONO_COMPROBANTE,
  ICONO_EDITAR,
  ICONO_FILTROS,
  ICONO_NUEVO,
  ICONO_PEDIDOS,
  ICONO_VER,
  OPCIONES_SALDO,
  chipSaldo,
  contenido,
  entregaTexto,
  entregaTitle,
  formatearPrecio,
} from './presentacion'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: el
// endpoint pertenece a esa app y ahí se queda. Acá hacen falta los clientes
// para el desplegable del modal de filtros y para el chip del filtro puesto.
import { listarClientes } from '../clientes/api'

import BotonAccion from '../../componentes/BotonAccion'
import MenuMasAcciones from '../../componentes/MenuMasAcciones'
import Paginacion from '../../componentes/Paginacion'
import Toast from '../../componentes/Toast'
import ModalAviso from '../../componentes/ModalAviso'
import ChipSinContenido from '../../componentes/ChipSinContenido'
import { BASE_GESTION } from '../../constantes'


const estiloTh = {
  padding: '12px 16px',
  textAlign: 'left',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: '#8C5A66',
}

const estiloTd = {
  padding: '14px 16px',
  fontSize: 16,
  color: '#3D3238',
}

// Las columnas del listado, con los anchos del diseño salvo CLIENTE,
// CONTENIDO, SALDO y ACCIONES. SALDO ganó tres puntos de CONTENIDO para que
// entre el chip de saldo más largo, y ACCIONES pasó del 9 al 19 para los
// cuatro botones, a costa de CLIENTE y CONTENIDO, que cortan con puntos
// suspensivos. Suman 100 con el 19 de ACCIONES.
const COLS = [
  { campo: 'id', label: 'PEDIDO', ancho: '8%', justify: 'flex-start' },
  { campo: 'cliente', label: 'CLIENTE', ancho: '9%', justify: 'flex-start' },
  { campo: 'contenido', label: 'CONTENIDO', ancho: '12%', justify: 'flex-start' },
  { campo: 'entrega', label: 'ENTREGA', ancho: '11%', justify: 'center' },
  { campo: 'estado', label: 'ESTADO', ancho: '15%', justify: 'center' },
  { campo: 'total', label: 'TOTAL', ancho: '10%', justify: 'flex-end' },
  { campo: 'saldo', label: 'SALDO', ancho: '16%', justify: 'center' },
]


// Encabezado de tabla clicable, con indicador de orden
function EncabezadoOrdenable({ campo, etiqueta, orden, onClick, justify, ancho }) {
  const activa = orden.campo === campo

  return (
    <th style={{ padding: 0, width: ancho }}>
      <button
        onClick={() => onClick(campo)}
        className="th-orden"
        style={{
          ...estiloTh,
          width: '100%',
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: justify,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>{etiqueta}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ opacity: activa ? 1 : 0.4, flexShrink: 0 }}
        >
          {activa ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={orden.dir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
            />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
          )}
        </svg>
      </button>
    </th>
  )
}


// Los colores del selector de ESTADO de la fila: los mismos de Entregado en
// COLOR_ESTADO, y para los otros tres los neutros del selector de etapa.
function colorSelectorEstado(estado) {
  if (estado === 'ENTREGADO') return COLOR_ESTADO.ENTREGADO
  return { color: '#3D3238', fondo: 'white', borde: '#EBE0E2' }
}


// Los cuatro botones de la fila. Ver abre el pedido en un modal de solo
// lectura; Editar, la ficha, igual que el número de la primera columna;
// Cobros, el modal de los cobros. El estado se cambia en su propia columna,
// con el selector. Lo que no entra va en el ⋯: el comprobante del último
// pago, que se abre en otra pestaña, y eliminar.
function Acciones({ pedido, onVer, onEditar, onEliminar, onCobros }) {
  const masAcciones = [
    {
      texto: 'Último comprobante',
      icono: ICONO_COMPROBANTE,
      onClick: () =>
        window.open(urlComprobanteDeCobro(pedido.id, pedido.ultimo_cobro), '_blank', 'noopener,noreferrer'),
      deshabilitado: pedido.ultimo_cobro === null,
      motivo: 'Este pedido todavía no tiene cobros',
    },
    { texto: 'Eliminar', icono: ICONO_BORRAR, color: '#C0442F', onClick: () => onEliminar(pedido) },
  ]

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(pedido)}
        titulo="Ver"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
      />
      <BotonAccion
        onClick={() => onEditar(pedido)}
        titulo="Editar"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_EDITAR}
      />
      <BotonAccion
        onClick={() => onCobros(pedido)}
        titulo="Cobros"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_COBRO}
      />
      <MenuMasAcciones items={masAcciones} />
    </div>
  )
}


// El otro vacío: hay pedidos, pero ninguno pasa la búsqueda o los filtros.
function SinResultados() {
  return (
    <div style={{ padding: 48, textAlign: 'center', borderTop: '1px solid #EBE0E2' }}>
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: '#3D3238',
        }}
      >
        Ningún pedido coincide
      </p>
      <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
        Probá con otra búsqueda o soltá los filtros.
      </p>
    </div>
  )
}


// La tabla dibuja la página que mandó el backend: el orden, los filtros y
// el corte de la página ya vienen hechos (corrección D3). Lo que guarda la
// pantalla es qué se pidió: el orden elegido, la página y las filas por
// página.
function Tabla({
  pedidos,
  total,
  cargando,
  orden,
  pagina,
  porPagina,
  onOrdenar,
  onPagina,
  onPorPagina,
  onVer,
  onEditar,
  onEliminar,
  onCobros,
  onCambiarEstado,
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = (pagina - 1) * porPagina

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflowX: 'auto',
      }}
    >
      <table
        style={{
          width: '100%',
          minWidth: 940,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
        }}
      >
        <thead style={{ background: '#F0E2E4' }}>
          <tr>
            {COLS.map((col) => (
              <EncabezadoOrdenable
                key={col.campo}
                campo={col.campo}
                etiqueta={col.label}
                orden={orden}
                onClick={onOrdenar}
                justify={col.justify}
                ancho={col.ancho}
              />
            ))}
            <th style={{ ...estiloTh, textAlign: 'center', width: '19%', padding: '12px 8px' }}>
              ACCIONES
            </th>
          </tr>
        </thead>

        <tbody>
          {cargando && (
            <tr>
              <td colSpan={8} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                Cargando…
              </td>
            </tr>
          )}

          {!cargando &&
            pedidos.map((p) => {
              const items = contenido(p)
              const chip = chipSaldo(p.saldo)

              return (
                <tr key={p.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                  <td style={estiloTd}>
                    <button
                      onClick={() => onEditar(p)}
                      className="btn-usuario"
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 16,
                        color: '#3D3238',
                      }}
                    >
                      #{p.id}
                    </button>
                  </td>

                  <td style={estiloTd}>
                    <p
                      style={{
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}
                    >
                      @{p.cliente_instagram}
                    </p>
                  </td>

                  {/* Sin productos, el chip en lugar del texto: es el mismo
                      aviso que "Sin materiales" en Gastos. Entra en el 12%
                      de CONTENIDO porque mide 12px, como el "+N". */}
                  <td title={items.title} style={estiloTd}>
                    {p.cantidad_productos === 0 ? (
                      <ChipSinContenido texto="Sin productos" title="Agregale productos desde la ficha" />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        <span
                          style={{
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: 15,
                            lineHeight: 1.3,
                          }}
                        >
                          {items.texto}
                        </span>

                        {items.resto && (
                          <span
                            style={{
                              flexShrink: 0,
                              fontFamily: "'Quicksand', sans-serif",
                              fontWeight: 600,
                              fontSize: 12,
                              borderRadius: 20,
                              padding: '2px 8px',
                              background: '#F0E2E4',
                              color: '#8C5A66',
                            }}
                          >
                            {items.resto}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td title={entregaTitle(p)} style={{ ...estiloTd, textAlign: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', fontSize: 15 }}>{entregaTexto(p)}</span>
                  </td>

                  {/* El estado se cambia acá mismo, como la etapa de una
                      pieza en Inicio: elegir otro lo aplica al instante. El
                      selector muestra lo que dice el backend, así que si lo
                      rechaza vuelve solo al estado que tenía. Va neutro,
                      como el de etapa, salvo Entregado, que es el que
                      cierra el pedido y va en verde. */}
                  <td style={{ ...estiloTd, padding: '9px 8px', textAlign: 'center' }}>
                    <select
                      value={p.estado}
                      onChange={(e) => onCambiarEstado(p, e.target.value)}
                      title="Cambiar estado"
                      style={{
                        width: '100%',
                        maxWidth: 160,
                        padding: '8px 6px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        outline: 'none',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        border: `1px solid ${colorSelectorEstado(p.estado).borde}`,
                        background: colorSelectorEstado(p.estado).fondo,
                        color: colorSelectorEstado(p.estado).color,
                      }}
                    >
                      {ESTADOS.map((e) => (
                        <option key={e.valor} value={e.valor}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td
                    style={{
                      ...estiloTd,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {formatearPrecio(p.total)}
                  </td>

                  <td style={{ ...estiloTd, textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 14,
                        borderRadius: 20,
                        padding: '5px 9px',
                        border: `1px solid ${chip.borde}`,
                        background: chip.fondo,
                        color: chip.color,
                      }}
                    >
                      {chip.texto}
                    </span>
                  </td>

                  <td style={{ ...estiloTd, padding: '14px 8px' }}>
                    <Acciones
                      pedido={p}
                      onVer={onVer}
                      onEditar={onEditar}
                      onEliminar={onEliminar}
                      onCobros={onCobros}
                    />
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>

      {!cargando && total === 0 && <SinResultados />}

      <Paginacion
        total={total}
        desde={desde}
        porPagina={porPagina}
        pagina={pagina}
        totalPaginas={totalPaginas}
        onPorPagina={onPorPagina}
        onPagina={onPagina}
      />
    </div>
  )
}


// Lo que se ve cuando todavía no hay ningún pedido registrado. Es distinto
// de "ningún pedido coincide": ahí hay pedidos y no los encontró ni la
// búsqueda ni los filtros.
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
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_PEDIDOS} />
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
        Todavía no registraste ningún pedido
      </p>

      <p style={{ margin: 0, maxWidth: 430, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Registrá un pedido cuando el cliente ya confirmó el encargo y el precio.
        Las consultas que no se concretan no van acá.
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
        Registrar el primero
      </button>
    </div>
  )
}


// El título y el texto del modal de aviso, según lo que dejó en el state la
// pantalla de la que se viene, o null si no dejó nada. Si al guardar el
// backend bajó el pedido a En producción, el modal lo dice: es un cambio que
// nadie pidió, y el aviso flotante se perdería al cambiar de pantalla.
function avisoDeLaNavegacion(state) {
  if (state?.creado) {
    return {
      titulo: 'Pedido creado',
      texto: `El pedido #${state.creado} quedó creado y ya aparece en el listado.`,
    }
  }

  if (state?.guardado) {
    return {
      titulo: 'Cambios guardados',
      texto:
        `El pedido #${state.guardado} quedó guardado.` +
        (state.bajoAProduccion ? ' Volvió a En producción porque quedaron piezas sin terminar.' : ''),
    }
  }

  return null
}


// Pantalla de Pedidos

export default function Pedidos() {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [parametros] = useSearchParams()
  // La página que mandó el backend y cuántos pedidos hay en total con los
  // filtros puestos (el count de la paginación).
  const [pedidos, setPedidos] = useState([])
  const [total, setTotal] = useState(0)
  // Los números del encabezado y el total más alto, de /pedidos/resumen/.
  const [resumenDatos, setResumenDatos] = useState(null)
  const [clientes, setClientes] = useState([])
  // Solo la primera carga: después, mientras llega otra página, la tabla
  // sigue mostrando la anterior en vez de parpadear a "Cargando…".
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Lo que se escribe en el buscador, y lo que se manda al backend 300 ms
  // después de la última tecla (debounce), para no pedir una página por
  // letra.
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')
  // Qué página se pide: el orden de la columna elegida, la página y las
  // filas por página.
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(12)
  // Sube en uno cada vez que hay que volver a pedir la misma página
  // (después de cambiar un estado, cerrar Cobros o eliminar).
  const [version, setVersion] = useState(0)
  // Los filtros arrancan con lo que diga la URL, por los enlaces de las
  // tarjetas de Inicio. El inicializador corre una sola vez, al montar: es
  // la única lectura de la URL, y después manda lo que la usuaria toque.
  const [filtros, setFiltros] = useState(() => leerFiltrosDeLaUrl(parametros))
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [pedidoEliminando, setPedidoEliminando] = useState(null)

  // Los modales que abren el ojo y el ⋯. pedidoCobros es el pedido COMPLETO,
  // con sus cobros, que el listado no trae: se pide al abrir.
  const [pedidoViendo, setPedidoViendo] = useState(null)
  const [pedidoCobros, setPedidoCobros] = useState(null)
  // El motivo por el que el backend rechazó un cambio de estado, o ''.
  const [errorEstado, setErrorEstado] = useState('')

  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  // El modal de aviso de lo que pasó antes de llegar: el alta deja en el
  // state de la navegación el pedido que creó, y la ficha el que guardó. Se
  // lee al montar.
  const [aviso, setAviso] = useState(() => avisoDeLaNavegacion(ubicacion.state))

  // El debounce del buscador: cada tecla reinicia la espera, y recién 300
  // ms después de la última se manda el texto. Vuelve a la página 1, porque
  // con otra búsqueda la página en la que se estaba puede no existir.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaEnviada(busqueda)
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La página del listado: se pide cada vez que cambia algo de lo que la
  // define. Si llegan dos respuestas fuera de orden (se tocó otra página
  // antes de que volviera la anterior), vigente descarta la vieja.
  useEffect(() => {
    let vigente = true
    const parametros = parametrosDelListado({ filtros, busqueda: busquedaEnviada, orden, pagina, porPagina })

    listarPedidos(parametros)
      .then((res) => {
        if (!vigente) return
        setPedidos(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe (se eliminó el último pedido de la
        // última página) responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los pedidos.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [filtros, busquedaEnviada, orden, pagina, porPagina, version])

  // El resumen se cuenta sobre todos los pedidos, así que no depende de los
  // filtros: se pide al entrar y después de cada cambio.
  useEffect(() => {
    resumenDePedidos()
      .then((res) => setResumenDatos(res.data))
      .catch(() => {})
  }, [version])

  // Ya leído, el state se borra, así el aviso no reaparece al recargar ni al
  // volver con Atrás.
  useEffect(() => {
    if (!ubicacion.state) return
    navegar(`${ubicacion.pathname}${ubicacion.search}`, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Los clientes son solo para el filtro por cliente del modal, así que se
  // piden la primera vez que se abre y no al entrar: son la lista entera
  // (varias veces más pesada que una página de pedidos) y, pedidos junto
  // con la página, la demoraban. El chip del cliente filtrado los
  // encuentra, porque solo se puede elegir uno con el modal ya abierto.
  // Si fallan, el desplegable queda vacío y los demás filtros andan.
  function abrirFiltros() {
    setFiltrosAbiertos(true)

    if (clientes.length === 0) {
      listarClientes()
        .then((res) => setClientes(res.data))
        .catch(() => {})
    }
  }

  // Vuelve a pedir la página que se está mirando y el resumen.
  function recargar() {
    setVersion((v) => v + 1)
  }

  // Cambiar los filtros, el orden o las filas por página vuelve a la página
  // 1, por lo mismo que la búsqueda.
  function cambiarFiltros(nuevos) {
    setFiltros(nuevos)
    setPagina(1)
  }

  // Alterna asc/desc, o empieza en asc si es una columna nueva.
  function ordenarPor(campo) {
    setOrden((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
    setPagina(1)
  }

  function nuevoPedido() {
    navegar(`${BASE_GESTION}/pedidos/nuevo`)
  }

  function verPedido(pedido) {
    navegar(`${BASE_GESTION}/pedidos/${pedido.id}`)
  }

  function mostrarToast(texto) {
    setToast(texto)
    // Se cancela el anterior, como en la ficha: si no, el temporizador de un
    // aviso viejo apagaría el nuevo antes de tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 2600)
  }

  // El selector de ESTADO de la fila (CU42). Llama a cambiar_estado, que
  // devuelve el pedido completo, y con eso se reemplaza esa fila al
  // instante. Después se vuelve a pedir la página y el resumen: con un
  // filtro de estado la fila puede tener que irse, y los números de arriba
  // cambian. Si el backend lo rechaza (Listo con piezas sin terminar), el
  // motivo va en un modal, que se ve esté donde esté la fila, y el selector
  // queda como estaba, porque la fila no cambió.
  async function cambiarEstado(pedido, valor) {
    try {
      const res = await cambiarEstadoPedido(pedido.id, valor)
      setPedidos((lista) => lista.map((p) => (p.id === pedido.id ? res.data : p)))
      recargar()
      mostrarToast(`Pedido ${res.data.estado_display.toLowerCase()}`)
    } catch (err) {
      setErrorEstado(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
  }

  // ModalCobros necesita la lista de cobros, que el listado no trae.
  function abrirCobros(pedido) {
    obtenerPedido(pedido.id)
      .then((res) => setPedidoCobros(res.data))
      .catch(() => setError('No se pudieron cargar los cobros del pedido.'))
  }

  // Al cerrar se recarga el listado: el saldo pudo cambiar, y con un filtro
  // de saldo la fila puede irse.
  function cerrarCobros() {
    setPedidoCobros(null)
    recargar()
  }

  const cantFiltros = contarFiltros(filtros)

  // Sin pedidos de ningún tipo: la respuesta vino vacía sin filtros ni
  // búsqueda. Con filtros y vacía es "ningún pedido coincide", otra cosa.
  const moduloVacio = !cargando && total === 0 && cantFiltros === 0 && busquedaEnviada.trim() === ''

  // La línea de abajo del título. Los números vienen del backend, contados
  // sobre TODOS los pedidos y no sobre los filtrados: dice cómo viene el
  // trabajo, no qué se está mirando.
  let resumen = ''
  if (moduloVacio) {
    resumen = 'Acá vas a ver los encargos confirmados.'
  } else if (resumenDatos) {
    const { activos, atrasados, con_saldo: conSaldo } = resumenDatos
    resumen =
      `${activos} ${activos === 1 ? 'pedido activo' : 'pedidos activos'}` +
      (atrasados ? ` · ${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'}` : '') +
      (conSaldo ? ` · ${conSaldo} con saldo pendiente` : '')
  }

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  const clienteFiltrado = clientes.find((c) => c.id === filtros.cliente)

  if (clienteFiltrado) {
    chips.push({
      clave: 'cliente',
      label: `@${clienteFiltrado.instagram}`,
      onQuitar: () => cambiarFiltros({ ...filtros, cliente: null }),
    })
  }

  filtros.estados.forEach((valor) => {
    const estado = ESTADOS.find((e) => e.valor === valor)

    chips.push({
      clave: `estado-${valor}`,
      label: estado.label,
      onQuitar: () =>
        cambiarFiltros({ ...filtros, estados: filtros.estados.filter((v) => v !== valor) }),
    })
  })

  if (filtros.entrega !== null) {
    const opcion = OPCIONES_ENTREGA.find((o) => o.valor === filtros.entrega)

    chips.push({
      clave: 'entrega',
      label: opcion.label,
      onQuitar: () => cambiarFiltros({ ...filtros, entrega: null }),
    })
  }

  filtros.saldo.forEach((valor) => {
    const opcion = OPCIONES_SALDO.find((o) => o.valor === valor)

    chips.push({
      clave: `saldo-${valor}`,
      label: opcion.label,
      onQuitar: () =>
        cambiarFiltros({ ...filtros, saldo: filtros.saldo.filter((v) => v !== valor) }),
    })
  })

  if (filtros.desde !== '' || filtros.hasta !== '') {
    const label =
      filtros.desde !== '' && filtros.hasta !== ''
        ? `${formatearPrecio(filtros.desde)} – ${formatearPrecio(filtros.hasta)}`
        : filtros.desde !== ''
          ? `Desde ${formatearPrecio(filtros.desde)}`
          : `Hasta ${formatearPrecio(filtros.hasta)}`

    chips.push({
      clave: 'total',
      label,
      onQuitar: () => cambiarFiltros({ ...filtros, desde: '', hasta: '' }),
    })
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
          Gestión de Pedidos
        </h1>

        <button
          onClick={nuevoPedido}
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
          Nuevo pedido
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>{resumen}</p>

      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}

      {moduloVacio && <EstadoVacio onNuevo={nuevoPedido} />}

      {!moduloVacio && (
        <>
          <div
            className="barra-herramientas"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
              flexWrap: 'wrap',
            }}
          >
            <div className="buscador" style={{ position: 'relative', width: 420 }}>
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
                placeholder="Buscar por cliente, número o producto..."
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
              className="boton-filtros"
              onClick={abrirFiltros}
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
                border: filtrosAbiertos || cantFiltros ? '1px solid #8C5A66' : '1px solid #EBE0E2',
                background: filtrosAbiertos || cantFiltros ? '#F0E2E4' : 'white',
                color: '#8C5A66',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FILTROS} />
              </svg>
              Filtros
              {cantFiltros > 0 && (
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
                  {cantFiltros}
                </span>
              )}
            </button>
          </div>

          {chips.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 18,
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

          <Tabla
            pedidos={pedidos}
            total={total}
            cargando={cargando}
            orden={orden}
            pagina={pagina}
            porPagina={porPagina}
            onOrdenar={ordenarPor}
            onPagina={setPagina}
            onPorPagina={(n) => {
              setPorPagina(n)
              setPagina(1)
            }}
            onVer={(p) => setPedidoViendo(p)}
            onEditar={verPedido}
            onEliminar={(p) => setPedidoEliminando(p)}
            onCobros={abrirCobros}
            onCambiarEstado={cambiarEstado}
          />
        </>
      )}

      {filtrosAbiertos && (
        <ModalFiltros
          filtros={filtros}
          totalMaximo={resumenDatos ? resumenDatos.total_maximo : '0'}
          clientes={clientes}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            cambiarFiltros(nuevos)
            setFiltrosAbiertos(false)
          }}
        />
      )}

      {pedidoEliminando && (
        <ModalEliminarPedido
          pedido={pedidoEliminando}
          onCerrar={() => setPedidoEliminando(null)}
          onEliminado={() => {
            setPedidoEliminando(null)
            recargar()
          }}
        />
      )}

      {pedidoViendo && (
        <ModalVerPedido
          pedido={pedidoViendo}
          onCerrar={() => setPedidoViendo(null)}
          onEditar={() => verPedido(pedidoViendo)}
        />
      )}

      {pedidoCobros && (
        <ModalCobros
          pedido={pedidoCobros}
          onCerrar={cerrarCobros}
          onPedidoActualizado={(actualizado, aviso) => {
            setPedidoCobros(actualizado)
            if (aviso) mostrarToast(aviso)
          }}
        />
      )}

      {aviso && (
        <ModalAviso
          titulo={aviso.titulo}
          texto={aviso.texto}
          onCerrar={() => setAviso(null)}
        />
      )}

      {errorEstado && (
        <ModalAviso
          error
          titulo="No se pudo cambiar el estado"
          texto={errorEstado}
          onCerrar={() => setErrorEstado('')}
        />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
