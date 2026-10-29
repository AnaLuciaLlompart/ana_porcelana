import { useEffect, useRef, useState } from 'react'
import { listarClientes, resumenDeClientes } from './api'
import ModalCliente from './ModalCliente'
import ModalVerCliente from './ModalVerCliente'
import ModalEliminarCliente from './ModalEliminarCliente'
import BotonAccion from '../../componentes/BotonAccion'
import ChipFiltro from '../../componentes/ChipFiltro'
import ModalAviso from '../../componentes/ModalAviso'
import Paginacion from '../../componentes/Paginacion'
import Toast from '../../componentes/Toast'

// Import que cruza de funcionalidad, con el mismo criterio de siempre: la
// pieza se queda donde nació y las demás la usan desde ahí. La columna
// ÚLTIMO muestra la fecha con el mismo formato que la ficha del pedido.
import { chipSaldo, fmtFechaLarga } from '../pedidos/presentacion'


// Iconos de las acciones por fila
const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const ICONO_EDITAR = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
const ICONO_COPIAR = 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
const ICONO_ELIMINAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

// Icono de personas del estado vacío
const ICONO_PERSONAS = 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'

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
  padding: 14,
  fontSize: 16,
  color: '#3D3238',
}


// Encabezado de tabla clicable, con indicador de orden
function EncabezadoOrdenable({ campo, etiqueta, orden, onClick, centrado, ancho }) {
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
          justifyContent: centrado ? 'center' : 'flex-start',
        }}
      >
        {etiqueta}
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


// Los cuatro botones de la fila. Acá no hay ramas como en Materiales:
// el cliente no tiene estado, así que siempre se muestran los cuatro.
function Acciones({ cliente, onVer, onEditar, onCopiar, onEliminar }) {
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(cliente)}
        titulo="Ver cliente"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
      />
      <BotonAccion
        onClick={() => onEditar(cliente)}
        titulo="Editar cliente"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_EDITAR}
      />
      <BotonAccion
        onClick={() => onCopiar(cliente)}
        titulo={`Copiar @${cliente.instagram}`}
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_COPIAR}
      />
      <BotonAccion
        onClick={() => onEliminar(cliente)}
        titulo="Eliminar cliente"
        color="#C0442F"
        hover="#FAEAE8"
        icono={ICONO_ELIMINAR}
      />
    </div>
  )
}


