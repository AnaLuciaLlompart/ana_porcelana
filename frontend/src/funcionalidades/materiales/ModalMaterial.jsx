import { useState } from 'react'
import { crearMaterial, actualizarMaterial } from './api'
import { TAMANO_MAXIMO_MB, validarTamanoArchivo } from '../../validadores'

const DISPONIBILIDADES = [
  { valor: 'ALTA', etiqueta: 'Alta', color: '#4E8C6A', fondo: '#E8F5EF' },
  { valor: 'MEDIA', etiqueta: 'Media', color: '#D9A441', fondo: '#FDF3E0' },
  { valor: 'BAJA', etiqueta: 'Baja', color: '#C0442F', fondo: '#FAEAE8' },
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

export default function ModalMaterial({ material, onCerrar, onGuardado }) {
  // Si llega un material, el modal está en modo edición.
  const editando = Boolean(material)

  const [nombre, setNombre] = useState(material?.nombre || '')
  const [disponibilidad, setDisponibilidad] = useState(material?.disponibilidad || 'ALTA')
  const [descripcion, setDescripcion] = useState(material?.descripcion || '')
  const [imagen, setImagen] = useState(null)
  const [previa, setPrevia] = useState(material?.url_imagen || null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Recibe el archivo elegido y arma la vista previa en memoria.
  function elegirImagen(e) {
    const archivo = e.target.files[0]
    if (!archivo) return

    const problema = validarTamanoArchivo(archivo)

    if (problema) {
      setError(problema)
      return
    }

    setError('')
    setImagen(archivo)
    setPrevia(URL.createObjectURL(archivo))
  }

  async function guardar() {
    setError('')

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setEnviando(true)

    const datos = {
      nombre: nombre.trim(),
      disponibilidad,
      descripcion: descripcion.trim(),
      estado: editando ? material.estado : 'ACTIVO',
    }

    try {
      if (editando) {
        await actualizarMaterial(material.id, datos, imagen)
      } else {
        await crearMaterial(datos, imagen)
      }
      onGuardado()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar el material.')
    } finally {
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
          maxWidth: 490,
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
            {editando ? 'Editar material' : 'Nuevo material'}
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
              Nombre del material *
            </label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Arcilla polimérica blanca"
              maxLength={80}
              style={estiloCampo}
            />
          </div>

          <div>
            <span style={estiloEtiqueta}>Disponibilidad *</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {DISPONIBILIDADES.map((d) => {
                const activo = disponibilidad === d.valor
                return (
                  <button
                    key={d.valor}
                    onClick={() => setDisponibilidad(d.valor)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 15,
                      border: activo ? `2px solid ${d.color}` : '1px solid #EBE0E2',
                      background: activo ? d.fondo : 'white',
                      color: activo ? d.color : '#857078',
                    }}
                  >
                    {d.etiqueta}
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
              placeholder="Tonalidad, marca, presentación…"
              maxLength={500}
              rows={3}
              style={{ ...estiloCampo, resize: 'vertical' }}
            />
          </div>

          <div>
            <span style={estiloEtiqueta}>Imagen (opcional)</span>

            <label
              htmlFor="imagen"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 112,
                border: '2px dashed #EBE0E2',
                background: '#FAF7F7',
                borderRadius: 6,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {previa ? (
                <img
                  src={previa}
                  alt="Vista previa"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.6">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span style={{ fontSize: 14, color: '#857078' }}>
                    Hacé clic para subir una foto
                  </span>
                  <span style={{ fontSize: 12, color: '#B08791' }}>
                    PNG, JPG hasta {TAMANO_MAXIMO_MB} MB
                  </span>
                </>
              )}
            </label>

            <input
              id="imagen"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={elegirImagen}
              style={{ display: 'none' }}
            />
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