import { Link } from 'react-router-dom'
import { QUICKSAND } from './presentacion'

// La caja blanca con un título, un texto y una salida. La usan los lugares
// del catálogo donde no hay nada que mostrar: el listado sin resultados,
// el producto que no existe, la página que no existe y la selección vacía.
//
// La salida es siempre un enlace (`ruta`), porque siempre lleva a otra
// dirección; con `principal` va con fondo celeste en vez de con borde,
// como "Ver el catálogo" en el diseño. `icono` dibuja arriba del título el
// cuadrado con el icono, que el diseño pone solo en la selección vacía.
// Las tres son opcionales.

const estiloSalida = {
  display: 'inline-block',
  marginTop: 8,
  padding: '10px 18px',
  border: '1px solid #5A7A8C',
  background: 'white',
  color: '#5A7A8C',
  borderRadius: 6,
  textDecoration: 'none',
  fontFamily: QUICKSAND,
  fontWeight: 600,
  fontSize: 15,
}

const estiloSalidaPrincipal = {
  ...estiloSalida,
  padding: '11px 20px',
  border: 0,
  background: '#5A7A8C',
  color: 'white',
  fontSize: 16,
}

export default function CajaMensaje({ titulo, texto, textoSalida, ruta, icono, principal = false }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E0E8EB',
        borderRadius: 8,
        padding: '44px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {icono && (
        <div
          style={{
            width: 56,
            height: 56,
            marginBottom: 4,
            borderRadius: 14,
            background: '#E2EAF0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5A7A8C" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
          </svg>
        </div>
      )}

      <p style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 17, color: '#323A3D' }}>
        {titulo}
      </p>

      {texto && (
        <p style={{ margin: 0, maxWidth: 340, fontSize: 15, color: '#708085', textWrap: 'pretty' }}>
          {texto}
        </p>
      )}

      {ruta && (
        <Link
          to={ruta}
          className={principal ? 'catalogo-relleno' : 'catalogo-suave'}
          style={principal ? estiloSalidaPrincipal : estiloSalida}
        >
          {textoSalida}
        </Link>
      )}
    </div>
  )
}
