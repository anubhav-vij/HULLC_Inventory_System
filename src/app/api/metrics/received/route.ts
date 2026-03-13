import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const FULL_VIEW_ROLES = ['Admin', 'ProjectManager', 'Chief'];

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (!FULL_VIEW_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Both "from" and "to" query parameters are required' }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT * FROM (
        SELECT
          p.name AS product_name,
          p.manufacturer,
          p.manufacturer_part_number,
          p.uom,
          l.lot_number,
          l.quantity,
          l.location AS storage_location,
          l.receipt_date AS received_date
        FROM lots l
        JOIN products p ON p.id = l.product_id
        WHERE l.receipt_date >= $1::date AND l.receipt_date <= $2::date

        UNION ALL

        SELECT
          hr.product_name,
          hr.manufacturer,
          hr.manufacturer_part_number,
          hr.uom,
          hr.lot_number,
          hr.quantity,
          '' AS storage_location,
          hr.event_date AS received_date
        FROM historical_records hr
        WHERE hr.type = 'In'
          AND hr.event_date >= $1::date AND hr.event_date <= $2::date
      ) combined
      ORDER BY received_date DESC`,
      [from, to]
    );

    return NextResponse.json(rows.map(r => ({
      product_name: r.product_name,
      manufacturer: r.manufacturer,
      manufacturer_part_number: r.manufacturer_part_number,
      uom: r.uom ?? '',
      lot_number: r.lot_number,
      quantity: r.quantity,
      storage_location: r.storage_location,
      received_date: r.received_date,
    })));
  } catch (error) {
    console.error('[api/metrics/received] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch received metrics' }, { status: 500 });
  }
}
