import { useEffect } from 'react'
import { FAVICON_GESTION, cambiarFavicon } from '../../favicon'

// La hoja que comparten las pantallas de acceso, fuera del Layout: el
// login, pedir el enlace para restablecer la contraseña y elegir la nueva.
// El fondo, el ícono, "Ana Porcelana", el subtítulo, lo que le pasen (la
// tarjeta) y el pie. Pone el favicon de la gestión, porque sin Layout nadie
// más lo pone: entrando directo quedaría el celeste del index.html.
export default function PaginaDeAcceso({ subtitulo, children }) {
  useEffect(() => {
    cambiarFavicon(FAVICON_GESTION)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAF7F7',
      padding: '40px 24px',
      fontFamily: "'Nunito Sans', sans-serif",
      color: '#3D3238',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          marginBottom: 28,
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: '#F0E2E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#8C5A66" strokeWidth="1.4">
              <circle cx="12" cy="7" r="3" />
              <circle cx="7.2" cy="10.5" r="3" />
              <circle cx="16.8" cy="10.5" r="3" />
              <circle cx="9.2" cy="15.4" r="3" />
              <circle cx="14.8" cy="15.4" r="3" />
              <circle cx="12" cy="11.6" r="1.5" fill="#8C5A66" stroke="none" />
            </svg>
          </div>
          <h1 style={{
            margin: 0,
            textAlign: 'center',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: '#8C5A66',
          }}>
            Ana Porcelana
          </h1>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
            {subtitulo}
          </p>
        </div>

        {children}

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#B08791' }}>
          Accesorios hechos a mano con ♥
        </p>
      </div>
    </div>
  )
}

// El error del servidor, en la caja roja de las tres pantallas.
export function CajaDeError({ children }) {
  return (
    <p role="alert" style={{
      margin: 0,
      padding: '10px 12px',
      background: '#FAEAE8',
      border: '1px solid #F0C4BC',
      borderRadius: 6,
      fontSize: 14,
      color: '#C0442F',
    }}>
      {children}
    </p>
  )
}
