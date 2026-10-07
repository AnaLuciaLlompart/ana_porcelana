import { Link } from 'react-router-dom'
import { INSTAGRAM_URL, INSTAGRAM_USUARIO } from '../../constantes'
import { QUICKSAND } from './presentacion'

// La página "Cómo hacer un pedido". Es texto: no le pide nada al servidor
// ni lee la selección. Los textos salen del diseño (la pantalla comoPedir
// y la constante PASOS del script), salvo el párrafo de pedidos
// personalizados, que Ana reescribió al aprobar esta etapa.
//
// El diseño tenía además una pantalla "Pieza personalizada" con un
// formulario. No se implementa, porque no corresponde a ningún caso de
// uso: de ese tema queda solo el bloque de abajo, que remite a Instagram.

// Los cuatro pasos. El cuarto nombra el usuario de Instagram, y ahí el
// usuario es un enlace al perfil: por eso ese texto es JSX y no un string.
const PASOS = [
  {
    numero: '1',
    titulo: 'Mirá el catálogo',
    texto: 'Recorré las piezas por tipo o por temática. Cada una tiene sus fotos, su descripción y su precio orientativo.',
  },
  {
    numero: '2',
    titulo: 'Armá tu selección',
    texto: 'Desde cada pieza tocá "Agregar a mi selección". En Mi selección (el corazón de arriba) vas a ver todo lo elegido: ajustá cantidades con − y +, quitá lo que no quieras y anotá las aclaraciones: colores, fechas, detalles.',
  },
  {
    numero: '3',
    titulo: 'Generá el mensaje',
    texto: 'Con un botón armás el texto con todo lo que elegiste. Lo copiás y listo.',
  },
  {
    numero: '4',
    titulo: 'Mandámelo por DM',
    texto: (
      <>
        Pegalo en el chat de{' '}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="catalogo-instagram"
          style={{ color: '#5A7A8C', fontWeight: 600 }}
        >
          @{INSTAGRAM_USUARIO}
        </a>
        . Ahí confirmamos precio, fecha y forma de entrega.
      </>
    ),
  },
]

export default function ComoHacerUnPedido() {
  return (
    <section>
      <h1 style={{ margin: '0 0 6px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 32, color: '#5A7A8C' }}>
        Cómo hacer un pedido
      </h1>
      <p style={{ margin: '0 0 24px', maxWidth: 1000, fontSize: 15, lineHeight: 1.55, color: '#323A3D', textWrap: 'pretty' }}>
        Soy Ana y hago cada pieza a mano, en porcelana fría. En esta página no se realiza la compra de mis productos, sino que armás tu selección (productos de tu interés) y me la mandás por mensaje por Instagram. Seguimos charlando por ahí para acordar fechas de entrega y envío.
      </p>

      {/* Los pasos se acomodan solos: una columna en celular, dos en una
          tablet, cuatro en escritorio, según cuántos de 230px entren. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 14,
          maxWidth: 1000,
        }}
      >
        {PASOS.map((paso) => (
          <div
            key={paso.numero}
            style={{
              background: 'white',
              border: '1px solid #E0E8EB',
              borderRadius: 8,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
                background: '#E2EAF0',
                fontFamily: QUICKSAND,
                fontWeight: 700,
                fontSize: 16,
                color: '#5A7A8C',
              }}
            >
              {paso.numero}
            </span>
            <p style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 16, color: '#323A3D' }}>
              {paso.titulo}
            </p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#708085', textWrap: 'pretty' }}>
              {paso.texto}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          maxWidth: 1000,
          padding: '20px 22px',
          background: 'white',
          border: '1px solid #E0E8EB',
          borderRadius: 8,
        }}
      >
        <p style={{ margin: 0, fontFamily: QUICKSAND, fontWeight: 600, fontSize: 16, color: '#323A3D' }}>
          ¿Tenés una idea que no está en el catálogo?
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.55, color: '#708085', textWrap: 'pretty' }}>
          También hago pedidos personalizados: alguna temática que te guste, un regalo con iniciales, un color en particular. Escribime por Instagram con tu idea y, si tenés, una referencia (por ejemplo, de Pinterest). Te paso un presupuesto antes de empezar.
        </p>
      </div>

      <Link
        to="/"
        className="catalogo-relleno"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '11px 20px',
          background: '#5A7A8C',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontFamily: QUICKSAND,
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        Ver el catálogo
      </Link>
    </section>
  )
}
