import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

interface RequestRow {
  id: string;
  product_id: string;
  product_name: string;
  requestor_name: string;
  requestor_email: string;
  department: string;
  project: string | null;
  justification: string;
  sop_read: boolean;
  status: string;
  rejection_note: string | null;
  director_id: string | null;
  director_approved_at: Date | null;
  director_rejection_note: string | null;
  rejected_by: string | null;
  rejection_stage: string | null;
  date: Date;
  line_items: Array<{
    id: string;
    requestId: string;
    requestedDate: string;
    quantity: number;
    status: string;
    fulfilledQuantity: number;
    fulfillmentId: string | null;
  }> | null;
}

const LINE_ITEMS_SUBQUERY = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', rli.id,
        'requestId', rli.request_id,
        'requestedDate', to_char(rli.requested_date, 'YYYY-MM-DD'),
        'quantity', rli.quantity,
        'status', rli.status,
        'fulfilledQuantity', rli.fulfilled_quantity,
        'fulfillmentId', rli.fulfillment_id
      ) ORDER BY rli.requested_date
    ) FILTER (WHERE rli.id IS NOT NULL),
    '[]'
  ) AS line_items
`;

function rowToRequest(row: RequestRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    requestorName: row.requestor_name,
    requestorEmail: row.requestor_email,
    department: row.department,
    project: row.project ?? null,
    justification: row.justification,
    sopRead: row.sop_read,
    status: row.status,
    rejectionNote: row.rejection_note ?? undefined,
    directorId: row.director_id ?? null,
    directorApprovedAt: row.director_approved_at ? row.director_approved_at.toISOString() : null,
    directorRejectionNote: row.director_rejection_note ?? null,
    rejectedBy: row.rejected_by ?? null,
    rejectionStage: row.rejection_stage ?? null,
    date: row.date,
    lineItems: (row.line_items ?? []).map(li => ({
      id: li.id,
      requestId: li.requestId,
      requestedDate: li.requestedDate,
      quantity: li.quantity,
      status: li.status,
      fulfilledQuantity: li.fulfilledQuantity,
      fulfillmentId: li.fulfillmentId ?? null,
      createdAt: new Date().toISOString(),
    })),
  };
}

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

      const rejectionStage = role === 'Director' ? 'director' : 'admin';
      const directorNote = role === 'Director' ? rejectionNote : null;

      await client.query(
        `UPDATE product_requests
         SET status = 'Rejected',
             rejection_note = $1,
             rejected_by = $2,
             rejection_stage = $3,
             director_rejection_note = COALESCE($4, director_rejection_note)
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
