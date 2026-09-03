import { useEffect, useState } from 'react'
import { listarCategorias, reactivarCategoria,} from './api'
import ModalCategoria from './ModalCategoria'
import ModalBajaCategoria from './ModalBajaCategoria'
import ModalEliminarCategoria from './ModalEliminarCategoria'


const COLOR_ESTADO = {
  ACTIVO: { texto: '#4E8C6A', fondo: '#E8F5EF' },
  BAJA: { texto: '#C0442F', fondo: '#FAEAE8' },
}


const ICONO_EDITAR = 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
const ICONO_BAJA = 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
const ICONO_ALTA = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
const ICONO_ELIMINAR = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
const ICONO_TIPO = 'M4 6h16M4 12h16M4 18h7'
const ICONO_TEMA = 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'



function BotonAccion({ onClick, titulo, color, hover, icono }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className="btn-accion"
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        borderRadius: 5,
        cursor: 'pointer',
        color,
        '--hover': hover,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}



function Seccion({ titulo, categorias, acciones, onAgregar, textoAgregar }) {
  if (categorias.length === 0 && !onAgregar) return null

  return (
    <section style={{ marginBottom: 34 }}>
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: '#857078',
              letterSpacing: '.06em',
            }}
          >
            {titulo}
          </h2>
          <div style={{ flex: 1, height: 1, background: '#EBE0E2' }} />
          <span style={{ fontSize: 14, color: '#B08791' }}>
            {categorias.length === 1 ? '1 categoría' : `${categorias.length} categorías`}
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 340px))',
          gap: 16,
        }}
      >
        {categorias.map((c) => (
          <Tarjeta key={c.id} categoria={c} {...acciones} />
        ))}

        {onAgregar && (
          <button
            onClick={onAgregar}
            className="btn-agregar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 150,
              background: 'transparent',
              border: '1px dashed #DCC9CD',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#B08791',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" d="M12 5v14m7-7H5" />
            </svg>
            <span
              style={{
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {textoAgregar}
            </span>
          </button>
        )}
      </div>
    </section>
  )
}


function SinResultados({ busqueda }) {
  return (
    <div
      style={{
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
        No se encontraron categorías
      </p>
      <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>
        Ninguna categoría activa coincide con «{busqueda}».
      </p>
    </div>
  )
}



function Tarjeta({ categoria, onEditar, onDarDeBaja, onReactivar, onEliminar, onVerProductos }) {
  const activa = categoria.estado === 'ACTIVO'
  const esTema = categoria.tipo === 'TEMATICA'

  return (
    <article
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        padding: '18px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: 10,
            background: esTema ? '#FDF3E0' : '#F0E2E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke={esTema ? '#D9A441' : '#8C5A66'}
            strokeWidth="1.7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={esTema ? ICONO_TEMA : ICONO_TIPO}
            />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 3px',
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 18,
              color: '#3D3238',
            }}
          >
            {categoria.nombre}
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: '#857078' }}>
            {categoria.descripcion || 'Sin descripción.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
        <span
          style={{
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 20,
            padding: '3px 12px',
            border: `1px solid ${COLOR_ESTADO[categoria.estado].texto}`,
            background: COLOR_ESTADO[categoria.estado].fondo,
            color: COLOR_ESTADO[categoria.estado].texto,
          }}
        >
          {categoria.estado_display}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          paddingTop: 10,
          borderTop: '1px solid #EBE0E2',
        }}
      >
        <button
          onClick={() => onVerProductos(categoria)}
          className="btn-ver-productos"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: '#B08791',
          }}
        >
          Ver productos
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {activa && (
            <>
              <BotonAccion
                onClick={() => onEditar(categoria)}
                titulo="Editar"
                color="#8C5A66"
                hover="#F0E2E4"
                icono={ICONO_EDITAR}
              />
              <BotonAccion
                onClick={() => onDarDeBaja(categoria)}
                titulo="Dar de baja"
                color="#D9A441"
                hover="#FDF3E0"
                icono={ICONO_BAJA}
              />
            </>
          )}

          {!activa && (
            <BotonAccion
              onClick={() => onReactivar(categoria)}
              titulo="Reactivar"
              color="#4E8C6A"
              hover="#E8F5EF"
              icono={ICONO_ALTA}
            />
          )}

          <BotonAccion
            onClick={() => onEliminar(categoria)}
            titulo="Eliminar"
            color="#C0442F"
            hover="#FAEAE8"
            icono={ICONO_ELIMINAR}
          />
        </div>
      </div>
    </article>
  )
}


