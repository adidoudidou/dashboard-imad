'use client'

import { useState } from 'react'

type Props = {
  objectif: number
  revenuActuel: number
  onSave: (val: number) => Promise<void>
}

function formatEUR(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function ObjectifWidget({ objectif, revenuActuel, onSave }: Props) {
  const [input, setInput] = useState(objectif > 0 ? String(objectif) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const reste = Math.max(0, objectif - revenuActuel)
  const progress = objectif > 0 ? Math.min(100, (revenuActuel / objectif) * 100) : 0
  const atteint = revenuActuel >= objectif && objectif > 0

  async function handleSave() {
    const val = parseFloat(input.replace(/\s/g, '').replace(',', '.'))
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    await onSave(val)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      background: '#12121A',
      border: '1px solid #1E1E2E',
      borderRadius: '16px',
      padding: '28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          🎯 Objectif de revenu
        </span>
        {atteint && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#22D3A5', background: '#22D3A511', border: '1px solid #22D3A533', borderRadius: '20px', padding: '3px 10px' }}>
            ✓ Objectif atteint !
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: '#8888AA' }}>
            {formatEUR(revenuActuel)} réalisés
          </span>
          <span style={{ fontSize: '13px', color: '#8888AA' }}>
            {formatEUR(objectif)} objectif
          </span>
        </div>
        <div style={{ height: '8px', background: '#1E1E2E', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: '99px',
            background: atteint
              ? 'linear-gradient(90deg, #22D3A5, #6C63FF)'
              : progress > 75
              ? 'linear-gradient(90deg, #F59E0B, #6C63FF)'
              : 'linear-gradient(90deg, #6C63FF, #9C8FFF)',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '12px', color: '#6C63FF', fontWeight: 600 }}>
            {progress.toFixed(1)}% accompli
          </span>
          {!atteint && objectif > 0 && (
            <span style={{ fontSize: '12px', color: '#F59E0B', fontWeight: 600 }}>
              {formatEUR(reste)} restants
            </span>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{
            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
            color: '#8888AA', fontSize: '14px', pointerEvents: 'none',
          }}>€</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Ex : 50000"
            style={{
              width: '100%',
              background: '#0A0A0F',
              border: '1px solid #1E1E2E',
              borderRadius: '10px',
              padding: '12px 14px 12px 28px',
              color: '#E2E2F0',
              fontSize: '14px',
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6C63FF')}
            onBlur={e => (e.target.style.borderColor = '#1E1E2E')}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? '#22D3A5' : '#6C63FF',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.3s',
            whiteSpace: 'nowrap',
          }}
        >
          {saving ? '…' : saved ? '✓ Sauvegardé' : 'Définir'}
        </button>
      </div>
    </div>
  )
}
