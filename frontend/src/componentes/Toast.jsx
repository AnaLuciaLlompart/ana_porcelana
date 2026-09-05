const ICONO_TILDE = 'M5 13l4 4L19 7'


export default function Toast({ texto }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '11px 20px',
        borderRadius: 24,
        background: '#E8F5EF',
        border: '1px solid #4E8C6A',
        boxShadow: '0 4px 12px rgba(61,50,56,.12)',
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4E8C6A" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONO_TILDE} />
      </svg>
      <span
        style={{
          fontFamily: "'Quicksand', sans-serif",
          fontWeight: 600,
          fontSize: 15,
          color: '#4E8C6A',
        }}
      >
        {texto}
      </span>
    </div>
  )
}
