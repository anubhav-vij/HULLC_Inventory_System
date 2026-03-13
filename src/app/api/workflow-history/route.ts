import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('requestId');

  try {
    let sql: string;
    let params: unknown[] = [];

    if (requestId) {
      sql = `
        SELECT rsh.*, pr.request_id AS request_display_id, pr.product_name
        FROM request_status_history rsh
        JOIN product_requests pr ON pr.id = rsh.request_id
        WHERE rsh.request_id = $1
        ORDER BY rsh.created_at ASC
      `;
      params = [requestId];
    } else {
      sql = `
        SELECT rsh.*, pr.request_id AS request_display_id, pr.product_name
        FROM request_status_history rsh
        JOIN product_requests pr ON pr.id = rsh.request_id
        ORDER BY rsh.created_at DESC
        LIMIT 500
      `;
    }

    const { rows } = await query(sql, params);
    return NextResponse.json(rows.map((r: any) => ({
      id: r.id,
      requestId: r.request_id,
      requestDisplayId: r.request_display_id,
      productName: r.product_name,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      changedBy: r.changed_by,
      changedByName: r.changed_by_name,
      comments: r.comments,
      createdAt: r.created_at,
    })));
  } catch (error) {
    console.error('[api/workflow-history] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow history' }, { status: 500 });
  }
}
