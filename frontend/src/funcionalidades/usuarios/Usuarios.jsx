import { useEffect, useRef, useState } from 'react'
import { darDeBajaUsuario, listarUsuarios, reactivarUsuario, resumenDeUsuarios } from './api'
import ModalUsuario from './ModalUsuario'
import ModalVerUsuario from './ModalVerUsuario'
import ModalContrasenaDeUsuario from './ModalContrasenaDeUsuario'
import ModalEliminarUsuario from './ModalEliminarUsuario'
import { chipEstado } from './presentacion'
import BotonAccion from '../../componentes/BotonAccion'
import ChipFiltro from '../../componentes/ChipFiltro'
import MenuMasAcciones from '../../componentes/MenuMasAcciones'
import ModalAviso from '../../componentes/ModalAviso'
import ModalConfirmar from '../../componentes/ModalConfirmar'
import Paginacion from '../../componentes/Paginacion'
import Toast from '../../componentes/Toast'
import { ICONO_CANDADO } from '../auth/presentacion'

// Imports que cruzan de funcionalidad, con el criterio de siempre: los
// iconos se usan desde donde están exportados en vez de copiarlos. El de
// Reactivar es el tilde en un círculo de Materiales (ICONO_ALTA).
import { ICONO_ALTA as ICONO_REACTIVAR, ICONO_BAJA, ICONO_EDITAR, ICONO_VER } from '../productos/presentacion'


// La papelera de Eliminar, como en los demás listados.
const ICONO_ELIMINAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'

// Lo que dice el title del lápiz y del candado apagados en un dado de baja:
// el mismo motivo con que el backend rechaza modificarlo.
const MOTIVO_DE_BAJA = 'El usuario está dado de baja. Reactivalo para poder modificarlo.'

const estiloTh = {
  padding: '12px 16px',
  textAlign: 'left',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '.06em',
  color: 'white',
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


// Los cuatro botones de la fila, siempre los mismos y en el mismo lugar
// (decidido por la usuaria): Ver, Editar, Cambiar contraseña y el ⋯ con lo
// que cambia el estado. En un dado de baja el lápiz y el candado van
// apagados, con el motivo en el title, porque el backend los rechaza hasta
// reactivarlo; el ⋯ ofrece Dar de baja o Reactivar según el caso, y
// Eliminar, que es definitivo, en rojo. La superadministradora no lleva
// ninguno: no se gestiona desde acá, y el title de la celda lo dice.
function Acciones({ usuario, onVer, onEditar, onContrasena, onDarDeBaja, onReactivar, onEliminar }) {
  if (usuario.es_superadministradora) return null

  const activo = usuario.is_active

  const masAcciones = [
    activo
      ? { texto: 'Dar de baja', icono: ICONO_BAJA, onClick: () => onDarDeBaja(usuario) }
      : { texto: 'Reactivar', icono: ICONO_REACTIVAR, onClick: () => onReactivar(usuario) },
    { texto: 'Eliminar', icono: ICONO_ELIMINAR, color: '#C0442F', onClick: () => onEliminar(usuario) },
  ]

  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <BotonAccion
        onClick={() => onVer(usuario)}
        titulo="Ver usuario"
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_VER}
      />
      <BotonAccion
        onClick={() => onEditar(usuario)}
        titulo={activo ? 'Editar usuario' : MOTIVO_DE_BAJA}
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_EDITAR}
        deshabilitado={!activo}
      />
      <BotonAccion
        onClick={() => onContrasena(usuario)}
        titulo={activo ? 'Cambiar contraseña' : MOTIVO_DE_BAJA}
        color="#8C5A66"
        hover="#F0E2E4"
        icono={ICONO_CANDADO}
        deshabilitado={!activo}
      />
      <MenuMasAcciones items={masAcciones} />
    </div>
  )
}


