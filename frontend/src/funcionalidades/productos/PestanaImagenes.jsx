import { useRef, useState } from 'react'

const ICONO_CRUZ = 'M6 18L18 6M6 6l12 12'
const ICONO_MAS = 'M12 5v14m7-7H5'
const FLECHA_ARRIBA = 'M5 15l7-7 7 7'
const FLECHA_ABAJO = 'M19 9l-7 7-7-7'

// Los dos grupos del diseño. Cada uno numera su orden por separado: las de
// resultado van 1, 2, 3 y las de referencia también.
const GRUPOS = [
  {
    tipo: 'RESULTADO',
    titulo: 'PIEZA TERMINADA',
    ayuda: 'Ordenalas con las flechas: la primera es la portada en el catálogo',
    textoAgregar: 'Subir foto',
  },
  {
    tipo: 'REFERENCIA',
    titulo: 'REFERENCIAS',
    ayuda: 'Uso interno, no se publican',
    textoAgregar: 'Subir referencia',
  },
]


function BotonSobreFoto({ titulo, icono, onClick, color = '#8C5A66' }) {
  return (
    <button
      title={titulo}
      onClick={onClick}
      className="btn-sobre-foto"
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #EBE0E2',
        background: 'white',
        borderRadius: 5,
        cursor: 'pointer',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}


function Tarjeta({ imagen, posicion, esPrincipal, puedeSubir, puedeBajar, onSubir, onBajar, onGuardarTitulo, onBorrar }) {
  const [titulo, setTitulo] = useState(imagen.titulo)

  function alSalir() {
    // Igual que la cantidad de los materiales: si no cambió, no se manda.
    if (titulo === imagen.titulo) return
    onGuardarTitulo(imagen, titulo)
  }

  return (
    <article
      style={{
        background: 'white',
        border: '1px solid #EBE0E2',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 140,
          background: '#FAF7F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imagen.imagen}
          alt={imagen.titulo || 'Foto del producto'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 9px',
            borderRadius: 20,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            border: `1px solid ${esPrincipal ? '#8C5A66' : '#EBE0E2'}`,
            background: esPrincipal ? '#F0E2E4' : 'white',
            color: esPrincipal ? '#8C5A66' : '#857078',
          }}
        >
          {/* En pantalla se dice "portada"; en el código el concepto sigue
              siendo imagen_principal, que es el nombre del modelo. */}
          {esPrincipal ? 'Portada' : posicion}
        </span>

        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <BotonSobreFoto
            titulo="Borrar imagen"
            icono={ICONO_CRUZ}
            color="#C0442F"
            onClick={() => onBorrar(imagen)}
          />
        </div>

        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 4 }}>
          {puedeSubir && (
            <BotonSobreFoto
              titulo="Mover una posición arriba"
              icono={FLECHA_ARRIBA}
              onClick={() => onSubir(imagen)}
            />
          )}
          {puedeBajar && (
            <BotonSobreFoto
              titulo="Mover una posición abajo"
              icono={FLECHA_ABAJO}
              onClick={() => onBajar(imagen)}
            />
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '10px 12px',
          borderTop: '1px solid #EBE0E2',
        }}
      >
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={alSalir}
          maxLength={50}
          placeholder="Sin título"
          style={{
            width: '100%',
            padding: '2px 0',
            border: 0,
            background: 'transparent',
            fontSize: 14,
            color: '#3D3238',
            outline: 'none',
          }}
        />
      </div>
    </article>
  )
}


function Grupo({ grupo, imagenes, principalId, error, onSubirArchivo, onIntercambiar, onGuardarTitulo, onBorrar }) {
  const entrada = useRef(null)

  // Mover una imagen es intercambiar su orden con el de su vecina DENTRO
  // del grupo, que es la que se ve al lado en la pantalla.
  function mover(imagen, salto) {
    const i = imagenes.findIndex((x) => x.id === imagen.id)
    const vecina = imagenes[i + salto]
    if (vecina) onIntercambiar(imagen, vecina)
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#857078',
            letterSpacing: '.06em',
          }}
        >
          {grupo.titulo}
        </h2>
        <div style={{ flex: 1, height: 1, background: '#EBE0E2' }} />
        <span style={{ fontSize: 13, color: '#B08791' }}>{grupo.ayuda}</span>
      </div>

      {/* El error va acá, entre el encabezado y la grilla, para que se lea
          cerca del botón que lo provocó. */}
      {error && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 15, color: '#C0442F' }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))',
          gap: 14,
        }}
      >
        {imagenes.map((imagen, i) => (
          <Tarjeta
            key={imagen.id}
            imagen={imagen}
            // La posición es dentro del grupo: cada tipo se numera aparte.
            posicion={i + 1}
            esPrincipal={imagen.id === principalId}
            puedeSubir={i > 0}
            puedeBajar={i < imagenes.length - 1}
            onSubir={(img) => mover(img, -1)}
            onBajar={(img) => mover(img, 1)}
            onGuardarTitulo={onGuardarTitulo}
            onBorrar={onBorrar}
          />
        ))}

        <button
          onClick={() => entrada.current.click()}
          className="btn-agregar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 178,
            background: 'transparent',
            border: '1px dashed #DCC9CD',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#B08791',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" d={ICONO_MAS} />
          </svg>
          <span style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 600, fontSize: 14 }}>
            {grupo.textoAgregar}
          </span>
        </button>

        <input
          ref={entrada}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const archivo = e.target.files[0]
            // Se limpia la entrada para que elegir DOS VECES el mismo
            // archivo vuelva a disparar el onChange.
            e.target.value = ''
            if (archivo) onSubirArchivo(grupo.tipo, archivo)
          }}
        />
      </div>
    </section>
  )
}


export default function PestanaImagenes({
  imagenes,
  error,
  onSubirArchivo,
  onIntercambiar,
  onGuardarTitulo,
  onBorrar,
}) {
  // La principal es la de orden más bajo entre las de RESULTADO: las de
  // referencia no salen al catálogo. El backend las devuelve ya ordenadas
  // por (orden, id), así que es la primera de resultado que aparece.
  const principal = imagenes.find((i) => i.tipo === 'RESULTADO')
  const principalId = principal ? principal.id : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 860 }}>
      {GRUPOS.map((grupo) => (
        <Grupo
          key={grupo.tipo}
          grupo={grupo}
          imagenes={imagenes.filter((i) => i.tipo === grupo.tipo)}
          principalId={principalId}
          // El error se muestra solo en el grupo donde falló.
          error={error && error.tipo === grupo.tipo ? error.mensaje : ''}
          onSubirArchivo={onSubirArchivo}
          onIntercambiar={onIntercambiar}
          onGuardarTitulo={onGuardarTitulo}
          onBorrar={onBorrar}
        />
      ))}
    </div>
  )
}
