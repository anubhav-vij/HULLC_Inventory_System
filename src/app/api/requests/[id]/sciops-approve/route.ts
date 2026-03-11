import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/requests/[id]/sciops-approve
// Sci-Ops Director approves a Pending SciOps Approval request.
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director') {
    return NextResponse.json({ error: 'Only Directors can approve SciOps requests' }, { status: 403 });
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
      // Verify user is the Sci-Ops Director
      const { rows: userRows } = await client.query<{
        id: string;
        functional_group_id: string | null;
      }>(
        'SELECT id, functional_group_id FROM users WHERE id = $1',
        [userId]
      );

      if (userRows.length === 0) {
        throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
      }

      const director = userRows[0];
      if (!director.functional_group_id) {
        throw Object.assign(new Error('Director has no functional group'), { code: 'NO_GROUP' });
      }

      // Check that this director belongs to "Scientific Operations"
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
             sciops_director_approved_by = $1
         WHERE id = $2`,
        [userId, id]
      );

      const { rows: full } = await client.query(
        `SELECT pr.*,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', rli.id, 'requestId', rli.request_id,
                 'requestedDate', to_char(rli.requested_date, 'YYYY-MM-DD'),
                 'quantity', rli.quantity, 'status', rli.status,
                 'fulfilledQuantity', rli.fulfilled_quantity,
                 'fulfillmentId', rli.fulfillment_id
               ) ORDER BY rli.requested_date
             ) FILTER (WHERE rli.id IS NOT NULL), '[]'
           ) AS line_items
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id`,
        [id]
      );

      return full[0];
    });

    return NextResponse.json(mapRow(result));
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

function mapRow(row: any) {
  return {
    id: row.id,
    requestId: row.request_id ?? undefined,
    requestNumber: row.request_number ?? undefined,
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
    somApprovalStatus: row.som_approval_status ?? null,
    sciopsDirectorApprovedAt: row.sciops_director_approved_at ? row.sciops_director_approved_at.toISOString() : null,
    sciopsDirectorApprovedBy: row.sciops_director_approved_by ?? null,
    date: row.date,
    lineItems: (row.line_items ?? []).map((li: any) => ({
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
