import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { LINE_ITEMS_SUBQUERY, rowToRequest } from '@/lib/db/request-queries';

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/requests/[id]/sciops-approve
// Sci-Ops Director approves a Pending SciOps Approval request.
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director' && role !== 'Admin') {
    return NextResponse.json({ error: 'Only Directors and Admins can approve SciOps requests' }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  let comments: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const schema = z.object({ comments: z.string().optional() });
    const parsed = schema.safeParse(body);
    if (parsed.success && parsed.data.comments) {
      comments = parsed.data.comments.trim() || null;
    }
  } catch {
    // comments remain null
  }

  try {
    const result = await withTransaction(async (client) => {
      // Verify user is the Sci-Ops Director (lock row to prevent concurrent role changes)
      const { rows: userRows } = await client.query<{
        id: string;
        functional_group_id: string | null;
      }>(
        'SELECT id, functional_group_id FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRows.length === 0) {
        throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
      }

      const director = userRows[0];

      // Admin can override SciOps approval (e.g. when SciOps Director is OOO)
      // Directors must belong to "Scientific Operations" functional group
      if (role === 'Director') {
        if (!director.functional_group_id) {
          throw Object.assign(new Error('Director has no functional group'), { code: 'NO_GROUP' });
        }

        const { rows: groupRows } = await client.query<{ name: string }>(
          'SELECT name FROM functional_groups WHERE id = $1',
          [director.functional_group_id]
        );

        if (groupRows.length === 0 || groupRows[0].name !== 'Scientific Operations') {
          throw Object.assign(
            new Error('Only the Scientific Operations Director can approve SOM requests'),
            { code: 'WRONG_GROUP' }
          );
        }
      }

      // Get the request
      const { rows: reqRows } = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM product_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (reqRows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      if (reqRows[0].status !== 'Pending SciOps Approval') {
        throw Object.assign(
          new Error(`Request is "${reqRows[0].status}" and cannot be SciOps approved`),
          { code: 'INVALID_STATUS' }
        );
      }

      await client.query(
        `UPDATE product_requests
         SET status = 'Approved',
             som_approval_status = 'approved',
             sciops_director_approved_at = NOW(),
             sciops_director_approved_by = $1,
             updated_by = $1
         WHERE id = $2`,
        [userId, id]
      );

      // Reserve stock when transitioning to Approved
      const { rows: liRows } = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(quantity), 0) AS total
         FROM request_line_items WHERE request_id = $1 AND status = 'Pending'`,
        [id]
      );
      const reserveQty = parseInt(liRows[0].total, 10);
      if (reserveQty > 0) {
        await client.query(
          `UPDATE products SET reserved_quantity = reserved_quantity + $1
           WHERE id = (SELECT product_id FROM product_requests WHERE id = $2)`,
          [reserveQty, id]
        );
      }

      // Log status change
      const sciopsName = (await client.query<{full_name: string}>('SELECT full_name FROM users WHERE id = $1', [userId])).rows[0]?.full_name ?? 'Unknown';
      await client.query(
        `INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, changed_by_name, comments)
         VALUES ($1, 'Pending SciOps Approval', 'Approved', $2, $3, $4)`,
        [id, userId, sciopsName, comments ?? 'SciOps Director approved']
      );

      const { rows: full } = await client.query(
        `SELECT pr.*, ${LINE_ITEMS_SUBQUERY}
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id`,
        [id]
      );

      return full[0];
    });

    return NextResponse.json(rowToRequest(result));
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'USER_NOT_FOUND' || err.code === 'REQUEST_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'INVALID_STATUS') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err.code === 'NO_GROUP' || err.code === 'WRONG_GROUP') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error(`[api/requests/${id}/sciops-approve] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
  }
}

