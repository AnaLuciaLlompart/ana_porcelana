// El pie de tabla con el selector de filas por página, el contador y las
// dos flechas. Estaba adentro de Materiales.jsx; se movió acá cuando lo
// necesitaron también Productos y Clientes.

// Corta la lista en la página que corresponde.
//
// Devuelve paginaActual y no la pagina que se le pide: si la lista se
// achica porque se filtró, la página pedida puede quedar más allá del
// final, y ahí no se vería ninguna fila. Math.min la trae de vuelta a la
// última que existe.
export function paginar(lista, porPagina, pagina) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * porPagina

  return {
    visibles: lista.slice(desde, desde + porPagina),
    paginaActual,
    totalPaginas,
    desde,
  }
}

// Flechas de anterior y siguiente
function BotonPagina({ onClick, deshabilitado, icono }) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #EBE0E2',
        background: 'white',
        borderRadius: 5,
        cursor: deshabilitado ? 'default' : 'pointer',
        opacity: deshabilitado ? 0.3 : 1,
        color: '#8C5A66',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d={icono} />
      </svg>
    </button>
  )
}

export default function Paginacion({
  total,
  desde,
  porPagina,
  pagina,
  totalPaginas,
  onPorPagina,
  onPagina,
  // La línea de arriba separa el pie del cuerpo de la tabla. En la vista
  // de tarjetas la barra va en su propia caja, que ya tiene borde, y ahí
  // la línea quedaría duplicada.
  borde = true,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 16,
        padding: '12px 20px',
        borderTop: borde ? '1px solid #EBE0E2' : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#857078' }}>Filas por página</span>
        <select
          value={porPagina}
          onChange={(e) => onPorPagina(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            border: '1px solid #EBE0E2',
            borderRadius: 5,
            background: 'white',
            color: '#3D3238',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value={12}>12</option>
          <option value={24}>24</option>
          <option value={48}>48</option>
        </select>
      </div>

      <span style={{ fontSize: 13, color: '#857078' }}>
        {total === 0
          ? '0 de 0'
          : `${desde + 1}–${Math.min(desde + porPagina, total)} de ${total}`}
      </span>

      <div style={{ display: 'flex', gap: 6 }}>
        <BotonPagina
          onClick={() => onPagina(pagina - 1)}
          deshabilitado={pagina <= 1}
          icono="M15 19l-7-7 7-7"
        />
        <BotonPagina
          onClick={() => onPagina(pagina + 1)}
          deshabilitado={pagina >= totalPaginas}
          icono="M9 5l7 7-7 7"
        />
      </div>
    </div>
  )
}
