'use client'

type Props = {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  icon?: string
}

const colorMap = {
  default: { border: '#1E1E2E', glow: 'transparent', value: '#E2E2F0' },
  success: { border: '#22D3A522', glow: '#22D3A511', value: '#22D3A5' },
  warning: { border: '#F59E0B22', glow: '#F59E0B11', value: '#F59E0B' },
  danger: { border: '#F43F5E22', glow: '#F43F5E11', value: '#F43F5E' },
  accent: { border: '#6C63FF33', glow: '#6C63FF11', value: '#6C63FF' },
}

export default function StatCard({ label, value, sub, color = 'default', icon }: Props) {
  const c = colorMap[color]
  return (
    <div
      style={{
        background: `linear-gradient(135deg, #12121A, ${c.glow})`,
        border: `1px solid ${c.border}`,
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: '18px' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: c.value, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: '#8888AA' }}>{sub}</div>
      )}
    </div>
  )
}
