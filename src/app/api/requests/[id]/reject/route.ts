import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { LINE_ITEMS_SUBQUERY, RequestRow, rowToRequest } from '@/lib/db/request-queries';

type RouteContext = { params: Promise<{ id: string }> };

const RejectSchema = z.object({
  rejectionNote: z.string().min(1, 'Rejection note is required'),
});

// ---------------------------------------------------------------------------
// PUT /api/requests/[id]/reject
// Director or Admin rejects a request.
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director' && role !== 'Admin') {
    return NextResponse.json({ error: 'Only Directors and Admins can reject requests' }, { status: 403 });
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
      const { rows } = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM product_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (rows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      const req = rows[0];

      if (req.status === 'Completed' || req.status === 'Rejected') {
        throw Object.assign(
          new Error(`Cannot reject a request with status "${req.status}"`),
          { code: 'INVALID_STATUS', status: req.status }
        );
      }

      const rejectionStage = req.status === 'Pending SciOps Approval' ? 'sciops' : (role === 'Director' ? 'director' : 'admin');
      const directorNote = role === 'Director' ? rejectionNote : null;

      await client.query(
        `UPDATE product_requests
         SET status = 'Rejected',
             rejection_note = $1,
             rejected_by = $2,
             rejection_stage = $3,
             director_rejection_note = COALESCE($4, director_rejection_note),
             updated_by = $2
         WHERE id = $5`,
        [rejectionNote, userId || null, rejectionStage, directorNote, id]
      );

      const { rows: full } = await client.query<RequestRow>(
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
    const err = error as Error & { code?: string; status?: string };

    if (err.code === 'REQUEST_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'INVALID_STATUS') {
      return NextResponse.json({ error: err.message, status: err.status }, { status: 409 });
    }

    console.error(`[api/requests/${id}/reject] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
  }
}
