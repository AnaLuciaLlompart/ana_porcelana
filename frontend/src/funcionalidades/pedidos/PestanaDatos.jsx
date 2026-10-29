import SelectorBuscable from '../../componentes/SelectorBuscable'


// La forma de entrega se elige como un árbol: primero retiro o envío, y si
// es envío, quién lo paga. 'ENVIO' es el paso intermedio y no viaja nunca.
const PRIMER_NIVEL = [
  { valor: 'RETIRO', label: 'Retiro' },
  { valor: 'ENVIO', label: 'Envío' },
]

const QUIEN_PAGA = [
  { valor: 'MIO', label: 'A cargo mío' },
  { valor: 'CLIENTE', label: 'A cargo del cliente' },
]

// Las tres formas con sus textos, para el desplegable de la ficha. Son las
// etiquetas del backend, escritas acá porque la lista tiene que existir
// para elegir, como TIPOS en Gastos.
const FORMAS = {
  RETIRO: 'Retiro',
  MIO: 'Envío a cargo mío',
  CLIENTE: 'Envío a cargo del cliente',
}


const estiloEtiqueta = {
  display: 'block',
  fontFamily: "'Quicksand', sans-serif",
  fontWeight: 600,
  fontSize: 13,
  color: '#857078',
  marginBottom: 7,
  letterSpacing: '.06em',
}

const estiloCampo = {
  width: '100%',
  padding: '10px 13px',
  border: '1px solid #EBE0E2',
  fontSize: 15,
  color: '#3D3238',
  background: '#FAF7F7',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
}

// Los dos campos de fecha llevan un padding un poco menor que el resto,
// porque el selector de fecha del navegador ya trae su propio icono adentro.
const estiloFecha = { ...estiloCampo, padding: '9px 13px' }

// La entrega real se muestra pero no se escribe. Queda con el gris del texto
// secundario y el cursor de siempre, para que se lea como un dato y no como
// un campo esperando que lo completen.
const estiloFechaApagada = {
  ...estiloFecha,
  color: '#857078',
  cursor: 'default',
}


// Encabezado de campo con la etiqueta a la izquierda y una aclaración chica
// a la derecha. Lo usan los campos que necesitan explicar cuándo se
// completan, como las dos fechas de entrega.
function EtiquetaConNota({ texto, nota }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 7,
      }}
    >
      {/* El nombre del campo no se parte nunca: un "ENTREGA / REAL" en dos
          líneas se lee como si algo estuviera roto. Si el ancho no alcanza,
          lo que baja de línea es la aclaración. */}
      <span
        style={{
          ...estiloEtiqueta,
          display: 'inline',
          marginBottom: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {texto}
      </span>
      <span style={{ fontSize: 12, color: '#B08791' }}>{nota}</span>
    </label>
  )
}


