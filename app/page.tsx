'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const REFRESH = 10_000

// ─── Formatters ──────────────────────────────────────────────────────────────
function eur(n: number, decimals = 0) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: decimals }).format(n)
}
function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

// ─── Palette ─────────────────────────────────────────────────────────────────
const COLORS = ['#6C63FF', '#22D3A5', '#F59E0B', '#F43F5E', '#38BDF8', '#A78BFA', '#34D399', '#FB923C']

// ─── Tiny components ─────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 16,
      padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{children}</div>
}

function BigNum({ value, color = '#E2E2F0', size = 32 }: { value: string; color?: string; size?: number }) {
  return <div style={{ fontSize: size, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.1 }}>{value}</div>
}

function Sub({ children, color = '#8888AA' }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 12, color, marginTop: 6 }}>{children}</div>
}

function Badge({ text, type }: { text: string; type: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const map = {
    success: { bg: '#22D3A511', border: '#22D3A533', color: '#22D3A5' },
    warning: { bg: '#F59E0B11', border: '#F59E0B33', color: '#F59E0B' },
    danger: { bg: '#F43F5E11', border: '#F43F5E33', color: '#F43F5E' },
    neutral: { bg: '#6C63FF11', border: '#6C63FF33', color: '#6C63FF' },
  }
  const c = map[type]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: '3px 10px' }}>
      {text}
    </span>
  )
}

