import { QUICKSAND } from './presentacion'

// La página "Tips para tus piezas". Es texto: no le pide nada al servidor
// ni lee la selección. Los iconos y los dos primeros tips salen tal cual
// del diseño (la pantalla tips); los otros cuatro los reescribió Ana al
// aprobar esta etapa, para que hablen de vos como el resto del catálogo.

const TIPS = [
  {
    icono: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
    titulo: 'Cuidado con el agua',
    texto: 'La porcelana fría NO es resistente al agua. Aunque los productos cuentan con una capa protectora de barniz, el agua puede dañar los materiales. En caso de que el producto se haya salpicado con agua, se debe secar suavemente con papel.',
  },
  {
    icono: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    titulo: 'Los aritos son de fantasía',
    texto: 'Los ganchos y las argollas de los aros son de fantasía, no de plata ni de acero quirúrgico. Si tenés la piel sensible, tenelo en cuenta y evitá usarlos por muchas horas seguidas.',
  },
  {
    icono: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
    titulo: 'Alejalos del calor extremo',
    texto: 'Evitá altas temperaturas o fuentes de calor directo que puedan alterar la dureza y consistencia del material.',
  },
  {
    icono: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
    titulo: 'Limpieza suave',
    texto: 'Si se ensucian o acumulan polvo, limpialos únicamente con un paño seco o apenas húmedo (sin jabones abrasivos ni químicos), y secalos de inmediato.',
  },
  {
    icono: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    titulo: 'Almacenamiento seguro',
    texto: 'Guardalos en un lugar fresco y seco, preferiblemente separados en una caja o bolsita para evitar golpes, aplastamientos o rayones accidentales.',
  },
  {
    icono: 'M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11',
    titulo: 'Tratalos con delicadeza',
    texto: 'Al ser piezas artesanales y finas, evitá doblarlas, apretarlas o dejarlas caer.',
  },
]

export default function Tips() {
  return (
    <section>
      <h1 style={{ margin: '0 0 6px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 32, color: '#5A7A8C' }}>
        Tips para tus piezas
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 15, color: '#708085', textWrap: 'pretty' }}>
        Para que te duren mucho tiempo como el primer día.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000 }}>
        {TIPS.map((tip) => (
          <div
            key={tip.titulo}
            style={{
              display: 'flex',
              gap: 16,
              background: 'white',
              border: '1px solid #E0E8EB',
              borderRadius: 8,
              padding: 20,
            }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                background: '#E2EAF0',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A7A8C" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d={tip.icono} />
              </svg>
            </span>
            <div>
              <p style={{ margin: '0 0 6px', fontFamily: QUICKSAND, fontWeight: 600, fontSize: 16, color: '#323A3D' }}>
                {tip.titulo}
              </p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#323A3D', textWrap: 'pretty' }}>
                {tip.texto}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