// La tabla dibuja la página que mandó el backend: el orden, los filtros y
// el corte de la página ya vienen hechos (corrección D3), como en Pedidos.
function Tabla({
  clientes,
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
  onCopiar,
  onEliminar,
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
      <table style={{ width: '100%', minWidth: 880, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#F0E2E4' }}>
          <tr>
            <EncabezadoOrdenable
              campo="instagram"
              etiqueta="@USUARIO"
              orden={orden}
              onClick={onOrdenar}
              ancho="17%"
            />
            <EncabezadoOrdenable
              campo="nombre"
              etiqueta="CLIENTE"
              orden={orden}
              onClick={onOrdenar}
              centrado
              ancho="21%"
            />
            <EncabezadoOrdenable
              campo="pedidos"
              etiqueta="PEDIDOS"
              orden={orden}
              onClick={onOrdenar}
              centrado
              ancho="11%"
            />
            <EncabezadoOrdenable
              campo="ultimo"
              etiqueta="ÚLTIMO"
              orden={orden}
              onClick={onOrdenar}
              centrado
              ancho="14%"
            />
            <EncabezadoOrdenable
              campo="saldo"
              etiqueta="SALDO"
              orden={orden}
              onClick={onOrdenar}
              centrado
              ancho="15%"
            />
            <th style={{ ...estiloTh, textAlign: 'center', width: '22%' }}>ACCIONES</th>
          </tr>
        </thead>

        <tbody>
          {cargando && (
            <tr>
              <td colSpan={6} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                Cargando…
              </td>
            </tr>
          )}

          {!cargando &&
            clientes.map((c) => {
              const chip = chipSaldo(c.saldo)

              return (
              <tr key={c.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                <td style={estiloTd}>
                  <button
                    onClick={() => onVer(c)}
                    className="btn-usuario"
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 16,
                      color: '#3D3238',
                    }}
                  >
                    @{c.instagram}
                  </button>
                </td>

                <td style={{ ...estiloTd, textAlign: 'center' }}>
                  <p style={{ margin: 0, lineHeight: 1.3 }}>
                    {`${c.nombre} ${c.apellido}`.trim()}
                  </p>
                  {c.email && (
                    <p style={{ margin: '2px 0 0', lineHeight: 1.3, fontSize: 13, color: '#B08791' }}>
                      {c.email}
                    </p>
                  )}
                </td>

                <td style={{ ...estiloTd, textAlign: 'center' }}>
                  <span
                    title={
                      c.cantidad_pedidos === 1
                        ? '1 pedido registrado'
                        : `${c.cantidad_pedidos} pedidos registrados`
                    }
                    style={{
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 17,
                    }}
                  >
                    {c.cantidad_pedidos}
                  </span>

                  {c.pedidos_en_curso > 0 && (
                    <p
                      style={{
                        margin: '2px 0 0',
                        whiteSpace: 'nowrap',
                        fontSize: 14,
                        color: '#8C5A66',
                      }}
                    >
                      {c.pedidos_en_curso === 1
                        ? '1 en curso'
                        : `${c.pedidos_en_curso} en curso`}
                    </p>
                  )}
                </td>

                <td
                  style={{
                    ...estiloTd,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    fontSize: 15,
                    color: '#857078',
                  }}
                >
                  {c.ultimo_pedido ? fmtFechaLarga(c.ultimo_pedido) : 'Sin pedidos'}
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

                <td style={estiloTd}>
                  <Acciones
                    cliente={c}
                    onVer={onVer}
                    onEditar={onEditar}
                    onCopiar={onCopiar}
                    onEliminar={onEliminar}
                  />
                </td>
              </tr>
              )
            })}
        </tbody>
      </table>

      {!cargando && total === 0 && (
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
            Ningún cliente coincide
          </p>
          <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
            Probá con otra búsqueda.
          </p>
        </div>
      )}

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


// Lo que se ve cuando todavía no hay ningún cliente cargado. Es distinto de
// "ningún cliente coincide": ahí hay datos y no los encontró la búsqueda.
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
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_PERSONAS} />
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
        Todavía no cargaste ningún cliente
      </p>

      <p style={{ margin: 0, maxWidth: 430, fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
        Con el usuario de Instagram y el nombre alcanza para empezar. Los pedidos
        que registres después se van a agrupar acá.
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
          <path strokeLinecap="round" d="M12 4v16m8-8H4" />
        </svg>
        Cargar el primero
      </button>
    </div>
  )
}


// Pantalla de Clientes

export default function Clientes() {
  // La página que mandó el backend y cuántos clientes hay con los filtros
  // puestos (el count de la paginación).
  const [clientes, setClientes] = useState([])
  const [total, setTotal] = useState(0)
  // El total de clientes y los números de los chips, de /clientes/resumen/.
  const [resumenDatos, setResumenDatos] = useState(null)
  // Solo la primera carga, como en Pedidos.
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Lo que se escribe en el buscador, y lo que se manda 300 ms después de
  // la última tecla (debounce).
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')
  const [soloEnCurso, setSoloEnCurso] = useState(false)
  const [soloConSaldo, setSoloConSaldo] = useState(false)
  // Arranca por ÚLTIMO descendente, que es el orden del diseño: lo primero
  // que se quiere ver es quién encargó hace poco.
  const [orden, setOrden] = useState({ campo: 'ultimo', dir: 'desc' })
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(12)
  // Sube en uno cada vez que hay que volver a pedir la misma página.
  const [version, setVersion] = useState(0)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [clienteViendo, setClienteViendo] = useState(null)
  const [clienteEliminando, setClienteEliminando] = useState(null)
  // El modal "Cliente creado" o "Cambios guardados", como en productos,
  // pedidos y gastos.
  const [aviso, setAviso] = useState(null)
  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  // El debounce del buscador, como en Pedidos: 300 ms después de la última
  // tecla se manda el texto y se vuelve a la página 1.
  useEffect(() => {
    const espera = setTimeout(() => {
      setBusquedaEnviada(busqueda)
      setPagina(1)
    }, 300)
    return () => clearTimeout(espera)
  }, [busqueda])

  // La página del listado, cada vez que cambia algo de lo que la define. Si
  // llegan dos respuestas fuera de orden, vigente descarta la vieja.
  useEffect(() => {
    let vigente = true

    const parametros = { pagina, por_pagina: porPagina }
    const texto = busquedaEnviada.trim()
    if (texto) parametros.busqueda = texto
    if (soloEnCurso) parametros.en_curso = 'si'
    if (soloConSaldo) parametros.con_saldo = 'si'
    parametros.orden = orden.dir === 'desc' ? `-${orden.campo}` : orden.campo

    listarClientes(parametros)
      .then((res) => {
        if (!vigente) return
        setClientes(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe (se eliminó el último cliente de la
        // última página) responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los clientes.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [busquedaEnviada, soloEnCurso, soloConSaldo, orden, pagina, porPagina, version])

  // El resumen cuenta sobre todos los clientes, así que no depende de los
  // filtros: se pide al entrar y después de cada cambio.
  useEffect(() => {
    resumenDeClientes()
      .then((res) => setResumenDatos(res.data))
      .catch(() => {})
  }, [version])

  // Vuelve a pedir la página que se está mirando y el resumen.
  function recargar() {
    setVersion((v) => v + 1)
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

  function mostrarToast(texto) {
    setToast(texto)
    // Se cancela el anterior: si no, al copiar dos usuarios seguidos el
    // temporizador del primero apaga el cartel del segundo antes de tiempo.
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 2600)
  }

  // Copiar es la única acción sin efecto visible en la pantalla, y por eso
  // es la única que avisa con el cartel.
  async function copiarUsuario(c) {
    try {
      await navigator.clipboard.writeText(`@${c.instagram}`)
      mostrarToast(`@${c.instagram} copiado`)
    } catch {
      setError('No se pudo copiar el usuario.')
    }
  }

  // Los números vienen del backend (/clientes/resumen/), contados sobre
  // TODOS los clientes y no sobre los filtrados: dicen cómo viene el
  // trabajo, no qué se está mirando. Son también los de los globitos de los
  // chips.
  const cantidadClientes = resumenDatos ? resumenDatos.clientes : 0
  const conPedidosEnCurso = resumenDatos ? resumenDatos.con_pedidos_en_curso : 0
  const conSaldo = resumenDatos ? resumenDatos.con_saldo : 0

  const resumen = !resumenDatos
    ? ''
    : `${cantidadClientes} ${cantidadClientes === 1 ? 'cliente' : 'clientes'}` +
      (conPedidosEnCurso > 0 ? ` · ${conPedidosEnCurso} con pedidos en curso` : '') +
      (conSaldo > 0 ? ` · ${conSaldo} con saldo pendiente` : '')

  // Sin clientes de ningún tipo. Se mira el resumen, que cuenta todos, y no
  // la página, que con un filtro puesto puede venir vacía.
  const moduloVacio = !cargando && resumenDatos !== null && cantidadClientes === 0

  // Propiedades comunes de las cuatro acciones de la fila
  const acciones = {
    onVer: (c) => setClienteViendo(c),
    onEditar: (c) => setClienteEditando(c),
    onCopiar: (c) => copiarUsuario(c),
    onEliminar: (c) => setClienteEliminando(c),
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
          Gestión de Clientes
        </h1>

        <button
          onClick={() => setModalAbierto(true)}
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
            <path strokeLinecap="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>{resumen}</p>

      {error && (
        <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>
      )}

      {moduloVacio ? (
        <EstadoVacio onNuevo={() => setModalAbierto(true)} />
      ) : (
        <>
          <div className="barra-herramientas" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
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
                <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por @usuario, nombre o email..."
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

            {/* Dos chips y no un modal de filtros: son los únicos dos
                criterios que tienen sentido en Clientes, que no tiene
                estado ni baja lógica. Se pueden marcar los dos juntos. */}
            <div className="chips-filtro" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <ChipFiltro
                label="Con saldo pendiente"
                cuenta={conSaldo}
                activo={soloConSaldo}
                onClick={() => {
                  setSoloConSaldo((v) => !v)
                  setPagina(1)
                }}
              />
              <ChipFiltro
                label="Con pedidos en curso"
                cuenta={conPedidosEnCurso}
                activo={soloEnCurso}
                onClick={() => {
                  setSoloEnCurso((v) => !v)
                  setPagina(1)
                }}
              />
            </div>
          </div>

          <Tabla
            clientes={clientes}
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
            {...acciones}
          />
        </>
      )}

      {(modalAbierto || clienteEditando) && (
        <ModalCliente
          cliente={clienteEditando}
          onCerrar={() => {
            setModalAbierto(false)
            setClienteEditando(null)
          }}
          onGuardado={(guardado) => {
            setAviso(
              clienteEditando
                ? { titulo: 'Cambios guardados', texto: `@${guardado.instagram} quedó guardado.` }
                : {
                    titulo: 'Cliente creado',
                    texto: `@${guardado.instagram} quedó creado y ya aparece en el listado.`,
                  }
            )
            setModalAbierto(false)
            setClienteEditando(null)
            recargar()
          }}
        />
      )}

      {clienteViendo && (
        <ModalVerCliente
          cliente={clienteViendo}
          onCerrar={() => setClienteViendo(null)}
          onEditar={() => {
            setClienteEditando(clienteViendo)
            setClienteViendo(null)
          }}
        />
      )}

      {clienteEliminando && (
        <ModalEliminarCliente
          cliente={clienteEliminando}
          onCerrar={() => setClienteEliminando(null)}
          // Desde la cara bloqueada se pasa a ver la ficha del cliente,
          // que es lo que ofrece el diseño en vez del botón de borrar.
          onVerCliente={() => {
            setClienteViendo(clienteEliminando)
            setClienteEliminando(null)
          }}
          onEliminado={() => {
            setClienteEliminando(null)
            recargar()
          }}
        />
      )}

      {aviso && (
        <ModalAviso titulo={aviso.titulo} texto={aviso.texto} onCerrar={() => setAviso(null)} />
      )}

      {toast && <Toast texto={toast} />}
    </div>
  )
}
