import BotonAccion from './BotonAccion'
import {
  ICONO_IMAGEN,
  ICONO_VER,
  ICONO_ALTA,
  ICONO_TIPO,
  ICONO_TEMA,
  CHEVRON_ABAJO,
  CHEVRON_ARRIBA,
  CHEVRON_DERECHA,
  textoMeta,
} from './presentacion'

// La sección colapsable de dados de baja, con sus dos bloques: la baja
// del propio producto y la baja por su categoría, agrupada por categoría.
//
// Recibe todo por props y no llama a la API. Reactivar un producto o una
// categoría se avisa hacia arriba, igual que hacen los modales de
// categorías.

export default function SeccionBajas({
  deBaja,
  grupos,
  abierto,
  onToggle,
  colapsadas,
  onToggleCategoria,
  onVer,
  onReactivarProducto,
  onReactivarCategoria,
}) {
  const cantidadPorCategoria = grupos.reduce((total, g) => total + g.productos.length, 0)

  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
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
          DADOS DE BAJA
        </h2>
        <span style={{ fontSize: 13, color: '#B08791' }}>
          Separados según de dónde viene la baja
        </span>
        <div style={{ flex: 1, height: 1, background: '#EBE0E2' }} />

        <button
          onClick={onToggle}
          className="btn-colapsar-bajas"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            border: '1px solid #EBE0E2',
            background: 'white',
            color: '#8C5A66',
            borderRadius: 5,
            cursor: 'pointer',
            fontFamily: "'Quicksand', sans-serif",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {`${deBaja.length} por el producto · ${cantidadPorCategoria} por su categoría`}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={abierto ? CHEVRON_ARRIBA : CHEVRON_ABAJO}
            />
          </svg>
        </button>
      </div>

      {abierto && (
        <div style={{ background: 'white', border: '1px solid #EBE0E2', borderRadius: 8, overflow: 'hidden' }}>

          {deBaja.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  background: '#FAF7F7',
                  borderBottom: '1px solid #EBE0E2',
                }}
              >
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 4, background: '#C0442F' }} />
                <span
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#857078',
                    letterSpacing: '.06em',
                  }}
                >
                  BAJA DEL PROPIO PRODUCTO
                </span>
                <span style={{ fontSize: 13, color: '#B08791', textWrap: 'pretty' }}>
                  Productos particulares que se dieron de baja
                </span>
              </div>

              {deBaja.map((producto) => (
                <div
                  key={producto.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderBottom: '1px solid #EBE0E2',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 8,
                      background: '#F5F0F1',
                      border: '1px solid #EBE0E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {producto.imagen_principal ? (
                      <img
                        src={producto.imagen_principal}
                        alt={producto.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B08791" strokeWidth="1.6">
                        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_IMAGEN} />
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: '0 0 2px',
                        fontFamily: "'Quicksand', sans-serif",
                        fontWeight: 600,
                        fontSize: 16,
                        color: '#857078',
                      }}
                    >
                      {producto.nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#B08791' }}>{textoMeta(producto)}</p>
                  </div>

                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                      borderRadius: 20,
                      padding: '5px 14px',
                      border: '1px solid #C0442F',
                      background: '#FAEAE8',
                      color: '#C0442F',
                    }}
                  >
                    De baja
                  </span>

                  <BotonAccion
                    onClick={() => onVer(producto)}
                    titulo="Ver"
                    color="#8C5A66"
                    hover="#F0E2E4"
                    icono={ICONO_VER}
                  />

                  <button
                    onClick={() => onReactivarProducto(producto)}
                    title="Volver a activar este producto"
                    className="btn-reactivar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                      padding: '7px 14px',
                      border: '1px solid #4E8C6A',
                      background: 'white',
                      color: '#4E8C6A',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontFamily: "'Quicksand', sans-serif",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALTA} />
                    </svg>
                    Reactivar producto
                  </button>
                </div>
              ))}
            </>
          )}

          {grupos.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  background: '#FAF7F7',
                  borderBottom: '1px solid #EBE0E2',
                }}
              >
                <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 4, background: '#D9A441' }} />
                <span
                  style={{
                    fontFamily: "'Quicksand', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#857078',
                    letterSpacing: '.06em',
                  }}
                >
                  BAJA POR SU CATEGORÍA
                </span>
                <span style={{ fontSize: 13, color: '#B08791', textWrap: 'pretty' }}>
                  Al reactivar la categoría vuelven todos sus productos
                </span>
              </div>

              {grupos.map((grupo) => {
                const colapsado = colapsadas.includes(grupo.categoria.id)

                return (
                  <div key={grupo.categoria.id} style={{ borderBottom: '1px solid #EBE0E2' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 18px',
                        background: '#FDF9F2',
                      }}
                    >
                      <button
                        onClick={() => onToggleCategoria(grupo.categoria.id)}
                        title={colapsado ? 'Ver sus productos' : 'Ocultar sus productos'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          flex: 1,
                          minWidth: 0,
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#B08791"
                          strokeWidth="2.2"
                          style={{ flexShrink: 0 }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={colapsado ? CHEVRON_DERECHA : CHEVRON_ABAJO}
                          />
                        </svg>

                        <div
                          style={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            borderRadius: 8,
                            background: '#FDF3E0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D9A441" strokeWidth="1.8">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={grupo.categoria.tipo === 'TEMATICA' ? ICONO_TEMA : ICONO_TIPO}
                            />
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: "'Quicksand', sans-serif",
                              fontWeight: 600,
                              fontSize: 16,
                              color: '#3D3238',
                            }}
                          >
                            {grupo.categoria.nombre}
                          </p>
                          <p style={{ margin: '1px 0 0', fontSize: 13, color: '#B08791' }}>
                            {`${grupo.categoria.tipo_display} · ${
                              grupo.productos.length === 1
                                ? '1 producto afectado'
                                : `${grupo.productos.length} productos afectados`
                            }`}
                          </p>
                        </div>
                      </button>

                      <span
                        style={{
                          flexShrink: 0,
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                          borderRadius: 20,
                          padding: '5px 14px',
                          border: '1px solid #D9A441',
                          background: '#FDF3E0',
                          color: '#D9A441',
                        }}
                      >
                        Categoría de baja
                      </span>

                      <button
                        onClick={() => onReactivarCategoria(grupo.categoria)}
                        title={`Reactiva “${grupo.categoria.nombre}” y todos sus productos`}
                        className="btn-reactivar"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                          padding: '7px 14px',
                          border: '1px solid #4E8C6A',
                          background: 'white',
                          color: '#4E8C6A',
                          borderRadius: 5,
                          cursor: 'pointer',
                          fontFamily: "'Quicksand', sans-serif",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_ALTA} />
                        </svg>
                        Reactivar categoría
                      </button>
                    </div>

                    {!colapsado &&
                      grupo.productos.map((producto) => (
                        <div
                          key={producto.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '11px 18px 11px 34px',
                            borderTop: '1px solid #F2E9EA',
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              flexShrink: 0,
                              borderLeft: '1px solid #DCC9CD',
                              borderBottom: '1px solid #DCC9CD',
                              borderBottomLeftRadius: 6,
                              marginTop: -10,
                            }}
                          />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 15, color: '#857078' }}>{producto.nombre}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 13, color: '#B08791' }}>
                              {textoMeta(producto)}
                            </p>
                          </div>

                          <BotonAccion
                            onClick={() => onVer(producto)}
                            titulo="Ver producto"
                            color="#8C5A66"
                            hover="#F0E2E4"
                            icono={ICONO_VER}
                            lado={34}
                          />
                        </div>
                      ))}
                  </div>
                )
              })}
            </>
          )}

          {deBaja.length === 0 && grupos.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 15, color: '#857078' }}>
              No hay productos fuera del catálogo por una baja.
            </div>
          )}
        </div>
      )}
    </section>
  )
}
