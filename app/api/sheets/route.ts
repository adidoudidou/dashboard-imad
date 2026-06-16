import { NextResponse } from 'next/server'
import { getSheetsClient, SPREADSHEET_ID } from '@/lib/sheets'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sheets = getSheetsClient()

    // Fetch data from Sheet1 — adapt range to your real sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:Z', // ← change to match your sheet name & columns
    })

    const rows = response.data.values || []

    if (rows.length === 0) {
      return NextResponse.json({ headers: [], rows: [] })
    }

    const [headers, ...dataRows] = rows

    // Convert rows to objects keyed by header
    const data = dataRows.map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((header: string, i: number) => {
        obj[header] = row[i] ?? ''
      })
      return obj
    })

    return NextResponse.json({ headers, data })
  } catch (error) {
    console.error('Sheets read error:', error)
    return NextResponse.json({ error: 'Failed to fetch sheet data' }, { status: 500 })
  }
}
