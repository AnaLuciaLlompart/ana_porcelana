import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { obtenerProductoDelCatalogo } from './api'
import CajaMensaje from './CajaMensaje'
import { ordenarCategorias } from './filtros'
import { CANTIDAD_MAXIMA } from './seleccion'
import {
  ICONO_CAMARA,
  ICONO_MAS,
  ICONO_MENOS,
  ICONO_TACHO,
  ICONO_VOLVER,
  NIVEL_DIFICULTAD,
  QUICKSAND,
  formatearPrecio,
  tinteDe,
} from './presentacion'

// El detalle de un producto del catálogo público (CU65).
//
// A diferencia del listado, esta pantalla sí le pide algo al servidor: la
// lista que cargó el layout no trae todas las fotos, y el detalle sí.

export default function DetalleCatalogo() {
  const { id } = useParams()
  const ubicacion = useLocation()
  const { seleccion } = useOutletContext()

  const [producto, setProducto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // Va aparte del error porque no es una falla: el servidor contestó bien
  // que ese producto no está en el catálogo. Se muestra otra cosa.
  const [noExiste, setNoExiste] = useState(false)
  // Cuál de las fotos está a la vista. Lo escribe alDeslizar a partir de
  // cuánto se desplazó la fila de fotos, y es lo que marca la miniatura. Es
  // estado local: no hace falta que sobreviva a salir de la pantalla.
  const [fotoIdx, setFotoIdx] = useState(0)
  // La fila de fotos de la galería, para leer y mover su desplazamiento.
  const fila = useRef(null)

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
    return <p style={{ margin: 0, fontSize: 15, color: '#64727A' }}>Cargando…</p>
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

  const nivel = NIVEL_DIFICULTAD[producto.dificultad]
  const categorias = ordenarCategorias(producto.categorias)

  // La tarjeta del listado deja anotada en el state del enlace la consulta
  // con la que estaba el catálogo ("?categoria=3"). Volver la usa para
  // llegar al catálogo con los mismos filtros. Si se entró directo a esta
  // dirección no hay nada anotado, y se vuelve al catálogo entero.
  const volver = `/${ubicacion.state?.filtros ?? ''}`

  // Cuántas de esta pieza hay ya en la selección: 0 si ninguna.
  const enSeleccion = seleccion.cantidades[producto.id] || 0

  // CU66. La primera pieza: la agrega, y desde ahí el botón pasa a ser el
  // contador. No hay aviso flotante: el contador que aparece en el lugar
  // del botón ya dice que se agregó.
  function agregar() {
    seleccion.agregarProducto(producto.id)
  }

  // El − del contador. Con dos o más resta una (CU67); con una sola, la
  // quita de la selección (CU68) y el contador vuelve a ser el botón.
  // Ninguno de los dos avisa: el efecto se ve en el contador mismo.
  function restar() {
    if (enSeleccion > 1) seleccion.modificarCantidad(producto.id, enSeleccion - 1)
    else seleccion.quitarProducto(producto.id)
  }

  // La galería se recorre deslizando el dedo sobre la foto (la fila se
  // desplaza de costado) o tocando una miniatura. Las dos cosas mueven la
  // misma fila, y la miniatura marcada sale siempre de dónde quedó la fila:
  // así no pueden contradecirse.
  //
  // Al deslizar: qué foto quedó a la vista. Cada foto mide lo mismo que la
  // fila, así que es cuánto se desplazó dividido ese ancho, redondeado.
  function alDeslizar() {
    const { scrollLeft, clientWidth } = fila.current
    setFotoIdx(Math.round(scrollLeft / clientWidth))
  }

  // Al tocar una miniatura: llevar la fila hasta esa foto, con movimiento
  // suave. La miniatura se marca sola cuando la foto llega, por alDeslizar.
  function irAFoto(indice) {
    fila.current.scrollTo({ left: indice * fila.current.clientWidth, behavior: 'smooth' })
  }

  // Los dos botones de los costados del contador: cuadrados, sin fondo,
  // separados del número por una línea.
  const estiloBotonContador = {
    width: 56,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    background: 'transparent',
    color: '#557385',
    cursor: 'pointer',
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
          color: '#557385',
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
            {producto.imagenes.length > 0 ? (
              <div
                ref={fila}
                onScroll={alDeslizar}
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  scrollSnapType: 'x mandatory',
                  overscrollBehaviorX: 'contain',
                  scrollbarWidth: 'none',
                }}
              >
                {producto.imagenes.map((imagen) => (
                  <img
                    key={imagen.id}
                    src={imagen.imagen}
                    alt={producto.nombre}
                    style={{
                      flex: '0 0 100%',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      scrollSnapAlign: 'center',
                      scrollSnapStop: 'always',
                    }}
                  />
                ))}
              </div>
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#87A0B0" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_CAMARA} />
              </svg>
            )}
          </div>

          {/* Las miniaturas son botones y no enlaces: llevan la fila hasta
              esa foto, no llevan a ninguna otra pantalla. Con una sola foto
              no hay nada que elegir y no se dibujan. */}
          {producto.imagenes.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {producto.imagenes.map((imagen, indice) => (
                <button
                  key={imagen.id}
                  onClick={() => irAFoto(indice)}
                  style={{
                    width: 64,
                    height: 64,
                    flexShrink: 0,
                    padding: 0,
                    overflow: 'hidden',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: tinteDe(producto),
                    border: `2px solid ${fotoIdx === indice ? '#557385' : 'transparent'}`,
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

            <p style={{ margin: '8px 0 0', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 24, color: '#557385' }}>
              {formatearPrecio(producto.precio_actual)}
            </p>
          </div>

          <div style={{ height: 1, background: '#E0E8EB' }} />

          {/* La descripción es una sección con título, para que se distinga
              del nombre y el precio. Adentro van la dificultad de
              elaboración, el texto y las categorías. El título es como los
              títulos de grupo de los filtros, pero un poco más grande y en
              el celeste del precio. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#557385',
              }}
            >
              Descripción
            </p>

            {/* La dificultad de elaboración: el texto y tres círculos que se
                rellenan según el nivel (●○○, ●●○, ●●●). Son círculos en SVG y
                no esos caracteres: un carácter lo dibuja cada sistema con su
                fuente, y acá tienen que verse iguales en todos, como el
                corazón de la portada. Sin colores de semáforo: el rojo se
                lee como error y no va con la estética de la página. */}
            <p
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 15,
                color: '#323A3D',
              }}
            >
              Dificultad de elaboración: {producto.dificultad_display.toLowerCase()}
              <svg width="40" height="12" viewBox="0 0 40 12" role="img" aria-label={`${nivel} de 3`}>
                {[0, 1, 2].map((indice) => (
                  <circle
                    key={indice}
                    cx={6 + indice * 14}
                    cy="6"
                    r="5"
                    fill={indice < nivel ? '#557385' : 'white'}
                    stroke="#557385"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
            </p>

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
                      color: '#323A3D',
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
          </div>

          <div style={{ height: 1, background: '#E0E8EB' }} />

          {/* Sin la pieza en la selección, el botón "Agregar a mi
              selección". Con la pieza, en el mismo lugar y del mismo tamaño,
              el contador: − (o el tachito si queda una), cuántas hay y +.
              Son botones y no enlaces: cambian la selección, no llevan a
              ningún lado. */}
          {enSeleccion === 0 ? (
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
                background: '#557385',
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
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                width: '100%',
                height: 48,
                border: '1px solid #557385',
                borderRadius: 6,
                background: 'white',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={restar}
                title={enSeleccion === 1 ? 'Quitar de mi selección' : 'Una menos'}
                className="catalogo-suave"
                style={{ ...estiloBotonContador, borderRight: '1px solid #E0E8EB' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={enSeleccion === 1 ? 1.8 : 2.3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={enSeleccion === 1 ? ICONO_TACHO : ICONO_MENOS} />
                </svg>
              </button>

              {/* aria-live hace que un lector de pantalla diga la cantidad
                  nueva cada vez que cambia. */}
              <span
                aria-live="polite"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: QUICKSAND,
                  fontWeight: 600,
                  fontSize: 16,
                  color: '#323A3D',
                }}
              >
                {enSeleccion}
              </span>

              <button
                onClick={() => seleccion.modificarCantidad(producto.id, enSeleccion + 1)}
                disabled={enSeleccion >= CANTIDAD_MAXIMA}
                title="Una más"
                className="catalogo-suave"
                style={{
                  ...estiloBotonContador,
                  borderLeft: '1px solid #E0E8EB',
                  opacity: enSeleccion >= CANTIDAD_MAXIMA ? 0.4 : undefined,
                  cursor: enSeleccion >= CANTIDAD_MAXIMA ? 'default' : 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path strokeLinecap="round" d={ICONO_MAS} />
                </svg>
              </button>
            </div>
          )}

          {/* Después de agregar, el paso siguiente: ver la selección. Es un
              enlace porque lleva a otra pantalla. */}
          {enSeleccion > 0 && (
            <Link
              to="/seleccion"
              className="catalogo-subrayado"
              style={{
                alignSelf: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: -4,
                textDecoration: 'none',
                fontFamily: QUICKSAND,
                fontWeight: 600,
                fontSize: 15,
                color: '#557385',
              }}
            >
              Ver mi selección
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#64727A', textWrap: 'pretty' }}>
            Cada pieza se hace a mano, por eso puede variar un poquito respecto de la foto.
          </p>
        </div>
      </div>
    </section>
  )
}
