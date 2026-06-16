import { NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

// ─── Helpers ────────────────────────────────────────────────────────────────
function parseNum(s: string | undefined): number {
  if (!s) return 0
  return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const parts = s.split('/')
  if (parts.length !== 3) return null
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
}

const VENTE_CATEGORIES = ['Boissons', 'Boucherie', 'Charcuterie', 'Épicerie', 'Fruits & Légumes', 'Rôtisserie']
const DEPENSE_CATEGORIES = ['Boisson', 'Boucherie', 'Charcuterie', 'Epicerie', 'Fruit et légume', 'Rotisserie']

// Map vente col → dépense category
const CAT_MAP: Record<string, string> = {
  'Boissons': 'Boisson',
  'Boucherie': 'Boucherie',
  'Charcuterie': 'Charcuterie',
  'Épicerie': 'Epicerie',
  'Fruits & Légumes': 'Fruit et légume',
  'Rôtisserie': 'Rotisserie',
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const sheets = getSheetsClient()

    const [ventesRes, depensesRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Ventes!A:S' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Dépenses!A:Q' }),
    ])

    const ventesRows = ventesRes.data.values || []
    const depensesRows = depensesRes.data.values || []

    // ── Parse Ventes (only rows with Numéro Z = real ticket Z) ──────────────
    const [vH, ...vData] = ventesRows
    type VenteRow = {
      date: Date; dateStr: string; caHT: number;
      Boissons: number; Boucherie: number; Charcuterie: number
      Épicerie: number; 'Fruits & Légumes': number; Rôtisserie: number
    }

    const ventes: VenteRow[] = vData
      .filter(r => r[1] && r[1].trim() !== '') // Numéro Z must exist
      .map(r => ({
        date: parseDate(r[0])!,
        dateStr: r[0],
        caHT: parseNum(r[2]),
        Boissons: parseNum(r[8]),
        Boucherie: parseNum(r[9]),
        Charcuterie: parseNum(r[11]),
        Épicerie: parseNum(r[11]),
        'Fruits & Légumes': parseNum(r[14]),
        Rôtisserie: parseNum(r[15]),
      }))
      .filter(r => r.date !== null)

    // ── Parse Dépenses ───────────────────────────────────────────────────────
    const [dH, ...dData] = depensesRows
    type DepRow = {
      date: Date | null; fournisseur: string; montantHT: number
      categorie: string; statut: string; echeance: Date | null
      periode: string; montantHebdo: number; dateEcheanceFin: Date | null
    }

    const depenses: DepRow[] = dData.map(r => ({
      date: parseDate(r[0]),
      fournisseur: r[1] || '',
      montantHT: parseNum(r[3]),
      categorie: r[7] || '',
      statut: r[16] || '',
      echeance: parseDate(r[11]),
      periode: r[12] || '',
      montantHebdo: parseNum(r[13]),
      dateEcheanceFin: parseDate(r[14]),
    }))

    // ─────────────────────────────────────────────────────────────────────────
    // COMPUTED METRICS
    // ─────────────────────────────────────────────────────────────────────────

    const today = new Date()
    const currentMonth = monthKey(today)
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonth = monthKey(lastMonthDate)

    // ── 1. Total revenus (all time) & mois courant ──────────────────────────
    const totalRevenus = ventes.reduce((s, r) => s + r.caHT, 0)
    const revenusMoisCourant = ventes
      .filter(r => monthKey(r.date) === currentMonth)
      .reduce((s, r) => s + r.caHT, 0)
    const revenusMoisDernier = ventes
      .filter(r => monthKey(r.date) === lastMonth)
      .reduce((s, r) => s + r.caHT, 0)

    // ── 2. Total dépenses ───────────────────────────────────────────────────
    const totalDepenses = depenses.reduce((s, r) => s + r.montantHT, 0)
    const depensesMoisCourant = depenses
      .filter(r => r.date && monthKey(r.date) === currentMonth)
      .reduce((s, r) => s + r.montantHT, 0)

    // ── 3. Charges fixes & variables ───────────────────────────────────────
    const chargesFixesTotales = depenses
      .filter(r => r.categorie === 'Charge fixe')
      .reduce((s, r) => s + r.montantHT, 0)
    const chargesVariablesTotales = depenses
      .filter(r => r.categorie === 'Charge variable')
      .reduce((s, r) => s + r.montantHT, 0)

    // Hebdo (÷ 4.33 pour mensuel → semaine, ÷ 52 pour annuel)
    const chargesFixesHebdo = depenses
      .filter(r => r.categorie === 'Charge fixe')
      .reduce((s, r) => s + r.montantHebdo, 0) / 4.33

    // ── 4. Ventes par catégorie ─────────────────────────────────────────────
    const venteParCat: Record<string, number> = {}
    VENTE_CATEGORIES.forEach(cat => {
      venteParCat[cat] = ventes.reduce((s, r) => s + (r[cat as keyof VenteRow] as number || 0), 0)
    })

    // ── 5. Dépenses par catégorie (fournisseurs seulement) ─────────────────
    const depParCat: Record<string, number> = {}
    DEPENSE_CATEGORIES.forEach(cat => {
      depParCat[cat] = depenses
        .filter(r => r.categorie === cat)
        .reduce((s, r) => s + r.montantHT, 0)
    })

    // ── 6. Marge brute par catégorie ────────────────────────────────────────
    const margeParCat: Record<string, { ventes: number; depenses: number; marge: number; tauxMarge: number }> = {}
    VENTE_CATEGORIES.forEach(catV => {
      const catD = CAT_MAP[catV]
      const v = venteParCat[catV] || 0
      const d = depParCat[catD] || 0
      const marge = v - d
      margeParCat[catV] = { ventes: v, depenses: d, marge, tauxMarge: v > 0 ? (marge / v) * 100 : 0 }
    })

    // ── 7. Bénéfice HT par mois ─────────────────────────────────────────────
    const moisSet = new Set([
      ...ventes.map(r => monthKey(r.date)),
      ...depenses.filter(r => r.date).map(r => monthKey(r.date!)),
    ])
    const beneficeParMois = Array.from(moisSet).sort().map(key => {
      const rev = ventes.filter(r => monthKey(r.date) === key).reduce((s, r) => s + r.caHT, 0)
      const dep = depenses.filter(r => r.date && monthKey(r.date) === key).reduce((s, r) => s + r.montantHT, 0)
      return { mois: key, label: monthLabel(key), revenus: rev, depenses: dep, benefice: rev - dep }
    })

    // ── 8. Évolution journalière du CA (mois courant) ───────────────────────
    const evolutionJournaliere = ventes
      .filter(r => monthKey(r.date) === currentMonth)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(r => ({ date: r.dateStr, ca: r.caHT }))

    // ── 9. Progression mois vs mois dernier ─────────────────────────────────
    const progressionMois = revenusMoisDernier > 0
      ? ((revenusMoisCourant - revenusMoisDernier) / revenusMoisDernier) * 100
      : null

    // ── 10. Seuil de rentabilité ─────────────────────────────────────────────
    // Seuil = Charges fixes / Taux de marge sur coût variable
    const totalVentes = totalRevenus
    const tauxMargeVariable = totalVentes > 0
      ? ((totalVentes - chargesVariablesTotales - Object.values(depParCat).reduce((s, v) => s + v, 0)) / totalVentes) * 100
      : 0
    const seuilRentabilite = tauxMargeVariable > 0
      ? (chargesFixesTotales / (tauxMargeVariable / 100))
      : null

    // Coût matière % par semaine
    const totalVentesCat = Object.values(venteParCat).reduce((s, v) => s + v, 0)
    const totalDepCat = Object.values(depParCat).reduce((s, v) => s + v, 0)
    const coutMatierePC = totalVentesCat > 0 ? (totalDepCat / totalVentesCat) * 100 : 0

    // ── 11. Répartition des dépenses (toutes catégories) ───────────────────
    const repartitionDepenses: Record<string, number> = {}
    depenses.forEach(r => {
      if (!r.categorie) return
      repartitionDepenses[r.categorie] = (repartitionDepenses[r.categorie] || 0) + r.montantHT
    })

    // ── 12. Tableau d'échéances (A payer) ───────────────────────────────────
    const aPayerList = depenses
      .filter(r => r.statut.includes('À payer') || r.statut.includes('retard'))
      .sort((a, b) => {
        if (!a.dateEcheanceFin) return 1
        if (!b.dateEcheanceFin) return -1
        return a.dateEcheanceFin.getTime() - b.dateEcheanceFin.getTime()
      })
      .map(r => ({
        fournisseur: r.fournisseur,
        montantHT: r.montantHT,
        categorie: r.categorie,
        echeance: r.dateEcheanceFin ? r.dateEcheanceFin.toLocaleDateString('fr-FR') : '—',
        statut: r.statut,
        retard: r.dateEcheanceFin ? r.dateEcheanceFin < today : false,
      }))

    const totalAPayer = aPayerList.reduce((s, r) => s + r.montantHT, 0)

    return NextResponse.json({
      totalRevenus,
      totalDepenses,
      revenusMoisCourant,
      revenusMoisDernier,
      depensesMoisCourant,
      chargesFixesTotales,
      chargesVariablesTotales,
      chargesFixesHebdo,
      beneficeParMois,
      venteParCat,
      depParCat,
      margeParCat,
      evolutionJournaliere,
      progressionMois,
      seuilRentabilite,
      tauxMargeVariable,
      coutMatierePC,
      repartitionDepenses,
      aPayerList,
      totalAPayer,
      currentMonth: monthLabel(currentMonth),
      lastMonth: monthLabel(lastMonth),
    })
  } catch (error) {
    console.error('Data API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
