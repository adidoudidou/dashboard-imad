import { NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

    const sheets = getSheetsClient()

    // Fetch all rows from Dépenses to find the row with matching ID (col R = index 16)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dépenses!A:R',
    })

    const rows = res.data.values || []
    const rowIndex = rows.findIndex((row, i) => i > 0 && String(row[16]).trim() === String(id).trim())

    if (rowIndex === -1) {
      return NextResponse.json({ error: `Facture ID ${id} introuvable` }, { status: 404 })
    }

    const sheetRow = rowIndex + 1 // 1-based

    // Update Statut_paiement column P on that row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Dépenses!P${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['✅ Payé']] },
    })

    return NextResponse.json({ success: true, row: sheetRow })
  } catch (error) {
    console.error('Pay API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
