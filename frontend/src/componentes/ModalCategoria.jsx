import { useState } from 'react'
import { crearCategoria, actualizarCategoria } from '../api/categorias'

const TIPOS = [
  { valor: 'TIPO', etiqueta: 'Tipo de accesorio' },
  { valor: 'TEMATICA', etiqueta: 'Temática' },
]

const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 14,
  color: '#857078',
  marginBottom: 7,
}

const estiloCampo = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #EBE0E2',
  background: '#FAF7F7',
  fontSize: 15,
  color: '#3D3238',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
}


export default function ModalCategoria({ categoria, tipoInicial, onCerrar, onGuardado }) {

    const editando = Boolean(categoria)

  const [nombre, setNombre] = useState(categoria?.nombre || '')
  const [tipo, setTipo] = useState(categoria?.tipo || tipoInicial || 'TIPO')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion || '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setEnviando(true)

    const datos = {
      nombre: nombre.trim(),
      tipo,
      descripcion: descripcion.trim(),
      estado: editando ? categoria.estado : 'ACTIVO',
    }

    try {
      if (editando) {
        await actualizarCategoria(categoria.id, datos)
      } else {
        await crearCategoria(datos)
      }
      onGuardado()
    } catch (err) {
      const datosError = err.response?.data
      setError(
        datosError?.detail ||
          datosError?.nombre?.[0] ||
          'No se pudo guardar la categoría.'
      )
      setEnviando(false)
    }
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(61,50,56,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          width: '100%',
          maxWidth: 470,
          maxHeight: '90vh',
          borderRadius: 10,
          overflow: 'auto',
          boxShadow: '0 20px 50px rgba(61,50,56,.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: '#8C5A66',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 19,
              color: 'white',
            }}
          >
            {editando ? 'Editar categoría' : 'Nueva categoría'}
          </h2>

          <button
            onClick={onCerrar}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'transparent',
              borderRadius: 5,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label htmlFor="nombre" style={estiloEtiqueta}>
              Nombre *
            </label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Aros, Harry Potter"
              maxLength={30}
              style={estiloCampo}
            />
            <div style={{ marginTop: 5, fontSize: 12, color: '#B08791', textAlign: 'right' }}>
              {nombre.length} / 30
            </div>
          </div>

          <div>
            <span style={estiloEtiqueta}>Tipo *</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map((t) => {
                const activo = tipo === t.valor
                return (
                  <button
                    key={t.valor}
                    onClick={() => setTipo(t.valor)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      border: activo ? '2px solid #8C5A66' : '1px solid #EBE0E2',
                      background: activo ? '#F0E2E4' : 'white',
                      color: activo ? '#8C5A66' : '#857078',
                    }}
                  >
                    {t.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="descripcion" style={estiloEtiqueta}>
              Descripción
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Características de esta categoría."
              maxLength={100}
              rows={2}
              style={{ ...estiloCampo, resize: 'vertical' }}
            />
            <div style={{ marginTop: 5, fontSize: 12, color: '#B08791', textAlign: 'right' }}>
              {descripcion.length} / 100
            </div>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                background: '#FAEAE8',
                border: '1px solid #F0C4BC',
                borderRadius: 6,
                fontSize: 14,
                color: '#C0442F',
              }}
            >
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 24px',
            borderTop: '1px solid #EBE0E2',
          }}
        >
          <button
            onClick={onCerrar}
            style={{
              padding: '10px 20px',
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
            Cancelar
          </button>

          <button
            onClick={guardar}
            disabled={enviando}
            style={{
              padding: '10px 20px',
              border: 0,
              background: '#8C5A66',
              color: 'white',
              borderRadius: 6,
              cursor: enviando ? 'default' : 'pointer',
              opacity: enviando ? 0.7 : 1,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}