const tooltipStyle = {
  contentStyle: { background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 10, color: '#E2E2F0', fontSize: 12 },
  itemStyle: { color: '#E2E2F0' },
  labelStyle: { color: '#8888AA' },
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DashData = {
  totalRevenus: number; totalDepenses: number
  revenusMoisCourant: number; revenusMoisDernier: number; depensesMoisCourant: number
  chargesFixesTotales: number; chargesVariablesTotales: number; chargesFixesHebdo: number
  beneficeParMois: { mois: string; label: string; revenus: number; depenses: number; benefice: number }[]
  venteParCat: Record<string, number>; depParCat: Record<string, number>
  margeParCat: Record<string, { ventes: number; depenses: number; marge: number; tauxMarge: number }>
  evolutionJournaliere: { date: string; ca: number }[]
  progressionMois: number | null
  seuilRentabilite: number | null; tauxMargeVariable: number; coutMatierePC: number
  repartitionDepenses: Record<string, number>
  aPayerList: { fournisseur: string; montantHT: number; categorie: string; echeance: string; statut: string; retard: boolean }[]
  totalAPayer: number; currentMonth: string; lastMonth: string
}

// ─── Main component ───────────────────────────────────────────────────────────
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
      if (!objectifInput) setObjectifInput(o.objectif > 0 ? String(o.objectif) : '')
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

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
          <div style={{ color: '#8888AA', fontSize: 14 }}>Chargement des données…</div>
        </div>
      </div>
    )
  }

  const d = data!
  const benefice = d.totalRevenus - d.totalDepenses
  const beneficeMoisCourant = d.revenusMoisCourant - d.depensesMoisCourant
  const progressObj = objectif > 0 ? Math.min(100, (d.revenusMoisCourant / objectif) * 100) : 0
  const resteObj = Math.max(0, objectif - d.revenusMoisCourant)
  const objAtteint = objectif > 0 && d.revenusMoisCourant >= objectif

  const ventesCatData = Object.entries(d.venteParCat).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
  const margeCatData = Object.entries(d.margeParCat).map(([name, v]) => ({ name, marge: v.marge, taux: v.tauxMarge })).filter(x => Math.abs(x.marge) > 0)
  const repartData = Object.entries(d.repartitionDepenses).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', padding: '28px 20px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E2E2F0', letterSpacing: '-0.02em', margin: 0 }}>
              Dashboard Imad
            </h1>
            <div style={{ fontSize: 12, color: '#8888AA', marginTop: 4 }}>
              {d.currentMonth} · données en temps réel
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: error ? '#F43F5E' : '#22D3A5', boxShadow: error ? '0 0 8px #F43F5E' : '0 0 8px #22D3A5' }} />
            <span style={{ fontSize: 12, color: error ? '#F43F5E' : '#22D3A5', fontWeight: 500 }}>
              {error ? 'Erreur' : `Synchro ${lastSync?.toLocaleTimeString('fr-FR')}`}
            </span>
          </div>
        </div>

        {error && (
          <Card style={{ background: '#F43F5E11', border: '1px solid #F43F5E33' }}>
            <span style={{ color: '#F43F5E', fontSize: 13 }}>⚠️ {error}</span>
          </Card>
        )}

        {/* ── Row 1 : KPIs principaux ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Card>
            <Label>💰 Total Revenus</Label>
            <BigNum value={eur(d.totalRevenus)} color="#22D3A5" />
            <Sub>dont {eur(d.revenusMoisCourant)} ce mois</Sub>
          </Card>
          <Card>
            <Label>📉 Total Dépenses</Label>
            <BigNum value={eur(d.totalDepenses)} color="#F43F5E" />
            <Sub>dont {eur(d.depensesMoisCourant)} ce mois</Sub>
          </Card>
          <Card>
            <Label>✨ Bénéfice net</Label>
            <BigNum value={eur(benefice)} color={benefice >= 0 ? '#22D3A5' : '#F43F5E'} />
            <Sub color={beneficeMoisCourant >= 0 ? '#22D3A5' : '#F43F5E'}>
              {eur(beneficeMoisCourant)} ce mois
            </Sub>
          </Card>
          <Card>
            <Label>📦 À payer</Label>
            <BigNum value={eur(d.totalAPayer)} color="#F59E0B" />
            <Sub>{d.aPayerList.filter(x => x.retard).length} facture(s) en retard</Sub>
          </Card>
        </div>

        {/* ── Row 2 : Objectif ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <Label>🎯 Objectif de bénéfice mensuel</Label>
            {objAtteint && <Badge text="✓ Objectif atteint !" type="success" />}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, color: '#8888AA', marginBottom: 8 }}>
                Objectif mensuel ({d.currentMonth})
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888AA', fontSize: 14 }}>€</span>
                  <input
                    value={objectifInput}
                    onChange={e => setObjectifInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveObjectif()}
                    placeholder="Ex: 15000"
                    style={{
                      width: '100%', background: '#0A0A0F', border: '1px solid #1E1E2E',
                      borderRadius: 10, padding: '11px 12px 11px 28px', color: '#E2E2F0',
                      fontSize: 14, fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#6C63FF')}
                    onBlur={e => (e.target.style.borderColor = '#1E1E2E')}
                  />
                </div>
                <button
                  onClick={saveObjectif} disabled={saving}
                  style={{
                    background: savedOk ? '#22D3A5' : '#6C63FF', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.3s',
                  }}
                >
                  {saving ? '…' : savedOk ? '✓ Enregistré' : 'Définir'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Réalisé</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusMoisCourant)}</div>
              </div>
              {objectif > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Reste à faire</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: objAtteint ? '#22D3A5' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
                    {objAtteint ? '✓ Atteint' : eur(resteObj)}
                  </div>
                </div>
              )}
            </div>
          </div>
          {objectif > 0 && (
            <>
              <div style={{ height: 10, background: '#1E1E2E', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  height: '100%', width: `${progressObj}%`, borderRadius: 99, transition: 'width 0.6s ease',
                  background: objAtteint ? 'linear-gradient(90deg,#22D3A5,#6C63FF)' : progressObj > 75 ? 'linear-gradient(90deg,#F59E0B,#6C63FF)' : 'linear-gradient(90deg,#6C63FF,#9C8FFF)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#6C63FF', fontWeight: 600 }}>{progressObj.toFixed(1)}% accompli</span>
                <span style={{ color: '#8888AA' }}>Objectif : {eur(objectif)}</span>
              </div>
            </>
          )}
        </Card>

        {/* ── Row 3 : Bénéfice par mois ── */}
        <Card>
          <Label>📈 Bénéfice HT par mois</Label>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.beneficeParMois} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => eur(v)} />
              <Bar dataKey="revenus" name="Revenus" fill="#6C63FF33" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill="#F43F5E33" radius={[4, 4, 0, 0]} />
              <Bar dataKey="benefice" name="Bénéfice" radius={[4, 4, 0, 0]}>
                {d.beneficeParMois.map((entry, i) => (
                  <Cell key={i} fill={entry.benefice >= 0 ? '#22D3A5' : '#F43F5E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Row 4 : Evolution journalière + Progression mois ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Card>
            <Label>📅 Évolution journalière du CA — {d.currentMonth}</Label>
            {d.evolutionJournaliere.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={d.evolutionJournaliere}>
                  <defs>
                    <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => eur(v)} />
                  <Area type="monotone" dataKey="ca" name="CA HT" stroke="#6C63FF" strokeWidth={2} fill="url(#caGrad)" dot={{ r: 3, fill: '#6C63FF' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4A6A', fontSize: 13 }}>
                Aucune donnée pour ce mois
              </div>
            )}
          </Card>
          <Card>
            <Label>📊 Progression mois vs mois dernier</Label>
            <div style={{ marginBottom: 8, fontSize: 12, color: '#8888AA' }}>{d.lastMonth} → {d.currentMonth}</div>
            {d.progressionMois !== null ? (
              <>
                <BigNum
                  value={pct(d.progressionMois)}
                  color={d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E'}
                  size={40}
                />
                <Sub color={d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E'}>
                  {d.progressionMois >= 0 ? '▲ En hausse' : '▼ En baisse'}
                </Sub>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#8888AA' }}>Mois dernier</span>
                    <span style={{ color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusMoisDernier)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#8888AA' }}>Ce mois</span>
                    <span style={{ color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusMoisCourant)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#8888AA' }}>Différence</span>
                    <span style={{ color: d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>
                      {eur(d.revenusMoisCourant - d.revenusMoisDernier)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas de données le mois dernier</div>
            )}
          </Card>
        </div>

        {/* ── Row 5 : Ventes par catégorie + Marge par catégorie ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <Label>🛒 Ventes totales par catégorie</Label>
            {ventesCatData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={ventesCatData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {ventesCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => eur(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 8 }}>
                  {ventesCatData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#8888AA' }}>{item.name}</span>
                      <span style={{ color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13, paddingTop: 16 }}>Aucune donnée</div>}
          </Card>
          <Card>
            <Label>📐 Marge brute par catégorie</Label>
            {margeCatData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={margeCatData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => name === 'taux' ? `${v.toFixed(1)}%` : eur(v)} />
                  <Bar dataKey="marge" name="Marge €" radius={[0, 4, 4, 0]}>
                    {margeCatData.map((entry, i) => (
                      <Cell key={i} fill={entry.marge >= 0 ? COLORS[i % COLORS.length] : '#F43F5E'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13, paddingTop: 16 }}>Aucune donnée</div>}
          </Card>
        </div>

        {/* ── Row 6 : Seuil rentabilité + Coût matière + Répartition dépenses ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16 }}>
          <Card>
            <Label>⚖️ Seuil de rentabilité</Label>
            {d.seuilRentabilite !== null ? (
              <>
                <BigNum value={eur(d.seuilRentabilite)} color="#F59E0B" />
                <Sub>CA à atteindre pour couvrir les charges</Sub>
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#F59E0B11', border: '1px solid #F59E0B22', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Taux de marge s/ CV</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{d.tauxMargeVariable.toFixed(1)}%</div>
                </div>
              </>
            ) : (
              <div style={{ color: '#4A4A6A', fontSize: 13 }}>Données insuffisantes</div>
            )}
          </Card>
          <Card>
            <Label>🧮 Coût matière %</Label>
            <BigNum
              value={`${d.coutMatierePC.toFixed(1)}%`}
              color={d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5'}
            />
            <Sub color={d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5'}>
              {d.coutMatierePC > 40 ? '⚠️ Attention — trop élevé' : d.coutMatierePC > 30 ? '⚡ À surveiller' : '✓ Bonne maîtrise'}
            </Sub>
            <div style={{ marginTop: 12, fontSize: 12, color: '#8888AA', lineHeight: 1.5 }}>
              Si ce % augmente = perte inhabituelle. Cible : &lt;30%
            </div>
          </Card>
          <Card>
            <Label>🥧 Répartition des dépenses</Label>
            {repartData.length > 0 ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={repartData} cx="50%" cy="50%" outerRadius={65} dataKey="value" paddingAngle={2}>
                      {repartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => eur(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {repartData.sort((a, b) => b.value - a.value).map((item, i) => {
                    const total = repartData.reduce((s, x) => s + x.value, 0)
                    const p = ((item.value / total) * 100).toFixed(0)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#8888AA', flex: 1 }}>{item.name}</span>
                        <span style={{ fontSize: 11, color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{p}%</span>
                        <span style={{ fontSize: 11, color: '#4A4A6A', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée</div>}
          </Card>
        </div>

        {/* ── Row 7 : Tableau d'échéances ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Label>📋 Tableau d'échéances — À payer</Label>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>
              Total : {eur(d.totalAPayer)}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0A0A0F' }}>
                  {['Fournisseur', 'Catégorie', 'Montant HT', 'Échéance', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #1E1E2E', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.aPayerList.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1E1E2E' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1A1A26')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#E2E2F0', fontWeight: 500 }}>{row.fournisseur || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#8888AA' }}>{row.categorie}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{eur(row.montantHT)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: row.retard ? '#F43F5E' : '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{row.echeance}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <Badge
                        text={row.statut.includes('retard') ? '🔴 En retard' : '🟠 À payer'}
                        type={row.retard ? 'danger' : 'warning'}
                      />
                    </td>
                  </tr>
                ))}
                {d.aPayerList.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#4A4A6A', fontSize: 13 }}>Aucune facture en attente ✓</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#4A4A6A', paddingBottom: 8 }}>
          Mise à jour automatique toutes les 10 secondes · ID Sheet : {process.env.NEXT_PUBLIC_SHEET_ID || 'configuré côté serveur'}
        </div>

      </div>
    </div>
  )
}
