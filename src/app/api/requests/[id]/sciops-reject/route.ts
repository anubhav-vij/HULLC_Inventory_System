import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { LINE_ITEMS_SUBQUERY, rowToRequest } from '@/lib/db/request-queries';

type RouteContext = { params: Promise<{ id: string }> };

const RejectSchema = z.object({
  rejectionNote: z.string().min(1, 'Rejection note is required'),
});

// PUT /api/requests/[id]/sciops-reject
// Sci-Ops Director rejects a Pending SciOps Approval request.
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director') {
    return NextResponse.json({ error: 'Only Directors can reject SciOps requests' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { rejectionNote } = parsed.data;

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
      if (!director.functional_group_id) {
        throw Object.assign(new Error('Director has no functional group'), { code: 'NO_GROUP' });
      }

      const { rows: groupRows } = await client.query<{ name: string }>(
        'SELECT name FROM functional_groups WHERE id = $1',
        [director.functional_group_id]
      );

      if (groupRows.length === 0 || groupRows[0].name !== 'Scientific Operations') {
        throw Object.assign(
          new Error('Only the Scientific Operations Director can reject SOM requests'),
          { code: 'WRONG_GROUP' }
        );
      }

      const { rows: reqRows } = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM product_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (reqRows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      if (reqRows[0].status !== 'Pending SciOps Approval') {
        throw Object.assign(
          new Error(`Request is "${reqRows[0].status}" and cannot be SciOps rejected`),
          { code: 'INVALID_STATUS' }
        );
      }

      await client.query(
        `UPDATE product_requests
         SET status = 'Rejected',
             rejection_note = $1,
             rejected_by = $2,
             rejection_stage = 'sciops',
             som_approval_status = 'rejected',
             updated_by = $2
         WHERE id = $3`,
        [rejectionNote, userId || null, id]
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
    console.error(`[api/requests/${id}/sciops-reject] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
  }
}

