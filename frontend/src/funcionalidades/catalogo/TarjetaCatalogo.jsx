import { Link } from 'react-router-dom'
import { ICONO_CAMARA, QUICKSAND, formatearPrecio, tinteDe } from './presentacion'

// La tarjeta de la grilla del catálogo (CU63). Toda la tarjeta es un
// enlace al detalle del producto: es un <Link> y no un botón para que se
// pueda abrir en otra pestaña y copiar su dirección.
//
// `filtros` es la consulta con la que está el catálogo en este momento
// ("?categoria=3", o vacío). Viaja en el state del enlace, que no se ve en
// la dirección, para que "Volver al catálogo" del detalle sepa a qué
// catálogo volver.
//
// `indice` es la posición de la tarjeta en la grilla. Decide si la foto se
// pide al entrar o recién cuando el visitante se acerca (loading="lazy").

// Cuántas tarjetas cargan su foto al entrar. Son las que entran en la
// primera pantalla de un celular (dos columnas, cuatro filas); las que
// siguen esperan a que el visitante baje. La primera de todas va además
// con prioridad alta: es la imagen más grande de la primera pantalla
// (la LCP), y conviene que el navegador la pida antes que el resto.
const PRIMERAS_SIN_LAZY = 8

// La tarjeta muestra el nombre y el precio, nada más: la dificultad de
// elaboración va solo en el detalle, porque como chip en la miniatura no
// se entendía a qué se refería.
export default function TarjetaCatalogo({ producto, filtros, indice }) {
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
      {/* overflow hidden hace falta además del aspectRatio: sin él, una
          foto vertical estira la caja a su propio alto, porque un elemento
          no puede quedar más chico que lo que tiene adentro. Con él, todas
          las cajas son cuadradas y la foto se recorta (object-fit cover). */}
      <div
        style={{
          aspectRatio: '1',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: tinteDe(producto),
        }}
      >
        {producto.imagen_principal ? (
          <img
            src={producto.imagen_principal}
            alt={producto.nombre}
            loading={indice < PRIMERAS_SIN_LAZY ? 'eager' : 'lazy'}
            fetchPriority={indice === 0 ? 'high' : undefined}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#87A0B0" strokeWidth="1.4">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAMARA} />
          </svg>
        )}
      </div>

      {/* La grilla estira todas las tarjetas de una fila al alto de la más
          alta. El precio va al pie (marginTop auto), así en la fila los
          precios quedan alineados aunque un nombre ocupe dos renglones y
          otro uno, y el aire que sobra queda entre el nombre y el precio,
          no debajo del precio. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px 12px', width: '100%' }}>
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

        <p style={{ margin: 0, paddingTop: 4, marginTop: 'auto', fontFamily: QUICKSAND, fontWeight: 700, fontSize: 15, color: '#5A7A8C' }}>
          {formatearPrecio(producto.precio_actual)}
        </p>
      </div>
    </Link>
  )
}
