import { NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function weekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const VENTE_CATEGORIES = ['Boissons', 'Boucherie', 'Charcuterie', 'Épicerie', 'Fruits & Légumes', 'Rôtisserie']
const MARCHANDISES_CATS = ['Boisson', 'Boucherie', 'Charcuterie', 'Epicerie', 'Fruit et légume', 'Rotisserie']
const CAT_MAP: Record<string, string> = {
  'Boissons': 'Boisson',
  'Boucherie': 'Boucherie',
  'Charcuterie': 'Charcuterie',
  'Épicerie': 'Epicerie',
  'Fruits & Légumes': 'Fruit et légume',
  'Rôtisserie': 'Rotisserie',
}

export async function GET() {
  try {
    const sheets = getSheetsClient()

    const [ventesRes, depensesRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Ventes!A:S',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Dépenses!A:R',
      }),
    ])

    const ventesRows = ventesRes.data.values || []
    const depensesRows = depensesRes.data.values || []

    // ── Parse Ventes ─────────────────────────────────────────────────────────
    const [, ...vData] = ventesRows
    type VenteRow = {
      date: Date; dateStr: string; caHT: number; tvaMontant: number
      Boissons: number; Boucherie: number; Charcuterie: number
      Épicerie: number; 'Fruits & Légumes': number; Rôtisserie: number
    }

    const ventes: VenteRow[] = vData
      .filter(r => r[1] && r[1].trim() !== '')
      .map(r => ({
        date: parseDate(r[0])!,
        dateStr: r[0],
        caHT: parseNum(r[2]),
        tvaMontant: parseNum(r[17]),
        Boissons: parseNum(r[8]),
        Boucherie: parseNum(r[9]),
        Charcuterie: parseNum(r[10]),
        Épicerie: parseNum(r[11]),
        'Fruits & Légumes': parseNum(r[14]),
        Rôtisserie: parseNum(r[15]),
      }))
      .filter(r => r.date !== null)

    // ── Parse Dépenses ────────────────────────────────────────────────────────
    // Colonnes : A=0 Date facturation, B=1 Fournisseur, C=2 N°Facture,
    // D=3 MontantHT, E=4 TVA Taux, F=5 TVA Montant, G=6 Montant TTC,
    // H=7 Catégorie, L=11 Échéance, M=12 Période, N=13 Montant_hebdo,
    // O=14 Date échéance finale, P=15 Statut_paiement, Q=16 ID
    const [, ...dData] = depensesRows
    type DepRow = {
      dateFacturation: Date | null
      dateEcheanceFin: Date | null   // ← référence pour classer dans un mois/semaine
      fournisseur: string
      montantHT: number; montantTVA: number; montantTTC: number
      categorie: string; statut: string
      periode: string; montantHebdo: number
      id: string
    }

    const depenses: DepRow[] = dData
      .filter(r => r[1] && r[1].trim() !== '') // ignorer lignes vides
      .map(r => ({
        dateFacturation: parseDate(r[0]),
        dateEcheanceFin: parseDate(r[14]),
        fournisseur: r[1] || '',
        montantHT: parseNum(r[3]),
        montantTVA: parseNum(r[5]),
        montantTTC: parseNum(r[6]),
        categorie: (r[7] || '').trim(),
        statut: (r[15] || '').trim(),
        periode: r[12] || '',
        montantHebdo: parseNum(r[13]),
        id: r[16] ? String(r[16]).trim() : '',
      }))

    const today = new Date()
    const currentMonth = monthKey(today)
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonth = monthKey(lastMonthDate)
    const { start: weekStart, end: weekEnd } = weekBounds(today)

    // Fonction helper : est-ce que la dépense appartient à ce mois (via date échéance)
    function inMonth(r: DepRow, key: string) {
      const d = r.dateEcheanceFin || r.dateFacturation
      return d ? monthKey(d) === key : false
    }
    function inWeek(r: DepRow) {
      const d = r.dateEcheanceFin || r.dateFacturation
      return d ? d >= weekStart && d <= weekEnd : false
    }

    // ── Revenus ───────────────────────────────────────────────────────────────
    const revenusMoisCourant = ventes.filter(r => monthKey(r.date) === currentMonth).reduce((s, r) => s + r.caHT, 0)
    const revenusMoisDernier = ventes.filter(r => monthKey(r.date) === lastMonth).reduce((s, r) => s + r.caHT, 0)
    const revenusSemaine = ventes.filter(r => r.date >= weekStart && r.date <= weekEnd).reduce((s, r) => s + r.caHT, 0)

    // TVA collectée mois courant
    const tvaCollecteeMois = ventes.filter(r => monthKey(r.date) === currentMonth).reduce((s, r) => s + r.tvaMontant, 0)

    // ── Dépenses mois courant (via date échéance) ─────────────────────────────
    const depMoisCourant = depenses.filter(r => inMonth(r, currentMonth))
    const depensesMoisCourant = depMoisCourant.reduce((s, r) => s + r.montantHT, 0)
    const depensesMoisCourantTTC = depMoisCourant.reduce((s, r) => s + r.montantTTC, 0)
    const tvaDeductibleMois = depMoisCourant.reduce((s, r) => s + r.montantTVA, 0)
    const tvaAReverser = tvaCollecteeMois - tvaDeductibleMois

    // ── Dépenses semaine (via date échéance) ──────────────────────────────────
    const depSemaine = depenses.filter(r => inWeek(r))
    const depensesSemaine = depSemaine.reduce((s, r) => s + r.montantHT, 0)
    const depensesSemaineTTC = depSemaine.reduce((s, r) => s + r.montantTTC, 0)

    // ── Achats marchandises mois + semaine (pour widget objectif) ────────────
    const achatsMarchandisesMois = depMoisCourant
      .filter(r => MARCHANDISES_CATS.includes(r.categorie))
      .reduce((s, r) => s + r.montantHT, 0)
    const achatsMarchandisesHebdo = depSemaine
      .filter(r => MARCHANDISES_CATS.includes(r.categorie))
      .reduce((s, r) => s + r.montantHT, 0)

    // ── Charges fixes + variables (via Montant_hebdo, lissé) ─────────────────
    const chargesFixesHebdo = depenses
      .filter(r => r.categorie === 'Charge fixe')
      .reduce((s, r) => s + r.montantHebdo, 0)
    const chargesVariablesHebdo = depenses
      .filter(r => r.categorie === 'Charge variable')
      .reduce((s, r) => s + r.montantHebdo, 0)
    const chargesHebdo = chargesFixesHebdo + chargesVariablesHebdo
    const chargesMois = chargesHebdo * 4.33
    const chargesFixesMoisCourant = chargesFixesHebdo * 4.33
    const chargesFixesTotales = depenses.filter(r => r.categorie === 'Charge fixe').reduce((s, r) => s + r.montantHT, 0)
    const chargesVariablesTotales = depenses.filter(r => r.categorie === 'Charge variable').reduce((s, r) => s + r.montantHT, 0)

    // ── Ventes par catégorie ──────────────────────────────────────────────────
    const venteParCat: Record<string, number> = {}
    VENTE_CATEGORIES.forEach(cat => {
      venteParCat[cat] = ventes.reduce((s, r) => s + ((r as any)[cat] || 0), 0)
    })
    const venteParCatMoisCourant: Record<string, number> = {}
    VENTE_CATEGORIES.forEach(cat => {
      venteParCatMoisCourant[cat] = ventes
        .filter(r => monthKey(r.date) === currentMonth)
        .reduce((s, r) => s + ((r as any)[cat] || 0), 0)
    })

    // ── Dépenses par catégorie marchandises (mois courant, via date échéance) ─
    const depParCat: Record<string, number> = {}
    MARCHANDISES_CATS.forEach(cat => {
      depParCat[cat] = depenses.filter(r => r.categorie === cat).reduce((s, r) => s + r.montantHT, 0)
    })
    const depParCatMoisCourant: Record<string, number> = {}
    MARCHANDISES_CATS.forEach(cat => {
      depParCatMoisCourant[cat] = depMoisCourant
        .filter(r => r.categorie === cat)
        .reduce((s, r) => s + r.montantHT, 0)
    })

    // ── Marge par catégorie (mois courant) ────────────────────────────────────
    const margeParCat: Record<string, { ventes: number; depenses: number; marge: number; tauxMarge: number }> = {}
    VENTE_CATEGORIES.forEach(catV => {
      const catD = CAT_MAP[catV]
      const v = venteParCatMoisCourant[catV] || 0
      const d = depParCatMoisCourant[catD] || 0
      const marge = v - d
      margeParCat[catV] = { ventes: v, depenses: d, marge, tauxMarge: v > 0 ? (marge / v) * 100 : 0 }
    })

    // ── Bénéfice par mois (historique complet, via date échéance) ────────────
    const moisSet = new Set([
      ...ventes.map(r => monthKey(r.date)),
      ...depenses.map(r => {
        const d = r.dateEcheanceFin || r.dateFacturation
        return d ? monthKey(d) : null
      }).filter(Boolean) as string[],
    ])
    const beneficeParMois = Array.from(moisSet).sort().map(key => {
      const rev = ventes.filter(r => monthKey(r.date) === key).reduce((s, r) => s + r.caHT, 0)
      const dep = depenses.filter(r => inMonth(r, key)).reduce((s, r) => s + r.montantHT, 0)
      return { mois: key, label: monthLabel(key), revenus: rev, depenses: dep, benefice: rev - dep }
    })

    const evolutionJournaliere = ventes
      .filter(r => monthKey(r.date) === currentMonth)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(r => ({ date: r.dateStr, ca: r.caHT }))

    const progressionMois = revenusMoisDernier > 0
      ? ((revenusMoisCourant - revenusMoisDernier) / revenusMoisDernier) * 100
      : null

    // ── Coût matière % (mois courant) ─────────────────────────────────────────
    const achatsFournisseursMois = Object.values(depParCatMoisCourant).reduce((s, v) => s + v, 0)
    const coutMatierePC = revenusMoisCourant > 0 ? (achatsFournisseursMois / revenusMoisCourant) * 100 : 0

    // ── Seuil de rentabilité (mois courant) ───────────────────────────────────
    const margeBruteMois = revenusMoisCourant - achatsFournisseursMois
    const tauxMargeVariable = revenusMoisCourant > 0 ? (margeBruteMois / revenusMoisCourant) * 100 : 0
    const seuilRentabilite = tauxMargeVariable > 0 ? (chargesFixesMoisCourant / (tauxMargeVariable / 100)) : null
    const margeNegative = revenusMoisCourant > 0 && tauxMargeVariable <= 0

    // ── Répartition dépenses (mois courant, via date échéance) ────────────────
    const repartitionDepenses: Record<string, number> = {}
    depMoisCourant.forEach(r => {
      if (!r.categorie) return
      repartitionDepenses[r.categorie] = (repartitionDepenses[r.categorie] || 0) + r.montantHT
    })

    // ── À payer ───────────────────────────────────────────────────────────────
    const aPayerList = depenses
      .filter(r => r.statut && !r.statut.includes('Payé') && r.statut.trim() !== '')
      .sort((a, b) => {
        if (!a.dateEcheanceFin) return 1
        if (!b.dateEcheanceFin) return -1
        return a.dateEcheanceFin.getTime() - b.dateEcheanceFin.getTime()
      })
      .map(r => ({
        id: r.id,
        fournisseur: r.fournisseur,
        montantTTC: r.montantTTC,
        categorie: r.categorie,
        echeance: r.dateEcheanceFin ? r.dateEcheanceFin.toLocaleDateString('fr-FR') : '—',
        statut: r.statut,
        retard: r.dateEcheanceFin ? r.dateEcheanceFin < today : false,
      }))
    const totalAPayer = aPayerList.reduce((s, r) => s + r.montantTTC, 0)

    return NextResponse.json({
      // Revenus
      revenusMoisCourant, revenusMoisDernier, revenusSemaine,
      // Dépenses
      depensesMoisCourant, depensesMoisCourantTTC, depensesSemaine, depensesSemaineTTC,
      // Achats marchandises (pour widget objectif)
      achatsMarchandisesMois, achatsMarchandisesHebdo,
      // Charges fixes/variables
      chargesFixesTotales, chargesVariablesTotales, chargesFixesMoisCourant,
      chargesFixesHebdo, chargesVariablesHebdo, chargesHebdo, chargesMois,
      // Catégories
      venteParCat, venteParCatMoisCourant, depParCat, depParCatMoisCourant, margeParCat,
      // Graphiques
      beneficeParMois, evolutionJournaliere, progressionMois,
      // Indicateurs
      seuilRentabilite, tauxMargeVariable, coutMatierePC, margeNegative, margeBruteMois,
      // TVA
      tvaCollecteeMois, tvaDeductibleMois, tvaAReverser,
      // Répartition
      repartitionDepenses,
      // À payer
      aPayerList, totalAPayer,
      // Labels
      currentMonth: monthLabel(currentMonth),
      lastMonth: monthLabel(lastMonth),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error) {
    console.error('Data API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
