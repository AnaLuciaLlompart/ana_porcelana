import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarPedidos } from './api'
import ModalFiltros from './ModalFiltros'
import ModalEliminarPedido from './ModalEliminarPedido'
import { FILTROS_VACIOS, candidatos, contarFiltros } from './filtros'
import {
  ESTADOS,
  ICONO_BORRAR,
  ICONO_BUSCAR,
  ICONO_FILTROS,
  ICONO_NUEVO,
  ICONO_PEDIDOS,
  ICONO_VER,
  OPCIONES_SALDO,
  atraso,
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
import Paginacion, { paginar } from '../../componentes/Paginacion'


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

// Las columnas del listado, con los anchos del diseño. Con la de SALDO
// suman exactamente 100 junto al 9% de ACCIONES.
const COLS = [
  { campo: 'id', label: 'PEDIDO', ancho: '10%', justify: 'flex-start' },
  { campo: 'cliente', label: 'CLIENTE', ancho: '16%', justify: 'flex-start' },
  { campo: 'contenido', label: 'CONTENIDO', ancho: '17%', justify: 'flex-start' },
  { campo: 'entrega', label: 'ENTREGA', ancho: '12%', justify: 'center' },
  { campo: 'estado', label: 'ESTADO', ancho: '13%', justify: 'center' },
  { campo: 'total', label: 'TOTAL', ancho: '10%', justify: 'flex-end' },
  { campo: 'saldo', label: 'SALDO', ancho: '13%', justify: 'center' },
]

// Orden del flujo de trabajo, no alfabético: por código se ordenarían
// ENTREGADO, EN_PRODUCCION, LISTO, PENDIENTE, que no significa nada.
const ORDEN_ESTADO = {
  PENDIENTE: 0,
  EN_PRODUCCION: 1,
  LISTO: 2,
  ENTREGADO: 3,
}

// Con qué se ordena la columna ENTREGA. El '9' de adelante manda todos los
// entregados al final, y el '9999-99-99' hace lo mismo con los que no
// tienen fecha: son los dos grupos que ya no hay que vigilar.
function claveEntrega(pedido) {
  const grupo = pedido.estado === 'ENTREGADO' ? '9' : '0'

  return grupo + (pedido.fecha_entrega_estimada || '9999-99-99')
}


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


// Los dos botones de la fila. Ver abre la ficha del pedido, igual que el
// número de la primera columna.
function Acciones({ pedido, onVer, onEliminar }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(pedido)}
        titulo="Ver pedido"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
      />
      <BotonAccion
        onClick={() => onEliminar(pedido)}
        titulo="Eliminar"
        color="#C0442F"
        hover="#FAEAE8"
        icono={ICONO_BORRAR}
      />
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


function Tabla({ pedidos, cargando, onVer, onEliminar }) {
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' })
  const [porPagina, setPorPagina] = useState(12)
  const [pagina, setPagina] = useState(1)

  // Alterna asc/desc, o empieza en asc si es una columna nueva.
  function ordenarPor(campo) {
    setOrden((o) =>
      o.campo === campo
        ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' }
    )
    setPagina(1)
  }

  // Se copia con [...] para no modificar el arreglo original. Sin columna
  // elegida no se ordena nada: las filas quedan como las mandó el backend,
  // que es por fecha de pedido descendente, los más nuevos arriba.
  const ordenados = [...pedidos].sort((a, b) => {
    if (!orden.campo) return 0

    let cmp = 0
    if (orden.campo === 'id') {
      cmp = a.id - b.id
    } else if (orden.campo === 'cliente') {
      cmp = a.cliente_instagram.localeCompare(b.cliente_instagram, 'es')
    } else if (orden.campo === 'contenido') {
      cmp = a.cantidad_productos - b.cantidad_productos
    } else if (orden.campo === 'entrega') {
      cmp = claveEntrega(a).localeCompare(claveEntrega(b))
    } else if (orden.campo === 'estado') {
      cmp = ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]
    } else if (orden.campo === 'total') {
      // El total viene como texto, así que se convierte: comparándolo como
      // texto, "9000" quedaría después de "15500".
      cmp = Number(a.total) - Number(b.total)
    } else if (orden.campo === 'saldo') {
      cmp = Number(a.saldo) - Number(b.saldo)
    }

    return orden.dir === 'asc' ? cmp : -cmp
  })

  const { visibles, paginaActual, totalPaginas, desde } = paginar(ordenados, porPagina, pagina)

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
                onClick={ordenarPor}
                justify={col.justify}
                ancho={col.ancho}
              />
            ))}
            <th style={{ ...estiloTh, textAlign: 'center', width: '9%', padding: '12px 8px' }}>
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
            visibles.map((p) => {
              const items = contenido(p)
              const chip = chipSaldo(p.saldo)

              return (
                <tr key={p.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                  <td style={estiloTd}>
                    <button
                      onClick={() => onVer(p)}
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

                  <td title={items.title} style={estiloTd}>
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
                  </td>

                  <td title={entregaTitle(p)} style={{ ...estiloTd, textAlign: 'center' }}>
                    <span style={{ whiteSpace: 'nowrap', fontSize: 15 }}>{entregaTexto(p)}</span>
                  </td>

                  {/* Solo Entregado lleva chip, como en el diseño: es el
                      estado que cierra el pedido. Los otros tres son etapas
                      del camino y van como texto. */}
                  <td style={{ ...estiloTd, textAlign: 'center' }}>
                    {p.estado === 'ENTREGADO' ? (
                      <span
                        style={{
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                          borderRadius: 20,
                          padding: '5px 11px',
                          border: '1px solid #4E8C6A',
                          background: '#E8F5EF',
                          color: '#4E8C6A',
                        }}
                      >
                        {p.estado_display}
                      </span>
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', fontSize: 15 }}>{p.estado_display}</span>
                    )}
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
                    <Acciones pedido={p} onVer={onVer} onEliminar={onEliminar} />
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>

      {!cargando && ordenados.length === 0 && <SinResultados />}

      <Paginacion
        total={ordenados.length}
        desde={desde}
        porPagina={porPagina}
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        onPorPagina={(n) => {
          setPorPagina(n)
          setPagina(1)
        }}
        onPagina={setPagina}
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


// Pantalla de Pedidos

export default function Pedidos() {
  const navegar = useNavigate()
  const [pedidos, setPedidos] = useState([])
  const [clientes, setClientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [pedidoEliminando, setPedidoEliminando] = useState(null)

  // Una sola carga al montar. El buscador filtra sobre estos datos, así que
  // no vuelve a pedir nada y tampoco lleva debounce.
  useEffect(() => {
    listarPedidos()
      .then((res) => setPedidos(res.data))
      .catch(() => setError('No se pudieron cargar los pedidos.'))
      .finally(() => setCargando(false))

    // Los clientes son para el filtro por cliente. Si fallan, la pantalla
    // igual sirve: el desplegable queda vacío y los demás filtros andan.
    listarClientes()
      .then((res) => setClientes(res.data))
      .catch(() => {})
  }, [])

  function recargar() {
    setCargando(true)
    listarPedidos()
      .then((res) => setPedidos(res.data))
      .catch(() => setError('No se pudieron cargar los pedidos.'))
      .finally(() => setCargando(false))
  }

  function nuevoPedido() {
    navegar('/pedidos/nuevo')
  }

  function verPedido(pedido) {
    navegar(`/pedidos/${pedido.id}`)
  }

  // Derivados: no se guardan en estado porque se calculan de pedidos.
  const filtrados = candidatos(pedidos, filtros, busqueda)

  const activos = pedidos.filter((p) => p.estado !== 'ENTREGADO').length
  const atrasados = pedidos.filter((p) => atraso(p) > 0).length
  const conSaldo = pedidos.filter((p) => Number(p.saldo) > 0).length

  // La línea de abajo del título. Cuenta sobre TODOS los pedidos y no sobre
  // los filtrados: dice cómo viene el trabajo, no qué se está mirando.
  const resumen =
    pedidos.length === 0
      ? 'Acá vas a ver los encargos confirmados.'
      : `${activos} ${activos === 1 ? 'pedido activo' : 'pedidos activos'}` +
        (atrasados ? ` · ${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'}` : '') +
        (conSaldo ? ` · ${conSaldo} con saldo pendiente` : '')

  const cantFiltros = contarFiltros(filtros)

  // Los chips de filtros activos. Cada uno sabe cómo quitarse a sí mismo.
  const chips = []

  const clienteFiltrado = clientes.find((c) => c.id === filtros.cliente)

  if (clienteFiltrado) {
    chips.push({
      clave: 'cliente',
      label: `@${clienteFiltrado.instagram}`,
      onQuitar: () => setFiltros({ ...filtros, cliente: null }),
    })
  }

  filtros.estados.forEach((valor) => {
    const estado = ESTADOS.find((e) => e.valor === valor)

    chips.push({
      clave: `estado-${valor}`,
      label: estado.label,
      onQuitar: () =>
        setFiltros({ ...filtros, estados: filtros.estados.filter((v) => v !== valor) }),
    })
  })

  filtros.saldo.forEach((valor) => {
    const opcion = OPCIONES_SALDO.find((o) => o.valor === valor)

    chips.push({
      clave: `saldo-${valor}`,
      label: opcion.label,
      onQuitar: () =>
        setFiltros({ ...filtros, saldo: filtros.saldo.filter((v) => v !== valor) }),
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
      onQuitar: () => setFiltros({ ...filtros, desde: '', hasta: '' }),
    })
  }

  const moduloVacio = !cargando && pedidos.length === 0

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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
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
              onClick={() => setFiltrosAbiertos(true)}
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

          <Tabla
            pedidos={filtrados}
            cargando={cargando}
            onVer={verPedido}
            onEliminar={(p) => setPedidoEliminando(p)}
          />
        </>
      )}

      {filtrosAbiertos && (
        <ModalFiltros
          filtros={filtros}
          pedidos={pedidos}
          clientes={clientes}
          busqueda={busqueda}
          onCerrar={() => setFiltrosAbiertos(false)}
          onAplicar={(nuevos) => {
            setFiltros(nuevos)
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
    </div>
  )
}