// Una fila de botones de los que se elige uno solo, como los de ModalCobro.
function Segmentos({ opciones, activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {opciones.map((op) => (
        <button
          key={op.valor}
          onClick={() => onElegir(op.valor)}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: 5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            border: activo === op.valor ? '1px solid #8C5A66' : '1px solid #EBE0E2',
            background: activo === op.valor ? '#8C5A66' : 'white',
            color: activo === op.valor ? 'white' : '#857078',
          }}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}


// La tarjeta de los datos del pedido, sin pie: en el alta los botones los
// pone PieDelRecorrido, y en la ficha el pie va debajo de los productos,
// porque datos y productos se guardan juntos.
//
// esAlta elige la forma de entrega con el árbol de botones. En la ficha es
// un desplegable con las tres formas, como los demás campos.
export default function PestanaDatos({
  borrador,
  fechaEntregaReal,
  onCambiar,
  esAlta = false,
  clientes,
  error,
}) {
  const forma = borrador.forma_entrega
  const esEnvio = forma === 'ENVIO' || forma === 'MIO' || forma === 'CLIENTE'

  // El costo aparece recién cuando se sabe quién paga el envío: de eso
  // depende si suma al total, y la nota no puede decirlo antes.
  const sabeQuienPaga = forma === 'MIO' || forma === 'CLIENTE'

  // Envío: si ya había uno elegido, se conserva quién lo paga.
  function elegirPrimerNivel(valor) {
    if (valor === 'RETIRO') onCambiar({ forma_entrega: 'RETIRO' })
    else if (!esEnvio) onCambiar({ forma_entrega: 'ENVIO' })
  }

  // Lo único que cambia con quién paga el envío es esta nota. El campo del
  // costo se carga igual con los dos envíos: cuando lo paga el cliente el
  // importe se sigue anotando, y el resumen lo muestra aparte sin sumarlo.
  // Con retiro no hay costo.
  const notaCosto =
    forma === 'MIO'
      ? 'Se suma al total del pedido'
      : 'Lo paga el cliente: no suma al total'

  // Las opciones del selector de cliente: el @usuario como línea principal y
  // el nombre debajo. El id va como texto, igual que lo guardaba el <select>.
  const opcionesClientes = clientes.map((c) => ({
    valor: String(c.id),
    etiqueta: `@${c.instagram}`,
    detalle: `${c.nombre} ${c.apellido}`.trim(),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid #EBE0E2',
          borderRadius: 8,
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EBE0E2' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Quicksand', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: '#8C5A66',
              letterSpacing: '.06em',
            }}
          >
            DATOS DEL PEDIDO
          </h2>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 18,
              // Los campos se alinean por abajo. Sin esto, el que tenga el
              // encabezado más alto —porque la aclaración no entró en una
              // línea— empuja su recuadro y queda desalineado del resto.
              alignItems: 'end',
            }}
          >
            <div>
              <label htmlFor="cliente" style={estiloEtiqueta}>
                CLIENTE *
              </label>
              <SelectorBuscable
                id="cliente"
                opciones={opcionesClientes}
                valor={borrador.cliente}
                onElegir={(valor) => onCambiar({ cliente: valor })}
                placeholder="Elegí un cliente..."
                placeholderBusqueda="Buscar por @usuario o nombre..."
                estiloCampo={estiloCampo}
                flotante
              />
            </div>

            <div>
              <label htmlFor="fecha" style={estiloEtiqueta}>
                FECHA DEL PEDIDO *
              </label>
              <input
                id="fecha"
                type="date"
                value={borrador.fecha_pedido}
                onChange={(e) => onCambiar({ fecha_pedido: e.target.value })}
                style={estiloFecha}
              />
            </div>

            <div>
              <EtiquetaConNota texto="ENTREGA ESTIMADA" nota="Puede cambiar" />
              <input
                type="date"
                value={borrador.fecha_entrega_estimada}
                onChange={(e) => onCambiar({ fecha_entrega_estimada: e.target.value })}
                style={estiloFecha}
              />
            </div>

            {/* El único campo del formulario que no se edita. No sale del
                borrador como los demás, sino del pedido: la escribe el botón
                Entregado y el serializer la tiene en solo lectura, así que no
                hay nada que el formulario pueda mandar.

                disabled y no readOnly: en un campo de fecha el readOnly
                igual deja abrir el calendario del navegador. */}
            <div>
              {/* La aclaración va corta para que entre en una línea al lado
                  del nombre. La explicación entera está en el title, que
                  aparece al pasar el mouse por encima. */}
              <EtiquetaConNota texto="ENTREGA REAL" nota="Automática" />
              <input
                type="date"
                value={fechaEntregaReal}
                disabled
                title="La completa el botón Entregado"
                style={estiloFechaApagada}
              />
            </div>
          </div>

          <div
            className="envio-y-costo"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 18,
              // Por lo mismo que la fila de arriba: la nota del costo de
              // entrega es larga y cambia según quién pague el envío.
              alignItems: 'end',
            }}
          >
            <div>
              <span style={estiloEtiqueta}>FORMA DE ENTREGA *</span>

              {esAlta ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Segmentos
                    opciones={PRIMER_NIVEL}
                    activo={esEnvio ? 'ENVIO' : forma}
                    onElegir={elegirPrimerNivel}
                  />

                  {esEnvio && (
                    <div>
                      <span style={estiloEtiqueta}>¿QUIÉN PAGA EL ENVÍO?</span>
                      <Segmentos
                        opciones={QUIEN_PAGA}
                        activo={forma}
                        onElegir={(valor) => onCambiar({ forma_entrega: valor })}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <select
                  value={forma}
                  onChange={(e) => onCambiar({ forma_entrega: e.target.value })}
                  style={{ ...estiloCampo, cursor: 'pointer' }}
                >
                  {Object.entries(FORMAS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {sabeQuienPaga && (
              <div>
                <EtiquetaConNota texto="COSTO DE ENTREGA" nota={notaCosto} />
                <input
                  value={borrador.costo_entrega}
                  // Se limpia todo lo que no sea dígito, como el precio en la
                  // ficha de Producto: los importes se cargan en pesos
                  // enteros.
                  onChange={(e) => onCambiar({ costo_entrega: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="$"
                  style={estiloCampo}
                />
              </div>
            )}
          </div>

          {esEnvio && (
            <div>
              <label htmlFor="direccion" style={estiloEtiqueta}>
                DIRECCIÓN DE ENTREGA
              </label>
              <input
                id="direccion"
                value={borrador.direccion_entrega}
                onChange={(e) => onCambiar({ direccion_entrega: e.target.value })}
                maxLength={100}
                placeholder="Calle y número, localidad, referencias..."
                style={estiloCampo}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: '10px 12px',
                background: '#FAEAE8',
                border: '1px solid #F0C4BC',
                borderRadius: 6,
                fontSize: 14,
                color: '#C0442F',
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
