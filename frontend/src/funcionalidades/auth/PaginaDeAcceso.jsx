import { useEffect } from 'react'
import { FAVICON_GESTION, cambiarFavicon } from '../../favicon'

// Import que cruza de funcionalidad, con el criterio de siempre: el corazón
// nació en la portada del catálogo y se usa desde ahí.
import { ICONO_CORAZON } from '../catalogo/presentacion'

// La hoja que comparten las pantallas de acceso, fuera del Layout: el
// login, pedir el enlace para restablecer la contraseña y elegir la nueva.
// El fondo, el ícono, "Ana Porcelana", el subtítulo (opcional), lo que le
// pasen (la tarjeta) y el pie. Pone el favicon de la gestión, porque sin Layout nadie
// más lo pone: entrando directo quedaría el celeste del index.html.
export default function PaginaDeAcceso({ subtitulo, children }) {
  useEffect(() => {
    cambiarFavicon(FAVICON_GESTION)
  }, [])

  return (
    // 100dvh y no 100vh, por lo mismo que el Layout: vh no descuenta la
    // barra del navegador del celular, y la hoja quedaba más alta que la
    // pantalla, con scroll y el login centrado en una caja que no se veía
    // entera. El relleno vertical es chico para que entre en un celular
    // bajo sin deslizar (en la compu no se nota: el contenido se centra).
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FAF7F7',
      padding: '20px 24px',
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
            {/* La misma flor del ícono de la pestaña (pedido de la usuaria):
                se muestra el archivo del favicon, así hay un solo dibujo. */}
            <img src={FAVICON_GESTION} alt="" width={34} height={34} />
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
          {/* El login no lleva subtítulo (pedido de la usuaria); las otras
              dos pantallas sí. Sin el párrafo no queda el hueco del gap. */}
          {subtitulo && (
            <p style={{ margin: 0, textAlign: 'center', fontSize: 15, color: '#857078', textWrap: 'pretty' }}>
              {subtitulo}
            </p>
          )}
        </div>

        {children}

        {/* El corazón es el mismo SVG de la portada del catálogo y no el
            carácter ♥: cada sistema decide si lo dibuja como texto o como
            emoji rojo (iPhone y Android, emoji), y dibujado acá sale igual
            en todos, con el color del texto (pedido de la usuaria). */}
        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#B08791' }}>
          Accesorios hechos a mano{' '}
          <span style={{ whiteSpace: 'nowrap' }}>
            con{' '}
            <svg
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="currentColor"
              role="img"
              aria-label="corazón"
              style={{ verticalAlign: '-0.15em' }}
            >
              <path d={ICONO_CORAZON} />
            </svg>
          </span>
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
