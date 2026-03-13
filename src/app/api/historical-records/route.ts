import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '@/lib/db';

// ---------------------------------------------------------------------------
// GET /api/historical-records
// Returns all historical records, ordered by event_date DESC.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { rows } = await query(
      `SELECT * FROM historical_records ORDER BY event_date DESC, created_at DESC`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[api/historical-records] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch historical records' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/historical-records
// Accepts an array of parsed legacy Excel rows and inserts them.
// Expects body: { records: Array<{ type, event_date, product_name, ... }> }
// Auto-generates LOT-#-Missing lot numbers using a global counter.
// ---------------------------------------------------------------------------

interface HistoricalRecordInput {
  type: string;           // "In" or "Out"
  event_date?: string;    // ISO date from "Request Fulfilled Date"
  product_name: string;   // from "Consumable"
  manufacturer?: string;
  manufacturer_part_number?: string; // from "Vendor Part #"
  uom?: string;           // from "U of M"
  quantity?: number;       // Added Amount (In) or Requested Quantity (Out)
  department?: string;     // functional group (Out only)
  project?: string;
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { records?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    return NextResponse.json({ error: 'Body must contain a non-empty "records" array' }, { status: 400 });
  }

  const records = body.records as HistoricalRecordInput[];
  const userId = request.headers.get('x-user-id') || null;

  // Validate each record
  const errors: string[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r.type || !['In', 'Out'].includes(r.type)) {
      errors.push(`Row ${i + 1}: type must be "In" or "Out"`);
    }
    if (!r.product_name || !r.product_name.trim()) {
      errors.push(`Row ${i + 1}: product_name is required`);
    }
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Validation failed', details: errors.slice(0, 10) }, { status: 422 });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Get current max LOT-#-Missing-Historical counter
      const { rows: counterRows } = await client.query<{ max_num: string | null }>(`
        SELECT MAX(
          CAST(SUBSTRING(lot_number FROM 'LOT-(\\d+)-Missing-Historical') AS INTEGER)
        ) AS max_num
        FROM historical_records
        WHERE lot_number LIKE 'LOT-%-Missing-Historical'
      `);
      let lotCounter = counterRows[0]?.max_num ? parseInt(counterRows[0].max_num, 10) : 0;

      let inserted = 0;
      for (const r of records) {
        lotCounter++;
        const lotNumber = `LOT-${lotCounter}-Missing-Historical`;
        const qty = r.quantity != null ? Math.abs(Math.round(Number(r.quantity))) : 0;

        await client.query(
          `INSERT INTO historical_records
            (id, type, event_date, product_name, manufacturer, manufacturer_part_number,
             uom, quantity, department, project, lot_number, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            uuidv4(),
            r.type,
            r.event_date || null,
            r.product_name.trim(),
            r.manufacturer?.trim() || null,
            r.manufacturer_part_number?.trim() || null,
            r.uom?.trim() || null,
            qty,
            r.department?.trim() || null,
            r.project?.trim() || null,
            lotNumber,
            userId,
          ]
        );
        inserted++;
      }

      return { inserted };
    });

    return NextResponse.json(
      { message: `Successfully imported ${result.inserted} historical records` },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/historical-records] POST error:', error);
    return NextResponse.json({ error: 'Failed to import historical records' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/historical-records
// Deletes all historical records. Admin only.
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { rowCount } = await query('DELETE FROM historical_records');
    return NextResponse.json({ message: `Deleted ${rowCount} historical records` });
  } catch (error) {
    console.error('[api/historical-records] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete historical records' }, { status: 500 });
  }
}