export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [bajasAbierto, setBajasAbierto] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState(null)
  const [categoriaDandoBaja, setCategoriaDandoBaja] = useState(null)
  const [categoriaEliminando, setCategoriaEliminando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState('Todas')
  const [tipoInicial, setTipoInicial] = useState('TIPO')

  useEffect(() => {
    listarCategorias()
      .then((res) => setCategorias(res.data))
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false))
  }, [])


  function recargar() {
    setCargando(true)
    listarCategorias()
      .then((res) => setCategorias(res.data))
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false))
  }

  async function cambiarEstado(categoria, accion) {
    try {
      await accion(categoria.id)
      recargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cambiar el estado.')
    }
  }


  function abrirNueva(tipo) {
    setTipoInicial(tipo)
    setModalAbierto(true)
  }


  //en estas constantes guardo las listas que cumplen con los filtros
  // se llaman derivados, son constantes que se calculan a partir del estado (por eso no se guardan)
  const texto = busqueda.trim().toLowerCase()

  const coincide = (c) => !texto || c.nombre.toLowerCase().includes(texto) || c.descripcion.toLowerCase().includes(texto)

  const filtradas = categorias.filter(coincide)

  const activas = filtradas.filter((c) => c.estado === 'ACTIVO')
  const deBaja = filtradas.filter((c) => c.estado === 'BAJA')

  const porTipo = tab === 'Temática' ? [] : activas.filter((c) => c.tipo === 'TIPO')
  const porTematica = tab === 'Tipo' ? [] : activas.filter((c) => c.tipo === 'TEMATICA')

  const cuentaTipo = categorias.filter((c) => c.estado === 'ACTIVO' && c.tipo === 'TIPO').length
  const cuentaTema = categorias.filter((c) => c.estado === 'ACTIVO' && c.tipo === 'TEMATICA').length

  const TABS = [
    { id: 'Todas', label: `Todas (${cuentaTipo + cuentaTema})` },
    { id: 'Tipo', label: `Por tipo (${cuentaTipo})` },
    { id: 'Temática', label: `Por temática (${cuentaTema})` },
  ]


  const acciones = {
    onEditar: (c) => setCategoriaEditando(c),
    onDarDeBaja: (c) => setCategoriaDandoBaja(c),
    onReactivar: (c) => cambiarEstado(c, reactivarCategoria),
    onEliminar: (c) => setCategoriaEliminando(c),
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
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
          Gestión de Categorías
        </h1>

        <button
          onClick={() => abrirNueva('TIPO')}
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
          Nueva categoría
        </button>
      </div>


      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#857078' }}>
        {activas.length === 1
          ? '1 categoría activa'
          : `${activas.length} categorías activas`}
        {deBaja.length > 0 && ` · ${deBaja.length} dadas de baja`}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
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
            <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar categoría..."
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

        {TABS.map((t) => {
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                cursor: 'pointer',
                fontFamily: "'Quicksand', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                border: activo ? '1px solid #8C5A66' : '1px solid #EBE0E2',
                background: activo ? '#F0E2E4' : 'white',
                color: activo ? '#8C5A66' : '#857078',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>


      {error && <p style={{ color: '#C0442F', marginBottom: 16 }}>{error}</p>}
      {cargando && <p style={{ color: '#857078' }}>Cargando…</p>}


      {!cargando && (
        <>
          {porTipo.length === 0 && porTematica.length === 0 && busqueda ? (
            <SinResultados busqueda={busqueda} />
          ) : (
            <>
              <Seccion
                titulo="POR TIPO DE ACCESORIO"
                categorias={porTipo}
                acciones={acciones}
                onAgregar={busqueda ? null : () => abrirNueva('TIPO')}
                textoAgregar="Nuevo tipo de accesorio"
              />

              <Seccion
                titulo="POR TEMÁTICA"
                categorias={porTematica}
                acciones={acciones}
                onAgregar={busqueda ? null : () => abrirNueva('TEMATICA')}
                textoAgregar="Nueva temática"
              />
            </>
          )}

          {deBaja.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => setBajasAbierto((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  border: '1px solid #EBE0E2',
                  background: 'white',
                  color: '#8C5A66',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: "'Quicksand', sans-serif",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{
                    transform: bajasAbierto ? 'rotate(180deg)' : 'none',
                    transition: 'transform .2s',
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>

                {deBaja.length === 1
                  ? '1 categoría dada de baja'
                  : `${deBaja.length} categorías dadas de baja`}
              </button>

              {bajasAbierto && (
                <div style={{ marginTop: 12 }}>
                  <Seccion titulo="" categorias={deBaja} acciones={acciones} />
                </div>
              )}
            </div>
          )}
        </>
      )}


      {(modalAbierto || categoriaEditando) && (
        <ModalCategoria
          categoria={categoriaEditando}
          tipoInicial={tipoInicial}
          onCerrar={() => {
            setModalAbierto(false)
            setCategoriaEditando(null)
          }}
          onGuardado={() => {
            setModalAbierto(false)
            setCategoriaEditando(null)
            recargar()
          }}
        />
      )}

      {categoriaDandoBaja && (
        <ModalBajaCategoria
          categoria={categoriaDandoBaja}
          onCerrar={() => setCategoriaDandoBaja(null)}
          onConfirmado={() => {
            setCategoriaDandoBaja(null)
            recargar()
          }}
        />
      )}

      {categoriaEliminando && (
        <ModalEliminarCategoria
          categoria={categoriaEliminando}
          onCerrar={() => setCategoriaEliminando(null)}
          onEliminado={() => {
            setCategoriaEliminando(null)
            recargar()
          }}
        />
      )}      


    </div>
  )

}


