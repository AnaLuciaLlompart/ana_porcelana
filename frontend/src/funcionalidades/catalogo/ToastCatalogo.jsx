import { Link } from 'react-router-dom'
import { ICONO_TILDE, QUICKSAND } from './presentacion'

// El aviso flotante del catálogo. No es el Toast de la gestión por dos
// motivos: tiene los colores del diseño del catálogo (oscuro, con el texto
// blanco y la tilde verde clara), y su acción "Ver" lleva a otra pantalla,
// así que es un enlace; en Toast la acción es un botón.
//
// `rutaAccion` es opcional: sin ella el aviso es solo el texto. `onAccion`
// se llama al tocar el enlace, para que quien lo muestra lo pueda cerrar.
//
// El zIndex 70 es el del diseño: arriba del encabezado (50) y de los
// paneles (61). Los de la gestión (90 a 120) son de otras pantallas.

export default function ToastCatalogo({ texto, rutaAccion, onAccion }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 22,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        // Un elemento fijo con left: 50% solo puede usar la mitad derecha
        // de la pantalla para medirse, y recién después el translateX lo
        // centra: sin width el texto se partía en seis renglones. Con
        // max-content mide lo que mide el texto, hasta 16px de cada
        // borde, igual que .toast en index.css para la gestión.
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
        padding: '11px 18px',
        borderRadius: 24,
        background: '#323A3D',
        boxShadow: '0 10px 30px rgba(50,58,61,.3)',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8FD3AE" strokeWidth="2.2" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
      </svg>

      <span style={{ fontFamily: QUICKSAND, fontWeight: 600, fontSize: 15, color: 'white', textWrap: 'pretty' }}>
        {texto}
      </span>

      {rutaAccion && (
        <Link
          to={rutaAccion}
          onClick={onAccion}
          className="catalogo-accion-aviso"
          style={{
            marginLeft: 4,
            padding: '4px 10px',
            borderRadius: 12,
            background: 'rgba(255,255,255,.15)',
            color: 'white',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            fontFamily: QUICKSAND,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Ver
        </Link>
      )}
    </div>
  )
}
