import { useEffect, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { obtenerProductoDelCatalogo } from './api'
import CajaMensaje from './CajaMensaje'
import { ordenarCategorias } from './filtros'
import {
  COLOR_DIFICULTAD,
  ICONO_CAMARA,
  ICONO_MAS,
  ICONO_VOLVER,
  QUICKSAND,
  formatearPrecio,
  textoDificultad,
  tinteDe,
} from './presentacion'

// El detalle de un producto del catálogo público (CU65).
//
// A diferencia del listado, esta pantalla sí le pide algo al servidor: la
// lista que cargó el layout no trae todas las fotos, y el detalle sí.

export default function DetalleCatalogo() {
  const { id } = useParams()
  const ubicacion = useLocation()
  const { seleccion, mostrarAviso } = useOutletContext()

  const [producto, setProducto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Va aparte del error porque no es una falla: el servidor contestó bien
  // que ese producto no está en el catálogo. Se muestra otra cosa.
  const [noExiste, setNoExiste] = useState(false)
  // Cuál de las fotos está en grande. Es estado local: no hace falta que
  // sobreviva a salir de la pantalla.
  const [fotoIdx, setFotoIdx] = useState(0)

  // Si se pasa de una pieza a otra sin salir de la pantalla (solo pasa
  // escribiendo la dirección a mano: ningún enlace del catálogo lo hace),
  // lo de la pieza anterior no vale: se vuelve al estado inicial antes de
  // pedir la nueva. Se compara el id con el ya cargado en el dibujo mismo,
  // que es como React pide reiniciar estado cuando cambia una prop, y no
  // dentro de un efecto.
  const [idCargado, setIdCargado] = useState(id)
  if (idCargado !== id) {
    setIdCargado(id)
    setProducto(null)
    setCargando(true)
    setError('')
    setNoExiste(false)
    setFotoIdx(0)
  }

  useEffect(() => {
    obtenerProductoDelCatalogo(id)
      .then((res) => setProducto(res.data))
      .catch((err) => {
        // El backend responde el mismo 404 para un producto que no existe
        // y para uno que existe pero no se muestra.
        if (err.response?.status === 404) setNoExiste(true)
        else setError('No se pudo cargar el producto.')
      })
      .finally(() => setCargando(false))
  }, [id])

  if (cargando) {
    return <p style={{ margin: 0, fontSize: 15, color: '#708085' }}>Cargando…</p>
  }

  if (noExiste) {
    return (
      <CajaMensaje
        titulo="No encontramos esa pieza"
        textoSalida="Volver al catálogo"
        ruta="/"
      />
    )
  }

  if (error) {
    return <CajaMensaje titulo={error} textoSalida="Volver al catálogo" ruta="/" />
  }

  const dificultad = COLOR_DIFICULTAD[producto.dificultad]
  const foto = producto.imagenes[fotoIdx]
  const categorias = ordenarCategorias(producto.categorias)

  // La tarjeta del listado deja anotada en el state del enlace la consulta
  // con la que estaba el catálogo ("?categoria=3"). Volver la usa para
  // llegar al catálogo con los mismos filtros. Si se entró directo a esta
  // dirección no hay nada anotado, y se vuelve al catálogo entero.
  const volver = `/${ubicacion.state?.filtros ?? ''}`

  // Cuántas de esta pieza hay ya en la selección: 0 si ninguna.
  const enSeleccion = seleccion.cantidades[producto.id] || 0

  // CU66. Suma una y avisa, con el "Ver" que lleva a la selección.
  function agregar() {
    seleccion.agregarProducto(producto.id)
    mostrarAviso(`${producto.nombre} agregado a tu selección`, '/seleccion')
  }

  return (
    <section>
      <Link
        to={volver}
        className="catalogo-subrayado"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 16,
          textDecoration: 'none',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 15,
          color: '#5A7A8C',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_VOLVER} />
        </svg>
        Volver al catálogo
      </Link>

      {/* En celular, la galería arriba y los datos abajo. La clase los pone
          lado a lado de 900px para arriba. */}
      <div
        className="catalogo-detalle"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28, alignItems: 'start' }}
      >
        <div>
          <div
            style={{
              aspectRatio: '1',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '1px solid #E0E8EB',
              borderRadius: 8,
              background: tinteDe(producto),
            }}
          >
            {foto ? (
              <img
                src={foto.imagen}
                alt={producto.nombre}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#87A0B0" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAMARA} />
              </svg>
            )}
          </div>

          {/* Las miniaturas son botones y no enlaces: cambian la foto
              grande, no llevan a ningún lado. Con una sola foto no hay
              nada que elegir y no se dibujan. */}
          {producto.imagenes.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {producto.imagenes.map((imagen, indice) => (
                <button
                  key={imagen.id}
                  onClick={() => setFotoIdx(indice)}
                  style={{
                    width: 64,
                    height: 64,
                    flexShrink: 0,
                    padding: 0,
                    overflow: 'hidden',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: tinteDe(producto),
                    border: `2px solid ${fotoIdx === indice ? '#5A7A8C' : 'transparent'}`,
                  }}
                >
                  <img
                    src={imagen.imagen}
                    alt={producto.nombre}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 32,
                lineHeight: 1.15,
                color: '#323A3D',
                textWrap: 'pretty',
              }}
            >
              {producto.nombre}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
              <p style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 24, color: '#5A7A8C' }}>
                {formatearPrecio(producto.precio_actual)}
              </p>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 13,
                  border: `1px solid ${dificultad.color}`,
                  background: dificultad.fondo,
                  color: dificultad.color,
                }}
              >
                {textoDificultad(producto)}
              </span>
            </div>
          </div>

          {producto.descripcion && (
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#323A3D', textWrap: 'pretty' }}>
              {producto.descripcion}
            </p>
          )}

          {/* Cada categoría lleva al catálogo filtrado por ella sola. */}
          {categorias.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {categorias.map((categoria) => (
                <Link
                  key={categoria.id}
                  to={`/?categoria=${categoria.id}`}
                  className="catalogo-tarjeta"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid #E0E8EB',
                    background: '#E2EAF0',
                    color: '#5A7A8C',
                    textDecoration: 'none',
                    fontFamily: QUICKSAND,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {categoria.nombre}
                </Link>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: '#E0E8EB' }} />

          {/* Es un botón y no un enlace: agrega, no lleva a ningún lado. */}
          <button
            onClick={agregar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              minHeight: 48,
              padding: '12px 20px',
              border: 0,
              background: '#5A7A8C',
              color: 'white',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: QUICKSAND,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path strokeLinecap="round" d={ICONO_MAS} />
            </svg>
            Agregar a mi selección
          </button>

          {enSeleccion > 0 && (
            <p style={{ margin: '-4px 0 0', textAlign: 'center', fontSize: 14, color: '#708085' }}>
              Ya tenés {enSeleccion} en tu selección
            </p>
          )}

          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#708085', textWrap: 'pretty' }}>
            Cada pieza se hace a mano, por eso puede variar un poquito respecto de la foto. El precio es orientativo: te lo confirmo por mensaje.
          </p>
        </div>
      </div>
    </section>
  )
}
