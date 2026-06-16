'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

const REFRESH = 10_000

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

const COLORS = ['#6C63FF', '#22D3A5', '#F59E0B', '#F43F5E', '#38BDF8', '#A78BFA', '#34D399', '#FB923C']

const TT = {
  contentStyle: { background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 10, color: '#E2E2F0', fontSize: 12 },
  itemStyle: { color: '#E2E2F0' },
  labelStyle: { color: '#8888AA' },
}

// ─── Base components ─────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 16, padding: '20px 16px', ...style }}>
      {children}
    </div>
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{children}</div>
}
function BigNum({ value, color = '#E2E2F0', size = 28 }: { value: string; color?: string; size?: number }) {
  return <div style={{ fontSize: size, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.15, wordBreak: 'break-all' }}>{value}</div>
}
function Sub({ children, color = '#8888AA' }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 12, color, marginTop: 6, lineHeight: 1.4 }}>{children}</div>
}
function Badge({ text, type }: { text: string; type: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const map = {
    success: { bg: '#22D3A511', border: '#22D3A533', color: '#22D3A5' },
    warning: { bg: '#F59E0B11', border: '#F59E0B33', color: '#F59E0B' },
    danger:  { bg: '#F43F5E11', border: '#F43F5E33', color: '#F43F5E' },
    neutral: { bg: '#6C63FF11', border: '#6C63FF33', color: '#6C63FF' },
  }
  const c = map[type]
  return <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{text}</span>
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DashData = {
  totalRevenus: number; totalDepenses: number
  revenusMoisCourant: number; revenusMoisDernier: number; depensesMoisCourant: number
  chargesFixesTotales: number; chargesVariablesTotales: number
  beneficeParMois: { mois: string; label: string; revenus: number; depenses: number; benefice: number }[]
  venteParCat: Record<string, number>
  margeParCat: Record<string, { ventes: number; depenses: number; marge: number; tauxMarge: number }>
  evolutionJournaliere: { date: string; ca: number }[]
  progressionMois: number | null
  seuilRentabilite: number | null; tauxMargeVariable: number; coutMatierePC: number
  repartitionDepenses: Record<string, number>
  aPayerList: { fournisseur: string; montantHT: number; categorie: string; echeance: string; statut: string; retard: boolean }[]
  totalAPayer: number; currentMonth: string; lastMonth: string
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [objectif, setObjectif] = useState(0)
  const [objectifInput, setObjectifInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [dataRes, objRes] = await Promise.all([fetch('/api/data'), fetch('/api/objective')])
      if (!dataRes.ok) throw new Error(await dataRes.text())
      const d = await dataRes.json()
      const o = await objRes.json()
      setData(d)
      setObjectif(o.objectif || 0)
      setObjectifInput(prev => prev || (o.objectif > 0 ? String(o.objectif) : ''))
      setLastSync(new Date())
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, REFRESH)
    return () => clearInterval(t)
  }, [fetchAll])

  async function saveObjectif() {
    const val = parseFloat(objectifInput.replace(/\s/g, '').replace(',', '.'))
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    await fetch('/api/objective', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectif: val }) })
    setObjectif(val)
    setSaving(false); setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2500)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div style={{ color: '#8888AA', fontSize: 14 }}>Chargement…</div>
      </div>
    </div>
  )

  const d = data!
  const benefice = d.totalRevenus - d.totalDepenses
  const beneficeMoisCourant = d.revenusMoisCourant - d.depensesMoisCourant
  const progressObj = objectif > 0 ? Math.min(100, (d.revenusMoisCourant / objectif) * 100) : 0
  const resteObj = Math.max(0, objectif - d.revenusMoisCourant)
  const objAtteint = objectif > 0 && d.revenusMoisCourant >= objectif
  const ventesCatData = Object.entries(d.venteParCat).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
  const margeCatData = Object.entries(d.margeParCat).map(([name, v]) => ({ name, marge: v.marge })).filter(x => Math.abs(x.marge) > 0)
  const repartData = Object.entries(d.repartitionDepenses).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)
  const totalRep = repartData.reduce((s, x) => s + x.value, 0)

  // Responsive grid helper via CSS string injected once
  const css = `
    * { box-sizing: border-box; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid4 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-evo { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .grid3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
    @media(min-width: 640px) {
      .grid4 { grid-template-columns: repeat(4, 1fr); }
      .grid-evo { grid-template-columns: 2fr 1fr; }
      .grid3 { grid-template-columns: 1fr 1fr 2fr; }
    }
    input::placeholder { color: #4A4A6A; }
    input:focus { outline: none; border-color: #6C63FF !important; }
    tr:hover td { background: #1A1A26; }
  `

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', padding: '20px 12px', fontFamily: 'Inter, sans-serif' }}>
      <style>{css}</style>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E2E2F0', margin: 0, letterSpacing: '-0.02em' }}>Dashboard Imad</h1>
            <div style={{ fontSize: 12, color: '#8888AA', marginTop: 3 }}>{d.currentMonth} · temps réel</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: error ? '#F43F5E' : '#22D3A5', boxShadow: `0 0 6px ${error ? '#F43F5E' : '#22D3A5'}` }} />
            <span style={{ fontSize: 11, color: error ? '#F43F5E' : '#22D3A5', fontWeight: 500 }}>
              {error ? 'Erreur' : lastSync?.toLocaleTimeString('fr-FR')}
            </span>
          </div>
        </div>

        {error && (
          <Card style={{ background: '#F43F5E0A', border: '1px solid #F43F5E33' }}>
            <span style={{ color: '#F43F5E', fontSize: 13 }}>⚠️ {error}</span>
          </Card>
        )}

        {/* ── KPIs ── */}
        <div className="grid4">
          <Card>
            <Label>💰 Revenus</Label>
            <BigNum value={eur(d.totalRevenus)} color="#22D3A5" />
            <Sub>{eur(d.revenusMoisCourant)} ce mois</Sub>
          </Card>
          <Card>
            <Label>📉 Dépenses</Label>
            <BigNum value={eur(d.totalDepenses)} color="#F43F5E" />
            <Sub>{eur(d.depensesMoisCourant)} ce mois</Sub>
          </Card>
          <Card>
            <Label>✨ Bénéfice</Label>
            <BigNum value={eur(benefice)} color={benefice >= 0 ? '#22D3A5' : '#F43F5E'} />
            <Sub color={beneficeMoisCourant >= 0 ? '#22D3A5' : '#F43F5E'}>{eur(beneficeMoisCourant)} ce mois</Sub>
          </Card>
          <Card>
            <Label>📦 À payer</Label>
            <BigNum value={eur(d.totalAPayer)} color="#F59E0B" />
            <Sub>{d.aPayerList.filter(x => x.retard).length} en retard</Sub>
          </Card>
        </div>

        {/* ── Objectif ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <Label>🎯 Objectif de bénéfice — {d.currentMonth}</Label>
            {objAtteint && <Badge text="✓ Atteint !" type="success" />}
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888AA', fontSize: 14, pointerEvents: 'none' }}>€</span>
              <input
                value={objectifInput}
                onChange={e => setObjectifInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveObjectif()}
                placeholder="Ex: 15000"
                style={{ width: '100%', background: '#0A0A0F', border: '1px solid #1E1E2E', borderRadius: 10, padding: '12px 12px 12px 28px', color: '#E2E2F0', fontSize: 15, fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
            <button
              onClick={saveObjectif} disabled={saving}
              style={{ background: savedOk ? '#22D3A5' : '#6C63FF', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', minWidth: 90, transition: 'background 0.3s' }}
            >
              {saving ? '…' : savedOk ? '✓ OK' : 'Définir'}
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 3 }}>Réalisé</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusMoisCourant)}</div>
            </div>
            {objectif > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 3 }}>Reste à faire</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: objAtteint ? '#22D3A5' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{objAtteint ? '✓ Atteint' : eur(resteObj)}</div>
              </div>
            )}
          </div>

          {objectif > 0 && (
            <>
              <div style={{ height: 8, background: '#1E1E2E', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${progressObj}%`, borderRadius: 99, background: objAtteint ? 'linear-gradient(90deg,#22D3A5,#6C63FF)' : 'linear-gradient(90deg,#6C63FF,#9C8FFF)', transition: 'width 0.6s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6C63FF', fontWeight: 600 }}>{progressObj.toFixed(1)}% accompli</span>
                <span style={{ color: '#8888AA' }}>/ {eur(objectif)}</span>
              </div>
            </>
          )}
        </Card>

        {/* ── Bénéfice par mois ── */}
        <Card>
          <Label>📈 Bénéfice HT par mois</Label>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.beneficeParMois} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...TT} formatter={(v: number) => eur(v)} />
              <Bar dataKey="revenus" name="Revenus" fill="#6C63FF22" radius={[3, 3, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill="#F43F5E22" radius={[3, 3, 0, 0]} />
              <Bar dataKey="benefice" name="Bénéfice" radius={[3, 3, 0, 0]}>
                {d.beneficeParMois.map((e, i) => <Cell key={i} fill={e.benefice >= 0 ? '#22D3A5' : '#F43F5E'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Evolution + Progression ── */}
        <div className="grid-evo">
          <Card>
            <Label>📅 Évolution journalière — {d.currentMonth}</Label>
            {d.evolutionJournaliere.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={d.evolutionJournaliere}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8888AA' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip {...TT} formatter={(v: number) => eur(v)} />
                  <Area type="monotone" dataKey="ca" name="CA HT" stroke="#6C63FF" strokeWidth={2} fill="url(#g1)" dot={{ r: 3, fill: '#6C63FF' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4A6A', fontSize: 13 }}>Aucune donnée ce mois</div>
            )}
          </Card>
          <Card>
            <Label>📊 Progression vs mois dernier</Label>
            <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 10 }}>{d.lastMonth} → {d.currentMonth}</div>
            {d.progressionMois !== null ? (
              <>
                <BigNum value={pct(d.progressionMois)} color={d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E'} size={34} />
                <Sub color={d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E'}>{d.progressionMois >= 0 ? '▲ En hausse' : '▼ En baisse'}</Sub>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #1E1E2E', paddingTop: 14 }}>
                  {[
                    { label: 'Mois dernier', val: eur(d.revenusMoisDernier), color: '#E2E2F0' },
                    { label: 'Ce mois', val: eur(d.revenusMoisCourant), color: '#E2E2F0' },
                    { label: 'Différence', val: eur(d.revenusMoisCourant - d.revenusMoisDernier), color: d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#8888AA' }}>{r.label}</span>
                      <span style={{ color: r.color, fontFamily: 'JetBrains Mono, monospace' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas de données le mois dernier</div>}
          </Card>
        </div>

        {/* ── Ventes + Marge ── */}
        <div className="grid2">
          <Card>
            <Label>🛒 Ventes par catégorie</Label>
            {ventesCatData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={ventesCatData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {ventesCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={(v: number) => eur(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                  {ventesCatData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#8888AA', flex: 1 }}>{item.name}</span>
                      <span style={{ color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée</div>}
          </Card>
          <Card>
            <Label>📐 Marge par catégorie</Label>
            {margeCatData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={margeCatData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip {...TT} formatter={(v: number) => eur(v)} />
                  <Bar dataKey="marge" name="Marge €" radius={[0, 4, 4, 0]}>
                    {margeCatData.map((e, i) => <Cell key={i} fill={e.marge >= 0 ? COLORS[i % COLORS.length] : '#F43F5E'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée</div>}
          </Card>
        </div>

        {/* ── Seuil + Coût matière ── */}
        <div className="grid2">
          <Card>
            <Label>⚖️ Seuil de rentabilité</Label>
            {d.seuilRentabilite !== null ? (
              <>
                <BigNum value={eur(d.seuilRentabilite)} color="#F59E0B" />
                <Sub>CA min pour couvrir les charges</Sub>
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#F59E0B0A', border: '1px solid #F59E0B22', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#8888AA', marginBottom: 3 }}>Taux marge / CV</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{d.tauxMargeVariable.toFixed(1)}%</div>
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Données insuffisantes</div>}
          </Card>
          <Card>
            <Label>🧮 Coût matière %</Label>
            <BigNum value={`${d.coutMatierePC.toFixed(1)}%`} color={d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5'} />
            <Sub color={d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5'}>
              {d.coutMatierePC > 40 ? '⚠️ Trop élevé' : d.coutMatierePC > 30 ? '⚡ À surveiller' : '✓ Maîtrisé'}
            </Sub>
            <div style={{ marginTop: 12, fontSize: 12, color: '#4A4A6A', lineHeight: 1.5 }}>Cible recommandée : &lt;30%</div>
          </Card>
        </div>

        {/* ── Répartition dépenses ── */}
        <Card>
          <Label>🥧 Répartition des dépenses</Label>
          {repartData.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={repartData} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                      {repartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={(v: number) => eur(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 160 }}>
                {repartData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#8888AA', flex: 1 }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: '#6C63FF', fontFamily: 'JetBrains Mono, monospace' }}>{((item.value / totalRep) * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 11, color: '#4A4A6A', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée</div>}
        </Card>

        {/* ── Tableau d'échéances ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <Label>📋 Tableau d'échéances</Label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>Total : {eur(d.totalAPayer)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.aPayerList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4A4A6A', fontSize: 13 }}>Aucune facture en attente ✓</div>
            ) : d.aPayerList.map((row, i) => (
              <div key={i} style={{ background: '#0A0A0F', border: `1px solid ${row.retard ? '#F43F5E33' : '#1E1E2E'}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E2F0' }}>{row.fournisseur || '—'}</div>
                    <div style={{ fontSize: 11, color: '#8888AA', marginTop: 2 }}>{row.categorie}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{eur(row.montantHT)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: row.retard ? '#F43F5E' : '#8888AA', fontFamily: 'JetBrains Mono, monospace' }}>📅 {row.echeance}</span>
                  <Badge text={row.retard ? '🔴 En retard' : '🟠 À payer'} type={row.retard ? 'danger' : 'warning'} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#4A4A6A', paddingBottom: 8 }}>
          Synchro automatique toutes les 10 secondes
        </div>

      </div>
    </div>
  )
}
