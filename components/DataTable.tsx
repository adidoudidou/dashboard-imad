'use client'

type Props = {
  headers: string[]
  data: Record<string, string>[]
}

export default function DataTable({ headers, data }: Props) {
  if (!headers.length) return null

  return (
    <div style={{
      background: '#12121A',
      border: '1px solid #1E1E2E',
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E1E2E' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📋 Données brutes — {data.length} lignes
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0A0A0F' }}>
              {headers.map((h) => (
                <th key={h} style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#8888AA',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid #1E1E2E',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '1px solid #1E1E2E',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1A1A26')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {headers.map((h) => (
                  <td key={h} style={{
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: '#C2C2DA',
                    fontFamily: 'JetBrains Mono, monospace',
                    whiteSpace: 'nowrap',
                  }}>
                    {row[h] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
