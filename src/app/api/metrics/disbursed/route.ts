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
          ti.lot_number,
          ti.quantity AS quantity_dispensed,
          t.requestor_name AS dispensed_by,
          t.date AS dispensed_date,
          COALESCE(pr.project, '') AS project_name,
          COALESCE(pr.department::text, t.department::text, '') AS functional_group
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        JOIN products p ON p.id = t.product_id
        LEFT JOIN fulfillments f ON f.id = t.fulfillment_id
        LEFT JOIN product_requests pr ON pr.id = f.request_id
        WHERE t.date >= $1::date AND t.date < ($2::date + INTERVAL '1 day')

        UNION ALL

        SELECT
          hr.product_name,
          hr.manufacturer,
          hr.manufacturer_part_number,
          hr.uom,
          hr.lot_number,
          hr.quantity AS quantity_dispensed,
          '' AS dispensed_by,
          hr.event_date AS dispensed_date,
          COALESCE(hr.project, '') AS project_name,
          COALESCE(hr.department, '') AS functional_group
        FROM historical_records hr
        WHERE hr.type = 'Out'
          AND hr.event_date >= $1::date AND hr.event_date < ($2::date + INTERVAL '1 day')
      ) combined
      ORDER BY dispensed_date DESC`,
      [from, to]
    );

    return NextResponse.json(rows.map(r => ({
      product_name: r.product_name,
      manufacturer: r.manufacturer,
      manufacturer_part_number: r.manufacturer_part_number,
      uom: r.uom ?? '',
      lot_number: r.lot_number,
      quantity_dispensed: r.quantity_dispensed,
      dispensed_by: r.dispensed_by ?? '',
      dispensed_date: r.dispensed_date,
      project_name: r.project_name,
      functional_group: r.functional_group,
    })));
  } catch (error) {
    console.error('[api/metrics/disbursed] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch disbursed metrics' }, { status: 500 });
  }
}
