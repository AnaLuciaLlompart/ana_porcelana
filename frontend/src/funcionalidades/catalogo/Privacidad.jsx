import { QUICKSAND } from './presentacion'

// La página de Privacidad, enlazada desde el pie. Existe por la Ley 25.326:
// la gestión guarda datos de los clientes y hay que decir cuáles, para qué
// y cómo pedir que se corrijan o se borren. El texto es de Ana, tal cual.

const CORREO = 'ana.porcelanaaaa@gmail.com'

const estiloParrafo = {
  margin: '0 0 14px',
  fontSize: 15,
  lineHeight: 1.55,
  color: '#323A3D',
  textWrap: 'pretty',
}

export default function Privacidad() {
  return (
    <section>
      <h1 style={{ margin: '0 0 24px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 32, color: '#557385' }}>
        Privacidad
      </h1>

      <div
        style={{
          maxWidth: 720,
          background: 'white',
          border: '1px solid #E0E8EB',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <p style={estiloParrafo}>
          Esta página no te pide ningún dato para navegarla, y solo usa las cookies necesarias para funcionar.
        </p>
        <p style={estiloParrafo}>
          Cuando hacés un pedido, guardo tu usuario de Instagram, tu nombre y apellido, tu correo, el detalle de
          tus pedidos y pagos y, si hay envío, la dirección de entrega. Los uso solo para preparar tu pedido,
          mandarte los comprobantes y hablar con vos sobre tu compra. No se los paso a nadie.
        </p>
        <p style={estiloParrafo}>
          Si querés ver, corregir o borrar tus datos, escribime a{' '}
          <a
            href={`mailto:${CORREO}`}
            className="catalogo-subrayado"
            style={{ color: '#557385', textDecoration: 'none', overflowWrap: 'anywhere' }}
          >
            {CORREO}
          </a>
          .
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#64727A' }}>Ana Porcelana</p>
      </div>
    </section>
  )
}
