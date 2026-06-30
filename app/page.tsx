'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'

const REFRESH = 10_000

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function pct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }

const COLORS = ['#6C63FF', '#22D3A5', '#F59E0B', '#F43F5E', '#38BDF8', '#A78BFA', '#34D399', '#FB923C']

const TT = {
  contentStyle: { background: '#1A1A2E', border: '1px solid #2E2E4E', borderRadius: 12, color: '#E2E2F0', fontSize: 13, padding: '10px 14px' },
  itemStyle: { color: '#E2E2F0' },
  labelStyle: { color: '#8888AA', marginBottom: 4 },
  cursor: { fill: '#6C63FF11' },
}

type DashData = {
  totalRevenus: number; totalDepenses: number
  revenusMoisCourant: number; revenusMoisDernier: number; depensesMoisCourant: number; depensesMoisCourantTTC: number
  revenusSemaine: number; depensesSemaine: number; depensesSemaineTTC: number
  tvaCollecteeMois: number; tvaDeductibleMois: number; tvaAReverser: number
  chargesFixesTotales: number; chargesVariablesTotales: number; chargesFixesMoisCourant: number; chargesVariablesMoisCourant: number
  chargesFixesHebdo: number; chargesVariablesHebdo: number; chargesHebdo: number; chargesMois: number
  achatsMarchandisesHebdo: number; achatsMarchandisesMois: number
  beneficeParMois: { mois: string; label: string; revenus: number; depenses: number; benefice: number }[]
  venteParCat: Record<string, number>
  venteParCatMoisCourant: Record<string, number>
  margeParCat: Record<string, { ventes: number; depenses: number; marge: number; tauxMarge: number }>
  evolutionJournaliere: { date: string; ca: number }[]
  progressionMois: number | null
  seuilRentabilite: number | null; tauxMargeVariable: number; coutMatierePC: number; margeNegative: boolean; margeBruteMois: number
  repartitionDepenses: Record<string, number>
  aPayerList: { id: string; fournisseur: string; montantTTC: number; categorie: string; echeance: string; statut: string; retard: boolean }[]
  totalAPayer: number; currentMonth: string; lastMonth: string
  caAnnee: number; depensesAnneeTotal: number; beneficeAnnee: number
  beneficeParMoisAnnee: { mois: string; label: string; revenus: number; depenses: number; benefice: number }[]
  meilleurMois: { label: string; benefice: number; revenus: number } | null
  pireMois: { label: string; benefice: number; revenus: number } | null
  currentYear: number
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#12121A', border: '1px solid #1E1E2E', borderRadius: 18, padding: '20px 18px', ...style }}>{children}</div>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{children}</div>
}
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8888AA', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 'clamp(15px, 5.5vw, 24px)', fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#8888AA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </Card>
  )
}
function Badge({ text, type }: { text: string; type: 'success' | 'warning' | 'danger' }) {
  const c = { success: ['#22D3A511','#22D3A533','#22D3A5'], warning: ['#F59E0B11','#F59E0B33','#F59E0B'], danger: ['#F43F5E11','#F43F5E33','#F43F5E'] }[type]
  return <span style={{ fontSize: 11, fontWeight: 600, color: c[2], background: c[0], border: `1px solid ${c[1]}`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{text}</span>
}

const TABS = [
  { id: 'overview', label: '🏠', title: 'Aperçu' },
  { id: 'revenus', label: '📈', title: 'Revenus' },
  { id: 'depenses', label: '📉', title: 'Dépenses' },
  { id: 'marges', label: '📐', title: 'Marges' },
  { id: 'apayer', label: '📋', title: 'À payer' },
  { id: 'annuel', label: '📆', title: 'Annuel' },
]

export default function Dashboard() {
  const [data, setData] = useState<DashData | null>(null)
  const [objectif, setObjectif] = useState(0)
  const [objectifInput, setObjectifInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set())
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const fetchAll = useCallback(async () => {
    try {
      const [dr, or] = await Promise.all([fetch('/api/data'), fetch('/api/objective')])
      if (!dr.ok) throw new Error(await dr.text())
      const d = await dr.json()
      const o = await or.json()
      setData(d)
      setObjectif(o.objectif || 0)
      setObjectifInput(prev => prev || (o.objectif > 0 ? String(o.objectif) : ''))
      setLastSync(new Date())
      setError(null)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, REFRESH); return () => clearInterval(t) }, [fetchAll])

  async function markAsPaid(id: string) {
    setPayingId(id)
    try {
      await fetch('/api/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setPaidIds(prev => { const s = new Set(Array.from(prev)); s.add(id); return s })
      setTimeout(() => fetchAll(), 1500)
    } finally {
      setPayingId(null)
    }
  }

  async function saveObjectif() {
    const val = parseFloat(objectifInput.replace(/\s/g, '').replace(',', '.'))
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    await fetch('/api/objective', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectif: val }) })
    setObjectif(val); setSaving(false); setSavedOk(true)
    setTimeout(() => setSavedOk(false), 2500)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ color: '#8888AA', fontSize: 14 }}>Chargement…</div>
      </div>
    </div>
  )

  const d = data!
  const benefice = d.totalRevenus - d.totalDepenses
  const beneficeMois = d.revenusMoisCourant - d.depensesMoisCourant

  // Objectif net : ce qu'Imad veut dans la poche
  // Marge à générer = objectif net + charges fixes/variables (qui s'appliquent au-dessus)
  const objectifNetMois = objectif
  const objectifNetHebdo = objectif > 0 ? objectif / 4.33 : 0
  const margeAGenererMois = objectifNetMois + d.chargesMois + d.achatsMarchandisesMois
  const margeAGenererHebdo = objectifNetHebdo + d.chargesHebdo + d.achatsMarchandisesHebdo
  // Marge brute réalisée = CA - achats marchandises (hors charges fixes/var)
  const margeBruteRealisee = d.revenusMoisCourant - d.depensesMoisCourant - (d.chargesFixesMoisCourant)
  const margeBruteRealiseeHebdo = d.revenusSemaine - d.depensesSemaine - (d.chargesHebdo)
  const resteNetMois = Math.max(0, margeAGenererMois - d.revenusMoisCourant)
  const resteNetHebdo = Math.max(0, margeAGenererHebdo - d.revenusSemaine)
  const progressMois = margeAGenererMois > 0 ? Math.min(100, (d.revenusMoisCourant / margeAGenererMois) * 100) : 0
  const progressHebdo = margeAGenererHebdo > 0 ? Math.min(100, (d.revenusSemaine / margeAGenererHebdo) * 100) : 0

  const progressObj = objectif > 0 ? Math.min(100, (d.revenusMoisCourant / objectif) * 100) : 0
  const resteObj = Math.max(0, objectif - d.revenusMoisCourant)
  const objAtteint = objectif > 0 && d.revenusMoisCourant >= objectif
  const ventesCatData = Object.entries(d.venteParCatMoisCourant).map(([name, value]) => ({ name, value })).filter(x => x.value > 0)
  const margeCatData = Object.entries(d.margeParCat).map(([name, v]) => ({ name, marge: Math.round(v.marge), taux: Math.round(v.tauxMarge) })).filter(x => Math.abs(x.marge) > 0)
  const repartData = Object.entries(d.repartitionDepenses).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)
  const totalRep = repartData.reduce((s, x) => s + x.value, 0)
  // Simplified benefice chart — one bar per month, colored
  const beneficeData = d.beneficeParMois.map(m => ({
    label: m.label.replace(' 20', "'20"),
    benefice: Math.round(m.benefice),
    fill: m.benefice >= 0 ? '#22D3A5' : '#F43F5E',
  }))

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0A0A0F; }
    .tab-bar { display: flex; background: #12121A; border-top: 1px solid #1E1E2E; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; padding-bottom: env(safe-area-inset-bottom); }
    .tab-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 10px 4px; border: none; background: transparent; cursor: pointer; transition: background 0.15s; }
    .tab-btn:hover { background: #1E1E2E; }
    .tab-btn.active { background: #6C63FF11; }
    .tab-emoji { font-size: 20px; }
    .tab-label { font-size: 9px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    input:focus { outline: none; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; min-width: 0; }
    .grid2 > * { min-width: 0; }
    @media(min-width:600px) { .grid2 { gap: 16px; } }
    @media(min-width:520px) { .objectif-grid { grid-template-columns: 1fr 1fr !important; } }
  `

  const activeTab = TABS.find(t => t.id === tab)!

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <style>{css}</style>

      {/* ── Top bar ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#0A0A0FEE', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1E1E2E', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#E2E2F0' }}>Dashboard Imad</div>
          <div style={{ fontSize: 11, color: '#8888AA', marginTop: 1 }}>{activeTab.title} · {d.currentMonth}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: error ? '#F43F5E' : '#22D3A5', boxShadow: `0 0 6px ${error ? '#F43F5E' : '#22D3A5'}` }} />
          <span style={{ fontSize: 11, color: error ? '#F43F5E' : '#22D3A5', fontWeight: 500 }}>
            {error ? 'Erreur' : lastSync?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 14px', maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ══════════ APERÇU ══════════ */}
        {tab === 'overview' && <>
          {/* KPIs 2x2 */}
          <div className="grid2">
            <KpiCard label="Revenus (HT)" value={eur(d.revenusMoisCourant)} sub={`${eur(d.revenusSemaine)} cette semaine`} color="#22D3A5" icon="💰" />
            <KpiCard label="Dépenses (HT)" value={eur(d.depensesMoisCourant)} sub={`TTC réel : ${eur(d.depensesMoisCourantTTC)}`} color="#F43F5E" icon="📉" />
            <KpiCard label="Bénéfice (HT)" value={eur(beneficeMois)} sub={`${eur(d.revenusSemaine - d.depensesSemaine)} cette semaine`} color={beneficeMois >= 0 ? '#22D3A5' : '#F43F5E'} icon="✨" />
            <KpiCard label="À payer" value={eur(d.totalAPayer)} sub={`${d.aPayerList.filter(x => x.retard).length} en retard`} color="#F59E0B" icon="📦" />
          </div>

          {/* Objectif net */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>🎯 Objectif net "dans la poche"</SectionTitle>
              {objectif > 0 && d.revenusMoisCourant >= margeAGenererMois && <Badge text="✓ Atteint !" type="success" />}
            </div>

            {/* Saisie */}
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 8 }}>Ce que tu veux gagner ce mois (net, après charges)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8888AA', fontSize: 15, pointerEvents: 'none' }}>€</span>
                <input
                  value={objectifInput} onChange={e => setObjectifInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveObjectif()} placeholder="Ex: 4000"
                  style={{ width: '100%', background: '#0A0A0F', border: '1px solid #1E1E2E', borderRadius: 12, padding: '13px 12px 13px 30px', color: '#E2E2F0', fontSize: 15, fontFamily: 'JetBrains Mono, monospace', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#6C63FF'}
                  onBlur={e => e.target.style.borderColor = '#1E1E2E'}
                />
              </div>
              <button onClick={saveObjectif} disabled={saving} style={{ background: savedOk ? '#22D3A5' : '#6C63FF', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.3s' }}>
                {saving ? '…' : savedOk ? '✓' : 'Définir'}
              </button>
            </div>

            {objectif > 0 ? (
              <>
                {/* Tableau semaine + mois */}
                <div className="objectif-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 20 }}>
                  {/* Semaine */}
                  <div style={{ background: '#0A0A0F', borderRadius: 12, padding: '14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6C63FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Cette semaine</div>
                    {[
                      { label: 'Objectif net', val: eur(objectifNetHebdo), color: '#E2E2F0' },
                      { label: 'Charges fixes/var.', val: eur(d.chargesHebdo), color: '#8888AA' },
                      { label: 'Achats marchands.', val: eur(d.achatsMarchandisesHebdo), color: '#8888AA' },
                      { label: 'CA à réaliser', val: eur(margeAGenererHebdo), color: '#6C63FF', bold: true },
                      { label: 'Réalisé', val: eur(d.revenusSemaine), color: '#22D3A5' },
                      { label: 'Reste à faire', val: resteNetHebdo > 0 ? eur(resteNetHebdo) : '✓ OK', color: resteNetHebdo > 0 ? '#F59E0B' : '#22D3A5', bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: '#8888AA' }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: r.bold ? 700 : 500, color: r.color, fontFamily: 'JetBrains Mono, monospace' }}>{r.val}</span>
                      </div>
                    ))}
                    {/* Progress semaine */}
                    <div style={{ height: 6, background: '#1E1E2E', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                      <div style={{ height: '100%', width: `${progressHebdo}%`, borderRadius: 99, background: 'linear-gradient(90deg,#6C63FF,#9C8FFF)', transition: 'width 0.8s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#6C63FF', fontWeight: 600, marginTop: 4 }}>{progressHebdo.toFixed(0)}%</div>
                  </div>

                  {/* Mois */}
                  <div style={{ background: '#0A0A0F', borderRadius: 12, padding: '14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22D3A5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{d.currentMonth}</div>
                    {[
                      { label: 'Objectif net', val: eur(objectifNetMois), color: '#E2E2F0' },
                      { label: 'Charges fixes/var.', val: eur(d.chargesMois), color: '#8888AA' },
                      { label: 'Achats marchands.', val: eur(d.achatsMarchandisesMois), color: '#8888AA' },
                      { label: 'CA à réaliser', val: eur(margeAGenererMois), color: '#22D3A5', bold: true },
                      { label: 'Réalisé', val: eur(d.revenusMoisCourant), color: '#22D3A5' },
                      { label: 'Reste à faire', val: resteNetMois > 0 ? eur(resteNetMois) : '✓ Atteint', color: resteNetMois > 0 ? '#F59E0B' : '#22D3A5', bold: true },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: '#8888AA' }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: r.bold ? 700 : 500, color: r.color, fontFamily: 'JetBrains Mono, monospace' }}>{r.val}</span>
                      </div>
                    ))}
                    {/* Progress mois */}
                    <div style={{ height: 6, background: '#1E1E2E', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                      <div style={{ height: '100%', width: `${progressMois}%`, borderRadius: 99, background: 'linear-gradient(90deg,#22D3A5,#6C63FF)', transition: 'width 0.8s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#22D3A5', fontWeight: 600, marginTop: 4 }}>{progressMois.toFixed(0)}%</div>
                  </div>
                </div>

                {/* Note indicative pour la semaine */}
                <div style={{ fontSize: 11, color: '#4A4A6A', fontStyle: 'italic', textAlign: 'center' }}>
                  * Les chiffres de la semaine sont indicatifs — ils peuvent varier selon le timing des achats de stock
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4A4A6A', fontSize: 13 }}>
                Définis un objectif net pour voir le détail semaine + mois
              </div>
            )}
          </Card>

          {/* Progression mois */}
          <Card>
            <SectionTitle>📊 Progression vs mois dernier</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 14 }}>{d.lastMonth} → {d.currentMonth}</div>
            {d.progressionMois !== null ? (
              <>
                <div style={{ fontSize: 'clamp(28px, 9vw, 42px)', fontWeight: 800, color: d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
                  {pct(d.progressionMois)}
                </div>
                <div style={{ fontSize: 13, color: d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E', marginBottom: 20 }}>{d.progressionMois >= 0 ? '▲ En hausse' : '▼ En baisse'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #1E1E2E', paddingTop: 16 }}>
                  {[
                    { label: d.lastMonth, val: eur(d.revenusMoisDernier) },
                    { label: d.currentMonth, val: eur(d.revenusMoisCourant) },
                    { label: 'Différence', val: eur(d.revenusMoisCourant - d.revenusMoisDernier), color: d.progressionMois >= 0 ? '#22D3A5' : '#F43F5E' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#8888AA' }}>{r.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: r.color || '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas de données le mois dernier</div>}
          </Card>

          {/* TVA à reverser */}
          <Card>
            <SectionTitle>🧾 TVA à reverser — {d.currentMonth}</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>TVA collectée moins TVA déductible</div>
            <div style={{ fontSize: 'clamp(24px, 7vw, 36px)', fontWeight: 800, color: d.tvaAReverser >= 0 ? '#F59E0B' : '#22D3A5', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
              {eur(d.tvaAReverser)}
            </div>
            <div style={{ fontSize: 13, color: '#8888AA', marginBottom: 20 }}>
              {d.tvaAReverser >= 0 ? 'à reverser à l\'État' : 'crédit de TVA (en votre faveur)'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0A0A0F', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: '#8888AA' }}>TVA collectée (ventes)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.tvaCollecteeMois)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0A0A0F', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: '#8888AA' }}>TVA déductible (achats)</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.tvaDeductibleMois)}</span>
              </div>
            </div>
          </Card>
        </>}

        {/* ══════════ REVENUS ══════════ */}
        {tab === 'revenus' && <>
          <div className="grid2">
            <Card>
              <SectionTitle>💰 Revenus (HT)</SectionTitle>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Cette semaine</div>
                <div style={{ fontSize: 'clamp(16px, 5vw, 22px)', fontWeight: 700, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusSemaine)}</div>
              </div>
              <div style={{ borderTop: '1px solid #1E1E2E', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>{d.currentMonth}</div>
                <div style={{ fontSize: 'clamp(16px, 5vw, 22px)', fontWeight: 700, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.revenusMoisCourant)}</div>
              </div>
            </Card>
            <Card>
              <SectionTitle>🧾 TVA collectée</SectionTitle>
              <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 14 }}>{d.currentMonth}</div>
              <div style={{ fontSize: 'clamp(19px, 6vw, 28px)', fontWeight: 800, color: '#6C63FF', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.tvaCollecteeMois)}</div>
              <div style={{ fontSize: 12, color: '#8888AA', marginTop: 10, lineHeight: 1.4 }}>collectée sur les ventes, à reverser (déduction faite de la TVA sur achats)</div>
            </Card>
          </div>

          {/* Bénéfice par mois — une seule barre colorée */}
          <Card>
            <SectionTitle>📈 Bénéfice net par mois</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>Vert = bénéfice · Rouge = déficit</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={beneficeData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="30%">
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k€`} />
                <Tooltip {...TT} formatter={(v: number) => [eur(v), 'Bénéfice']} />
                <Bar dataKey="benefice" radius={[6, 6, 2, 2]} maxBarSize={48}>
                  {beneficeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Evolution journalière */}
          <Card>
            <SectionTitle>📅 CA jour par jour — {d.currentMonth}</SectionTitle>
            {d.evolutionJournaliere.length > 0 ? (
              <>
                <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>Chiffre d'affaires HT de chaque journée</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={d.evolutionJournaliere} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#8888AA' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}€`} />
                    <Tooltip {...TT} formatter={(v: number) => [eur(v), 'CA HT']} />
                    <Area type="monotone" dataKey="ca" stroke="#6C63FF" strokeWidth={2.5} fill="url(#caGrad)" dot={{ r: 5, fill: '#6C63FF', strokeWidth: 0 }} activeDot={{ r: 7, fill: '#9C8FFF' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4A6A', fontSize: 14 }}>Aucun ticket Z ce mois</div>
            )}
          </Card>

          {/* Ventes par catégorie */}
          <Card>
            <SectionTitle>🛒 Ventes par catégorie — {d.currentMonth}</SectionTitle>
            {ventesCatData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ventesCatData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                      {ventesCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={(v: number) => [eur(v), 'Ventes']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {ventesCatData.sort((a, b) => b.value - a.value).map((item, i) => {
                    const total = ventesCatData.reduce((s, x) => s + x.value, 0)
                    const p = ((item.value / total) * 100).toFixed(0)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#C2C2DA', flex: 1 }}>{item.name}</span>
                        <span style={{ fontSize: 12, color: '#8888AA' }}>{p}%</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée</div>}
          </Card>
        </>}

        {/* ══════════ DÉPENSES ══════════ */}
        {tab === 'depenses' && <>
          <div className="grid2">
            <Card>
              <SectionTitle>📉 Dépenses (HT)</SectionTitle>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Cette semaine</div>
                <div style={{ fontSize: 'clamp(16px, 5vw, 22px)', fontWeight: 700, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.depensesSemaine)}</div>
              </div>
              <div style={{ borderTop: '1px solid #1E1E2E', paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>{d.currentMonth}</div>
                <div style={{ fontSize: 'clamp(16px, 5vw, 22px)', fontWeight: 700, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.depensesMoisCourant)}</div>
              </div>
            </Card>
            <Card>
              <SectionTitle>🧾 TVA déductible</SectionTitle>
              <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 14 }}>{d.currentMonth}</div>
              <div style={{ fontSize: 'clamp(19px, 6vw, 28px)', fontWeight: 800, color: '#6C63FF', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.tvaDeductibleMois)}</div>
              <div style={{ borderTop: '1px solid #1E1E2E', marginTop: 14, paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>Total réel à sortir (HT + TVA)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.depensesMoisCourantTTC)}</div>
              </div>
            </Card>
          </div>

          {/* Répartition */}
          <Card>
            <SectionTitle>🥧 Répartition des dépenses — {d.currentMonth}</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>Toutes catégories confondues, mois en cours</div>
            {repartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={repartData} cx="50%" cy="50%" outerRadius={95} dataKey="value" paddingAngle={2}>
                      {repartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TT} formatter={(v: number) => [eur(v), 'Dépenses']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {repartData.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#C2C2DA', flex: 1 }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: '#8888AA' }}>{((item.value / totalRep) * 100).toFixed(0)}%</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{eur(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée ce mois</div>}
          </Card>

          {/* Coût matière */}
          <Card>
            <SectionTitle>🧮 Coût matière % — {d.currentMonth}</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>Part des achats fournisseurs dans le CA du mois</div>
            <div style={{ fontSize: 'clamp(32px, 10vw, 52px)', fontWeight: 800, color: d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
              {d.coutMatierePC.toFixed(1)}%
            </div>
            <div style={{ fontSize: 13, color: d.coutMatierePC > 40 ? '#F43F5E' : d.coutMatierePC > 30 ? '#F59E0B' : '#22D3A5', marginBottom: 20, fontWeight: 600 }}>
              {d.coutMatierePC > 40 ? '⚠️ Trop élevé — à surveiller de près' : d.coutMatierePC > 30 ? '⚡ À surveiller' : '✓ Bien maîtrisé'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[{ label: 'Cible recommandée', val: '< 30%', color: '#22D3A5' }, { label: 'Zone de vigilance', val: '30% – 40%', color: '#F59E0B' }, { label: 'Zone critique', val: '> 40%', color: '#F43F5E' }].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0A0A0F', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, color: '#8888AA' }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.val}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Seuil rentabilité */}
          <Card>
            <SectionTitle>⚖️ Seuil de rentabilité — {d.currentMonth}</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>CA minimum du mois pour couvrir toutes les charges</div>
            {d.seuilRentabilite !== null ? (
              <>
                <div style={{ fontSize: 'clamp(24px, 7vw, 36px)', fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>{eur(d.seuilRentabilite)}</div>
                <div style={{ fontSize: 13, color: '#8888AA', marginBottom: 20 }}>à réaliser pour être à l'équilibre</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Charges fixes du mois', val: eur(d.chargesFixesMoisCourant) },
                    { label: 'Taux marge / coût variable', val: `${d.tauxMargeVariable.toFixed(1)}%` },
                    { label: 'CA du mois', val: eur(d.revenusMoisCourant), color: d.revenusMoisCourant >= d.seuilRentabilite ? '#22D3A5' : '#F43F5E' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0A0A0F', borderRadius: 10 }}>
                      <span style={{ fontSize: 12, color: '#8888AA' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: r.color || '#E2E2F0', fontFamily: 'JetBrains Mono, monospace' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : d.margeNegative ? (
              <div style={{ background: '#F43F5E0A', border: '1px solid #F43F5E33', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F43F5E', marginBottom: 8 }}>⚠️ Marge brute négative ce mois</div>
                <div style={{ fontSize: 12, color: '#8888AA', lineHeight: 1.6, marginBottom: 12 }}>
                  Le coût des achats fournisseurs ({eur(d.coutMatierePC > 0 ? (d.revenusMoisCourant * d.coutMatierePC / 100) : 0)}) dépasse déjà le CA du mois ({eur(d.revenusMoisCourant)}), avant même de compter les charges fixes. Aucun seuil de rentabilité n'est atteignable tant que cette situation persiste — chaque vente coûte plus cher qu'elle ne rapporte.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#0A0A0F', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, color: '#8888AA' }}>Marge brute du mois</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.margeBruteMois)}</span>
                </div>
              </div>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas encore de données ce mois</div>}
          </Card>
        </>}

        {/* ══════════ MARGES ══════════ */}
        {tab === 'marges' && <>
          <Card>
            <SectionTitle>📐 Marge brute par catégorie</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>Ventes − achats fournisseurs de la même catégorie</div>
            {margeCatData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {margeCatData.sort((a, b) => b.marge - a.marge).map((cat, i) => {
                  const max = Math.max(...margeCatData.map(x => Math.abs(x.marge)))
                  const w = max > 0 ? (Math.abs(cat.marge) / max) * 100 : 0
                  const color = cat.marge >= 0 ? COLORS[i % (COLORS.length - 1)] : '#F43F5E'
                  return (
                    <div key={cat.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#C2C2DA', fontWeight: 500 }}>{cat.name}</span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#8888AA' }}>{cat.taux}%</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{eur(cat.marge)}</span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: '#1E1E2E', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Aucune donnée disponible</div>}
          </Card>
        </>}

        {/* ══════════ À PAYER ══════════ */}
        {tab === 'apayer' && <>
          <Card style={{ background: '#F59E0B0A', border: '1px solid #F59E0B33' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total à payer</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.totalAPayer)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#8888AA', marginBottom: 4 }}>En retard</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{d.aPayerList.filter(x => x.retard).length}</div>
              </div>
            </div>
          </Card>

          {d.aPayerList.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#4A4A6A', fontSize: 14 }}>✓ Aucune facture en attente</div>
            </Card>
          ) : d.aPayerList.map((row, i) => {
            const isPaid = paidIds.has(row.id)
            const isPaying = payingId === row.id
            return (
              <div key={row.id || i} style={{
                background: isPaid ? '#22D3A50A' : '#12121A',
                border: `1px solid ${isPaid ? '#22D3A533' : row.retard ? '#F43F5E44' : '#1E1E2E'}`,
                borderRadius: 16, padding: '16px',
                borderLeft: `3px solid ${isPaid ? '#22D3A5' : row.retard ? '#F43F5E' : '#F59E0B'}`,
                transition: 'all 0.3s ease',
                opacity: isPaid ? 0.7 : 1,
              }}>
                {/* Top row: fournisseur + montant */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isPaid ? '#22D3A5' : '#E2E2F0', marginBottom: 3 }}>
                      {isPaid ? '✅ ' : ''}{row.fournisseur || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: '#8888AA' }}>{row.categorie} · #{row.id}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isPaid ? '#22D3A5' : '#F59E0B', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                    {eur(row.montantTTC)}
                  </div>
                </div>

                {/* Bottom row: date + badge + bouton OK */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: row.retard && !isPaid ? '#F43F5E' : '#8888AA', fontFamily: 'JetBrains Mono, monospace' }}>
                    📅 {row.echeance}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!isPaid && <Badge text={row.retard ? '🔴 En retard' : '🟠 À payer'} type={row.retard ? 'danger' : 'warning'} />}
                    {isPaid
                      ? <Badge text="✅ Payé" type="success" />
                      : (
                        <button
                          onClick={() => markAsPaid(row.id)}
                          disabled={isPaying || !row.id}
                          style={{
                            background: isPaying ? '#1E1E2E' : '#22D3A5',
                            color: isPaying ? '#8888AA' : '#0A0A0F',
                            border: 'none', borderRadius: 10,
                            padding: '8px 14px', fontSize: 13, fontWeight: 700,
                            cursor: isPaying ? 'wait' : 'pointer',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          {isPaying ? '…' : '✓ OK Payé'}
                        </button>
                      )
                    }
                  </div>
                </div>
              </div>
            )
          })}
        </>}

        {/* ══════════ ANNUEL ══════════ */}
        {tab === 'annuel' && <>

          {/* Bénéfice net de l'année — chiffre principal */}
          <Card style={{ background: d.beneficeAnnee >= 0 ? '#22D3A50A' : '#F43F5E0A', border: `1px solid ${d.beneficeAnnee >= 0 ? '#22D3A533' : '#F43F5E33'}` }}>
            <SectionTitle>✨ Bénéfice net {d.currentYear}</SectionTitle>
            <div style={{ fontSize: 'clamp(30px, 9vw, 48px)', fontWeight: 800, color: d.beneficeAnnee >= 0 ? '#22D3A5' : '#F43F5E', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8, lineHeight: 1 }}>
              {eur(d.beneficeAnnee)}
            </div>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>depuis le 1er janvier {d.currentYear}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#0A0A0F', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#8888AA', marginBottom: 4 }}>CA total</div>
                <div style={{ fontSize: 'clamp(12px, 4vw, 16px)', fontWeight: 700, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.caAnnee)}</div>
              </div>
              <div style={{ background: '#0A0A0F', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: '#8888AA', marginBottom: 4 }}>Dépenses totales</div>
                <div style={{ fontSize: 'clamp(12px, 4vw, 16px)', fontWeight: 700, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace' }}>{eur(d.depensesAnneeTotal)}</div>
              </div>
            </div>
          </Card>

          {/* Graphique CA + bénéfice mois par mois */}
          <Card>
            <SectionTitle>📊 CA et bénéfice mois par mois — {d.currentYear}</SectionTitle>
            <div style={{ fontSize: 12, color: '#8888AA', marginBottom: 16 }}>
              Barres violettes = CA · Barres colorées = bénéfice (vert/rouge)
            </div>
            {d.beneficeParMoisAnnee.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={d.beneficeParMoisAnnee} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barCategoryGap="25%">
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.split(' ')[0].substring(0, 3)} />
                  <YAxis tick={{ fontSize: 10, fill: '#8888AA' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`} />
                  <Tooltip {...TT} formatter={(v: number, name: string) => [eur(v), name === 'revenus' ? 'CA' : 'Bénéfice']} />
                  <Bar dataKey="revenus" name="revenus" fill="#6C63FF33" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="benefice" name="benefice" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {d.beneficeParMoisAnnee.map((entry, i) => (
                      <Cell key={i} fill={entry.benefice >= 0 ? '#22D3A5' : '#F43F5E'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4A6A', fontSize: 13 }}>
                Pas encore de données pour {d.currentYear}
              </div>
            )}
          </Card>

          {/* Meilleur et pire mois */}
          <div className="grid2">
            <Card style={{ border: '1px solid #22D3A533' }}>
              <SectionTitle>🏆 Meilleur mois</SectionTitle>
              {d.meilleurMois ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#E2E2F0', marginBottom: 8, textTransform: 'capitalize' }}>{d.meilleurMois.label}</div>
                  <div style={{ fontSize: 'clamp(17px, 5.5vw, 24px)', fontWeight: 800, color: '#22D3A5', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>{eur(d.meilleurMois.benefice)}</div>
                  <div style={{ fontSize: 12, color: '#8888AA' }}>CA : {eur(d.meilleurMois.revenus)}</div>
                </>
              ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas encore de données</div>}
            </Card>
            <Card style={{ border: '1px solid #F43F5E33' }}>
              <SectionTitle>📉 Pire mois</SectionTitle>
              {d.pireMois ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#E2E2F0', marginBottom: 8, textTransform: 'capitalize' }}>{d.pireMois.label}</div>
                  <div style={{ fontSize: 'clamp(17px, 5.5vw, 24px)', fontWeight: 800, color: '#F43F5E', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>{eur(d.pireMois.benefice)}</div>
                  <div style={{ fontSize: 12, color: '#8888AA' }}>CA : {eur(d.pireMois.revenus)}</div>
                </>
              ) : <div style={{ color: '#4A4A6A', fontSize: 13 }}>Pas encore de données</div>}
            </Card>
          </div>

        </>}

      </div>

      {/* ── Bottom tab bar ── */}
      <nav className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-emoji">{t.label}</span>
            <span className="tab-label" style={{ color: tab === t.id ? '#6C63FF' : '#8888AA' }}>{t.title}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
