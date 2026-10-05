import { useEffect, useRef, useState } from 'react'

const ICONO_LUPA = 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
const ICONO_FLECHA = 'M19 9l-7 7-7-7'


// "jose" tiene que encontrar "José". NFD separa cada letra acentuada en la
// letra y su acento, y el rango ̀-ͯ son justamente los acentos,
// que se quitan antes de comparar en minúscula.
function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}


// Selector de una entidad con buscador. Se ve como un campo que muestra lo
// elegido o un placeholder; al tocarlo se abre debajo un panel con una
// entrada de búsqueda y la lista filtrada. Con siempreAbierto no hay campo:
// el panel está siempre visible, que es lo que necesita un modal que no es
// otra cosa que la lista.
//
// Cada opción es { valor, etiqueta, detalle, deshabilitada }: valor es lo
// que se guarda y se devuelve en onElegir, etiqueta la línea principal,
// detalle una segunda línea gris (opcional) y deshabilitada el motivo, como
// texto, cuando la opción no se puede elegir (opcional). El buscador filtra
// sobre etiqueta y detalle, que es exactamente lo que se ve en cada fila.
//
// Los datos llegan enteros por props y se filtran acá, en memoria, sin
// debounce: a la escala de este sistema (cientos de filas como mucho) es
// más rápido que pedirle al servidor en cada tecla. Si algún día una lista
// pasa de varios miles, el cambio es pedir con ?search= y debounce, y se
// hace desde este único lugar.
//
// El panel se abre en el flujo, empujando lo que tiene abajo, y no flotando:
// los modales tienen el cuerpo con overflowY auto, que recortaría un panel
// flotante, y así tampoco hace falta z-index ni calcular posiciones.
export default function SelectorBuscable({
  opciones,
  valor = '',
  onElegir,
  placeholder,
  placeholderBusqueda,
  estiloCampo,
  id,
  deshabilitado = false,
  siempreAbierto = false,
}) {
  const [abierto, setAbierto] = useState(siempreAbierto)
  const [busqueda, setBusqueda] = useState('')
  const [indiceActiva, setIndiceActiva] = useState(0)

  const contenedor = useRef(null)
  const campo = useRef(null)
  const entrada = useRef(null)
  const lista = useRef(null)

  // Se compara como texto porque quien usa el selector puede tener el valor
  // guardado como número (el que vino del backend) o como texto (el que
  // eligió acá).
  const elegida = opciones.find((op) => String(op.valor) === String(valor))

  const texto = sinAcentos(busqueda.trim())

  const filtradas = opciones.filter(
    (op) => !texto || sinAcentos(`${op.etiqueta} ${op.detalle || ''}`).includes(texto)
  )

  // Al abrir, el foco pasa a la entrada de búsqueda.
  useEffect(() => {
    if (abierto) entrada.current?.focus()
  }, [abierto])

  // Un clic afuera cierra el panel. Se escucha solo mientras está abierto,
  // y nunca en la forma siempre abierta, que no tiene qué cerrar.
  useEffect(() => {
    if (!abierto || siempreAbierto) return

    function alClicAfuera(evento) {
      if (!contenedor.current.contains(evento.target)) setAbierto(false)
    }

    document.addEventListener('mousedown', alClicAfuera)
    return () => document.removeEventListener('mousedown', alClicAfuera)
  }, [abierto, siempreAbierto])

  // La fila activa por teclado se mantiene a la vista dentro de la lista.
  useEffect(() => {
    lista.current?.querySelector('[data-activa="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [indiceActiva])

  function abrir() {
    if (deshabilitado) return

    const indiceElegida = opciones.findIndex((op) => String(op.valor) === String(valor))

    setBusqueda('')
    setIndiceActiva(indiceElegida === -1 ? 0 : indiceElegida)
    setAbierto(true)
  }

  function cerrar() {
    if (siempreAbierto) return

    setAbierto(false)
    campo.current?.focus()
  }

  function elegir(opcion) {
    if (opcion.deshabilitada) return

    onElegir(opcion.valor)
    cerrar()
  }

  function alTeclear(evento) {
    if (evento.key === 'ArrowDown' && filtradas.length > 0) {
      evento.preventDefault()
      setIndiceActiva((i) => Math.min(i + 1, filtradas.length - 1))
    } else if (evento.key === 'ArrowUp' && filtradas.length > 0) {
      evento.preventDefault()
      setIndiceActiva((i) => Math.max(i - 1, 0))
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      if (filtradas[indiceActiva]) elegir(filtradas[indiceActiva])
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      cerrar()
    }
  }

  return (
    <div ref={contenedor}>
      {!siempreAbierto && (
        <button
          type="button"
          id={id}
          ref={campo}
          onClick={abierto ? cerrar : abrir}
          disabled={deshabilitado}
          className="selector-campo"
          style={{
            ...estiloCampo,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            textAlign: 'left',
            cursor: deshabilitado ? 'default' : 'pointer',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: elegida ? undefined : '#857078',
            }}
          >
            {elegida ? elegida.etiqueta : placeholder}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#857078"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_FLECHA} />
          </svg>
        </button>
      )}

      {abierto && (
        <div
          style={{
            marginTop: siempreAbierto ? 0 : 6,
            border: '1px solid #EBE0E2',
            borderRadius: 6,
            background: 'white',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 10, borderBottom: '1px solid #EBE0E2' }}>
            <div style={{ position: 'relative' }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#857078"
                strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              >
                <path strokeLinecap="round" d={ICONO_LUPA} />
              </svg>

              <input
                ref={entrada}
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setIndiceActiva(0)
                }}
                onKeyDown={alTeclear}
                placeholder={placeholderBusqueda}
                style={{
                  width: '100%',
                  padding: '8px 16px 8px 36px',
                  border: '1px solid #EBE0E2',
                  background: 'white',
                  fontSize: 16,
                  color: '#3D3238',
                  borderRadius: 5,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div ref={lista} style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtradas.map((op, indice) => {
              const esElegida = elegida && String(op.valor) === String(elegida.valor)
              const esActiva = indice === indiceActiva

              return (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => elegir(op)}
                  disabled={Boolean(op.deshabilitada)}
                  data-activa={esActiva}
                  className="selector-opcion"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    border: 0,
                    borderBottom: indice < filtradas.length - 1 ? '1px solid #EBE0E2' : 0,
                    background: esElegida ? '#F0E2E4' : esActiva ? '#FAF7F7' : 'white',
                    cursor: op.deshabilitada ? 'default' : 'pointer',
                    opacity: op.deshabilitada ? 0.5 : undefined,
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 15,
                      color: esElegida ? '#8C5A66' : '#3D3238',
                      fontWeight: esElegida ? 600 : 400,
                    }}
                  >
                    {op.etiqueta}
                  </span>

                  {(op.deshabilitada || op.detalle) && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: 13,
                        color: op.deshabilitada ? '#B08791' : '#857078',
                      }}
                    >
                      {op.deshabilitada || op.detalle}
                    </span>
                  )}
                </button>
              )
            })}

            {filtradas.length === 0 && (
              <div style={{ padding: '18px 14px', textAlign: 'center', fontSize: 15, color: '#857078' }}>
                No hay coincidencias.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
