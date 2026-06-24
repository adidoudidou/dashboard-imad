import { NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

const RANGE = 'Objectifs!B1'

export async function GET() {
  try {
    const sheets = getSheetsClient()
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE })
    const value = res.data.values?.[0]?.[0] ?? '0'
    return NextResponse.json({ objectif: parseFloat(value) || 0 }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ objectif: 0 })
  }
}

export async function POST(request: Request) {
  try {
    const { objectif } = await request.json()
    if (typeof objectif !== 'number' || objectif < 0) return NextResponse.json({ error: 'Invalid' }, { status: 400 })
    const sheets = getSheetsClient()
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: RANGE,
        valueInputOption: 'RAW', requestBody: { values: [[objectif]] },
      })
    } catch {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Objectifs' } } }] },
      })
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range: RANGE,
        valueInputOption: 'RAW', requestBody: { values: [[objectif]] },
      })
    }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
