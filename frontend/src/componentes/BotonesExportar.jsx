import { useState } from 'react'
import ModalAviso from './ModalAviso'

// La hoja con renglones del comprobante, y una grilla de planilla.
const ICONO_PDF = 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
const ICONO_EXCEL = 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'


// El nombre del archivo, del Content-Disposition que manda el backend
// (attachment; filename="pedidos-2026-10-29.xlsx"), así está escrito en un
// solo lugar. Si no viene, uno genérico.
function nombreDelArchivo(respuesta) {
  const cabecera = respuesta.headers['content-disposition'] || ''
  const encontrado = cabecera.match(/filename="(.+)"/)
  return encontrado ? encontrado[1] : 'listado.xlsx'
}

// Con responseType 'blob' también el error llega como blob: hay que leerlo
// como texto y pasarlo a JSON para sacar el detail del backend.
async function mensajeDelError(err) {
  try {
    const datos = JSON.parse(await err.response.data.text())
    return datos.detail || 'No se pudo exportar el Excel.'
  } catch {
    return 'No se pudo exportar el Excel.'
  }
}


function Boton({ texto, icono, color, onClick, apagado, titulo }) {
  return (
    <button
      onClick={onClick}
      disabled={apagado}
      title={titulo}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        padding: '8px 12px',
        borderRadius: 5,
        cursor: apagado ? 'default' : 'pointer',
        opacity: apagado ? 0.5 : undefined,
        fontFamily: "'Quicksand', sans-serif",
        fontWeight: 600,
        fontSize: 15,
        border: `1px solid ${color}`,
        background: 'white',
        color,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
      {texto}
    </button>
  )
}


// Los botones PDF y Excel de los listados (corrección E10 del tutor). Van a
// la derecha de Filtros, con su mismo estilo, y exportan lo que el listado
// tiene filtrado y buscado.
//
// urlPdf es la dirección del PDF, que se abre en otra pestaña como el
// comprobante. pedirExcel es la función de api.js que lo pide con cliente:
// un 403 lo atrapa el interceptor, y el mensaje de un 400 se muestra acá
// mismo, en el modal rojo, así la pantalla no tiene que saber nada del
// error. deshabilitado apaga los dos, con motivo en el title.
export default function BotonesExportar({ urlPdf, pedirExcel, deshabilitado, motivo }) {
  const [descargando, setDescargando] = useState(false)
  // El motivo por el que no se pudo exportar el Excel, o ''.
  const [error, setError] = useState('')

  function abrirPdf() {
    window.open(urlPdf, '_blank', 'noopener,noreferrer')
  }

  // El archivo llega entero en la respuesta. Para guardarlo se le da una
  // dirección temporal en la memoria del navegador, se hace clic en un
  // enlace con download que apunta ahí, y se libera la dirección.
  async function descargarExcel() {
    setDescargando(true)
    try {
      const respuesta = await pedirExcel()
      const direccion = URL.createObjectURL(respuesta.data)
      const enlace = document.createElement('a')
      enlace.href = direccion
      enlace.download = nombreDelArchivo(respuesta)
      enlace.click()
      URL.revokeObjectURL(direccion)
    } catch (err) {
      // Sin sesión, el interceptor ya está llevando al login.
      if (err.response?.status !== 403) setError(await mensajeDelError(err))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="botones-exportar" style={{ display: 'flex', gap: 12 }}>
      <Boton
        texto="PDF"
        icono={ICONO_PDF}
        color="#C0442F"
        onClick={abrirPdf}
        apagado={deshabilitado}
        titulo={deshabilitado ? motivo : 'Ver el listado en PDF'}
      />
      <Boton
        texto="Excel"
        icono={ICONO_EXCEL}
        color="#4E8C6A"
        onClick={descargarExcel}
        apagado={deshabilitado || descargando}
        titulo={deshabilitado ? motivo : descargando ? 'Descargando…' : 'Descargar el listado en Excel'}
      />

      {error && (
        <ModalAviso
          error
          titulo="No se pudo exportar"
          texto={error}
          onCerrar={() => setError('')}
        />
      )}
    </div>
  )
}
