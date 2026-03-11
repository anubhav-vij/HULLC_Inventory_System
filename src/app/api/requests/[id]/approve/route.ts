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
  director_comments: string | null;
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
    directorComments: row.director_comments ?? null,
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

// ---------------------------------------------------------------------------
// PUT /api/requests/[id]/approve
// Director approves a Pending Approval request for their functional group.
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director') {
    return NextResponse.json({ error: 'Only Directors can approve requests' }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  let comments: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    const ApproveSchema = z.object({ comments: z.string().optional() });
    const parsed = ApproveSchema.safeParse(body);
    if (parsed.success && parsed.data.comments) {
      comments = parsed.data.comments.trim() || null;
    }
  } catch {
    // comments remain null — optional body
  }

  try {
    const result = await withTransaction(async (client) => {
      // Get the director's user record and functional group
      const { rows: userRows } = await client.query<{
        id: string;
        functional_group_id: string | null;
      }>(
        'SELECT id, functional_group_id FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRows.length === 0) {
        throw Object.assign(new Error('Director user not found'), { code: 'USER_NOT_FOUND' });
      }

      const director = userRows[0];
      if (!director.functional_group_id) {
        throw Object.assign(new Error('Director has no functional group assigned'), { code: 'NO_GROUP' });
      }

      const { rows: groupRows } = await client.query<{ name: string }>(
        'SELECT name FROM functional_groups WHERE id = $1',
        [director.functional_group_id]
      );

      if (groupRows.length === 0) {
        throw Object.assign(new Error('Functional group not found'), { code: 'GROUP_NOT_FOUND' });
      }

      const groupName = groupRows[0].name;

      // Get the request
      const { rows: reqRows } = await client.query<{ id: string; status: string; department: string }>(
        'SELECT id, status, department FROM product_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (reqRows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      const req = reqRows[0];

      if (req.status !== 'Pending Approval') {
        throw Object.assign(
          new Error(`Request is "${req.status}" and cannot be approved`),
          { code: 'INVALID_STATUS', status: req.status }
        );
      }

      if (req.department.toLowerCase() !== groupName.toLowerCase()) {
        throw Object.assign(
          new Error('You can only approve requests from your functional group'),
          { code: 'WRONG_GROUP' }
        );
      }

      await client.query(
        `UPDATE product_requests
         SET status = 'Approved', director_id = $1, director_approved_at = NOW(), director_comments = $2
         WHERE id = $3`,
        [userId, comments, id]
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

    if (err.code === 'USER_NOT_FOUND' || err.code === 'REQUEST_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'INVALID_STATUS') {
      return NextResponse.json({ error: err.message, status: err.status }, { status: 409 });
    }
    if (err.code === 'NO_GROUP' || err.code === 'GROUP_NOT_FOUND' || err.code === 'WRONG_GROUP') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    console.error(`[api/requests/${id}/approve] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
  }
}
