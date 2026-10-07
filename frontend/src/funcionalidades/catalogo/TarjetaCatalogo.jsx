import { Link } from 'react-router-dom'
import {
  COLOR_DIFICULTAD,
  ICONO_CAMARA,
  QUICKSAND,
  formatearPrecio,
  textoDificultad,
  tinteDe,
} from './presentacion'

// La tarjeta de la grilla del catálogo (CU63). Toda la tarjeta es un
// enlace al detalle del producto: es un <Link> y no un botón para que se
// pueda abrir en otra pestaña y copiar su dirección.
//
// `filtros` es la consulta con la que está el catálogo en este momento
// ("?categoria=3", o vacío). Viaja en el state del enlace, que no se ve en
// la dirección, para que "Volver al catálogo" del detalle sepa a qué
// catálogo volver.

export default function TarjetaCatalogo({ producto, filtros }) {
  const dificultad = COLOR_DIFICULTAD[producto.dificultad]

  return (
    <Link
      to={`/productos/${producto.id}`}
      state={{ filtros }}
      className="catalogo-tarjeta"
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        textDecoration: 'none',
        border: '1px solid #E0E8EB',
        background: 'white',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '1',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tinteDe(producto),
        }}
      >
        {producto.imagen_principal ? (
          <img
            src={producto.imagen_principal}
            alt={producto.nombre}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#87A0B0" strokeWidth="1.4">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAMARA} />
          </svg>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px', width: '100%' }}>
        <p
          style={{
            margin: 0,
            fontFamily: QUICKSAND,
            fontWeight: 600,
            fontSize: 15,
            lineHeight: 1.3,
            color: '#323A3D',
            textWrap: 'pretty',
          }}
        >
          {producto.nombre}
        </p>

        <p style={{ margin: '4px 0 0', fontFamily: QUICKSAND, fontWeight: 700, fontSize: 15, color: '#5A7A8C' }}>
          {formatearPrecio(producto.precio_actual)}
        </p>

        <span
          style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '3px 9px',
            borderRadius: 20,
            fontFamily: QUICKSAND,
            fontWeight: 600,
            fontSize: 12,
            border: `1px solid ${dificultad.color}`,
            background: dificultad.fondo,
            color: dificultad.color,
          }}
        >
          {textoDificultad(producto)}
        </span>
      </div>
    </Link>
  )
}
