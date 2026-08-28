import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexto/AuthContext'

// Iconos del menú, tomados del diseño (estilo Heroicons outline)
const NAV = [
  { id: 'inicio', label: 'Inicio', ruta: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'materiales', label: 'Materiales', ruta: '/materiales', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { id: 'categorias', label: 'Categorías', ruta: '/categorias', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { id: 'productos', label: 'Productos', ruta: '/productos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { id: 'clientes', label: 'Clientes', ruta: '/clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'pedidos', label: 'Pedidos', ruta: '/pedidos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'gastos', label: 'Gastos', ruta: '/gastos', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'informes', label: 'Informes', ruta: '/informes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

const ICONO_SALIR = 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'

function Item({ icon, label, activo, expandida, onClick, title }) {
  const color = activo ? 'white' : 'rgba(255,255,255,.75)'

  return (
    <button
      onClick={onClick}
      title={title}
      className="nav-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 42,
        padding: '0 10px',
        borderRadius: 6,
        border: 0,
        cursor: 'pointer',
        width: '100%',
        background: activo ? 'rgba(255,255,255,.2)' : 'transparent',
        justifyContent: expandida ? 'flex-start' : 'center',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {expandida && (
        <span style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 15,
          whiteSpace: 'nowrap',
          color,
        }}>
          {label}
        </span>
      )}
    </button>
  )
}

export default function Layout() {
  const [expandida, setExpandida] = useState(false)
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const { salir } = useAuth()

  async function manejarSalir() {
    await salir()
    navegar('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#FAF7F7' }}>

      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        background: '#8C5A66',
        transition: 'width .2s',
        width: expandida ? 210 : 58,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 6px 0', flex: 1 }}>

          <Item
            icon="M4 6h16M4 12h16M4 18h16"
            label="Menú"
            activo={false}
            expandida={expandida}
            onClick={() => setExpandida((v) => !v)}
            title="Menú"
          />

          <div style={{ height: 1, background: 'rgba(255,255,255,.15)', margin: '6px 0' }} />

          {NAV.map((item) => (
            <Item
              key={item.id}
              icon={item.icon}
              label={item.label}
              title={item.label}
              expandida={expandida}
              activo={ubicacion.pathname === item.ruta}
              onClick={() => navegar(item.ruta)}
            />
          ))}
        </div>

        <div style={{ padding: '0 6px 16px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,.15)', marginBottom: 6 }} />
          <Item
            icon={ICONO_SALIR}
            label="Cerrar sesión"
            title="Cerrar sesión"
            activo={false}
            expandida={expandida}
            onClick={manejarSalir}
          />
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}