// La tabla dibuja la página que mandó el backend: el orden, el filtro y el
// corte de la página ya vienen hechos (corrección D3), como en Clientes.
function Tabla({
  usuarios,
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
  onContrasena,
  onDarDeBaja,
  onReactivar,
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
      <table style={{ width: '100%', minWidth: 940, tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#8C5A66' }}>
          <tr>
            {/* ACCIONES lleva 20% por los cuatro botones de 36 más sus
                separaciones (156px): a 940 la celda deja 160. ESTADO, 20%
                por el chip "Superadministradora". */}
            <EncabezadoOrdenable campo="username" etiqueta="USUARIO" orden={orden} onClick={onOrdenar} ancho="16%" />
            <EncabezadoOrdenable campo="nombre" etiqueta="NOMBRE Y APELLIDO" orden={orden} onClick={onOrdenar} ancho="22%" />
            <EncabezadoOrdenable campo="email" etiqueta="CORREO" orden={orden} onClick={onOrdenar} ancho="22%" />
            <EncabezadoOrdenable campo="estado" etiqueta="ESTADO" orden={orden} onClick={onOrdenar} centrado ancho="20%" />
            <th style={{ ...estiloTh, textAlign: 'center', width: '20%' }}>ACCIONES</th>
          </tr>
        </thead>

        <tbody>
          {cargando && (
            <tr>
              <td colSpan={5} style={{ ...estiloTd, textAlign: 'center', color: '#857078' }}>
                Cargando…
              </td>
            </tr>
          )}

          {!cargando &&
            usuarios.map((u) => {
              const chip = chipEstado(u)

              return (
                <tr key={u.id} style={{ borderTop: '1px solid #EBE0E2' }}>
                  <td
                    style={{
                      ...estiloTd,
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={u.username}
                  >
                    {u.username}
                  </td>

                  <td style={estiloTd}>{`${u.first_name} ${u.last_name}`.trim()}</td>

                  <td
                    style={{
                      ...estiloTd,
                      fontSize: 15,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={u.email}
                  >
                    {u.email}
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

                  <td
                    style={estiloTd}
                    title={u.es_superadministradora ? 'La superadministradora no se gestiona desde acá' : undefined}
                  >
                    <Acciones
                      usuario={u}
                      onVer={onVer}
                      onEditar={onEditar}
                      onContrasena={onContrasena}
                      onDarDeBaja={onDarDeBaja}
                      onReactivar={onReactivar}
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
            Ningún usuario coincide
          </p>
          <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>
            Probá con otra búsqueda o sacá el filtro.
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


// Pantalla de Usuarios (corrección del tutor: dos roles). Solo la ve la
// superadministradora: el menú no le muestra el ítem a un administrador, la
// ruta lo manda a Inicio y el backend le responde 403.

export default function Usuarios() {
  // La página que mandó el backend y cuántos usuarios hay con el filtro
  // puesto (el count de la paginación).
  const [usuarios, setUsuarios] = useState([])
  const [total, setTotal] = useState(0)
  // El total de usuarios y los números de los chips, de /usuarios/resumen/.
  const [resumenDatos, setResumenDatos] = useState(null)
  // Solo la primera carga, como en Clientes.
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Lo que se escribe en el buscador, y lo que se manda 300 ms después de
  // la última tecla (debounce).
  const [busqueda, setBusqueda] = useState('')
  const [busquedaEnviada, setBusquedaEnviada] = useState('')
  // '' (todos), 'ACTIVO' o 'BAJA': los dos chips se excluyen, porque un
  // usuario está en un estado o en el otro.
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [orden, setOrden] = useState({ campo: 'username', dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(12)
  // Sube en uno cada vez que hay que volver a pedir la misma página.
  const [version, setVersion] = useState(0)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioViendo, setUsuarioViendo] = useState(null)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [usuarioContrasena, setUsuarioContrasena] = useState(null)
  const [usuarioDandoDeBaja, setUsuarioDandoDeBaja] = useState(null)
  const [usuarioEliminando, setUsuarioEliminando] = useState(null)
  // El modal "Usuario creado" o "Cambios guardados", como en los demás
  // listados.
  const [aviso, setAviso] = useState(null)
  const [toast, setToast] = useState('')
  const temporizador = useRef(null)

  // El debounce del buscador, como en Clientes: 300 ms después de la última
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
    if (estadoFiltro) parametros.estado = estadoFiltro
    parametros.orden = orden.dir === 'desc' ? `-${orden.campo}` : orden.campo

    listarUsuarios(parametros)
      .then((res) => {
        if (!vigente) return
        setUsuarios(res.data.results)
        setTotal(res.data.count)
        setError('')
      })
      .catch((err) => {
        if (!vigente) return
        // Una página que ya no existe (el filtro dejó menos páginas)
        // responde 404: se vuelve a la anterior.
        if (err.response?.status === 404 && pagina > 1) {
          setPagina(pagina - 1)
          return
        }
        setError('No se pudieron cargar los usuarios.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [busquedaEnviada, estadoFiltro, orden, pagina, porPagina, version])

  // El resumen cuenta sobre todos los usuarios, así que no depende del
  // filtro: se pide al entrar y después de cada cambio.
  useEffect(() => {
    resumenDeUsuarios()
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

  // Un chip a la vez: tocar el que está puesto lo saca.
  function filtrarPor(estado) {
    setEstadoFiltro((actual) => (actual === estado ? '' : estado))
    setPagina(1)
  }

  function mostrarToast(texto) {
    setToast(texto)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setToast(''), 1400)
  }

  // Dar de baja y reactivar: la acción recibe la función de la API, como en
  // Materiales. El rechazo del backend se muestra arriba de la tabla, y se
  // recarga igual: si el backend lo rechazó porque la fila ya cambió (otra
  // pestaña), la tabla tiene que mostrar el estado real.
  async function cambiarEstado(usuario, accion, avisoFlotante) {
    setError('')
    try {
      await accion(usuario.id)
      mostrarToast(avisoFlotante)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
    recargar()
  }

  // Los números vienen del backend (/usuarios/resumen/), contados sobre
  // TODOS los usuarios. Son también los de los globitos de los chips.
  const cantidadUsuarios = resumenDatos ? resumenDatos.usuarios : 0
  const activos = resumenDatos ? resumenDatos.activos : 0
  const dadosDeBaja = resumenDatos ? resumenDatos.dados_de_baja : 0

  const resumen = !resumenDatos
    ? ''
    : `${cantidadUsuarios} ${cantidadUsuarios === 1 ? 'usuario' : 'usuarios'}` +
      ` · ${activos} ${activos === 1 ? 'activo' : 'activos'}` +
      (dadosDeBaja > 0 ? ` · ${dadosDeBaja} ${dadosDeBaja === 1 ? 'dado de baja' : 'dados de baja'}` : '')

  // Propiedades comunes de las acciones de la fila
  const acciones = {
    onVer: (u) => setUsuarioViendo(u),
    onEditar: (u) => setUsuarioEditando(u),
    onContrasena: (u) => setUsuarioContrasena(u),
    onDarDeBaja: (u) => setUsuarioDandoDeBaja(u),
    onReactivar: (u) => cambiarEstado(u, reactivarUsuario, 'Usuario reactivado'),
    onEliminar: (u) => setUsuarioEliminando(u),
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
          Gestión de Usuarios
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
          Nuevo usuario
        </button>
      </div>

      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>{resumen}</p>

      {error && (
        <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>
      )}

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
            placeholder="Buscar por usuario, nombre o correo..."
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

        {/* Dos chips y no un modal de filtros, como en Clientes: el estado es
            el único criterio. Se marca uno a la vez. */}
        <div className="chips-filtro" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <ChipFiltro
            label="Activos"
            cuenta={activos}
            activo={estadoFiltro === 'ACTIVO'}
            onClick={() => filtrarPor('ACTIVO')}
          />
          <ChipFiltro
            label="Dados de baja"
            cuenta={dadosDeBaja}
            activo={estadoFiltro === 'BAJA'}
            onClick={() => filtrarPor('BAJA')}
          />
        </div>
      </div>

      <Tabla
        usuarios={usuarios}
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

      {(modalAbierto || usuarioEditando) && (
        <ModalUsuario
          usuario={usuarioEditando}
          onCerrar={() => {
            setModalAbierto(false)
            setUsuarioEditando(null)
          }}
          onGuardado={(guardado) => {
            setAviso(
              usuarioEditando
                ? { titulo: 'Cambios guardados', texto: `«${guardado.username}» quedó guardado.` }
                : {
                    titulo: 'Usuario creado',
                    texto: `«${guardado.username}» quedó creado y ya puede iniciar sesión.`,
                  }
            )
            setModalAbierto(false)
            setUsuarioEditando(null)
            recargar()
          }}
        />
      )}

      {usuarioViendo && (
        <ModalVerUsuario usuario={usuarioViendo} onCerrar={() => setUsuarioViendo(null)} />
      )}

      {usuarioContrasena && (
        <ModalContrasenaDeUsuario
          usuario={usuarioContrasena}
          onCerrar={() => setUsuarioContrasena(null)}
          onGuardado={() => {
            setUsuarioContrasena(null)
            // Cambiar la contraseña no deja ningún rastro en la tabla, así
            // que sin este aviso no habría forma de saber que funcionó.
            mostrarToast('Contraseña actualizada')
          }}
        />
      )}

      {usuarioDandoDeBaja && (
        <ModalConfirmar
          titulo="Dar de baja"
          texto={`¿Dar de baja a «${usuarioDandoDeBaja.username}»? No va a poder entrar y su sesión se cierra ahora. Lo podés reactivar cuando quieras.`}
          textoAccion="Dar de baja"
          onCerrar={() => setUsuarioDandoDeBaja(null)}
          onConfirmar={() => {
            const usuario = usuarioDandoDeBaja
            setUsuarioDandoDeBaja(null)
            cambiarEstado(usuario, darDeBajaUsuario, 'Usuario dado de baja')
          }}
        />
      )}

      {/* Eliminar se confirma solo: la fila desaparece de la tabla, como en
          Materiales y Clientes. */}
      {usuarioEliminando && (
        <ModalEliminarUsuario
          usuario={usuarioEliminando}
          onCerrar={() => setUsuarioEliminando(null)}
          onEliminado={() => {
            setUsuarioEliminando(null)
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
