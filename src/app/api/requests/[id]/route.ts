import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { ProductRequestStatusSchema } from '@/lib/types';
import { LINE_ITEMS_SUBQUERY, RequestRow, rowToRequest } from '@/lib/db/request-queries';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Pending Approval': ['Approved', 'Pending SciOps Approval', 'Rejected'],
  'Pending SciOps Approval': ['Approved', 'Rejected'],
  'Approved':         ['In Progress', 'Rejected'],
  'In Progress':      ['Completed', 'Rejected'],
  'Completed':        [],
  'Rejected':         [],
};

// ---------------------------------------------------------------------------
// PUT body schema
// ---------------------------------------------------------------------------

const UpdateStatusSchema = z
  .object({
    status: ProductRequestStatusSchema,
    rejectionNote: z.string().min(1).optional(),
  })
  .refine(
    (data) => data.status !== 'Rejected' || !!data.rejectionNote,
    {
      message: 'rejectionNote is required when rejecting a request',
      path: ['rejectionNote'],
    }
  );

// ---------------------------------------------------------------------------
// GET /api/requests/[id]
// ---------------------------------------------------------------------------

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const { rows } = await query<RequestRow>(
      `SELECT pr.*,
              COALESCE(p_prod.som_approval_required, false) AS som_approval_required,
              p_prod.manufacturer_part_number AS product_manufacturer_part_number,
              p_prod.uom AS product_uom,
              ${LINE_ITEMS_SUBQUERY}
       FROM product_requests pr
       LEFT JOIN request_line_items rli ON rli.request_id = pr.id
       LEFT JOIN products p_prod ON p_prod.id = pr.product_id
       WHERE pr.id = $1
       GROUP BY pr.id, p_prod.som_approval_required, p_prod.manufacturer_part_number, p_prod.uom`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json(rowToRequest(rows[0]));
  } catch (error) {
    console.error(`[api/requests/${id}] GET error:`, error);
    return NextResponse.json({ error: 'Failed to fetch request' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/requests/[id]
// General status update with transition validation.
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { status: newStatus, rejectionNote } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query<RequestRow>(
        `SELECT pr.*, ${LINE_ITEMS_SUBQUERY}
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id
         FOR UPDATE OF pr`,
        [id]
      );
      if (rows.length === 0) return null;

      const currentStatus = rows[0].status;
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

      if (!allowed.includes(newStatus)) {
        throw Object.assign(
          new Error(`Cannot transition from "${currentStatus}" to "${newStatus}"`),
          { code: 'INVALID_TRANSITION', currentStatus, newStatus }
        );
      }

      const updatedBy = request.headers.get('x-user-id') || null;
      const { rows: updated } = await client.query<RequestRow>(
        `UPDATE product_requests
         SET status = $1, rejection_note = COALESCE($2, rejection_note), updated_by = COALESCE($3, updated_by)
         WHERE id = $4
         RETURNING *`,
        [newStatus, rejectionNote ?? null, updatedBy, id]
      );

      // Re-fetch with line items
      const { rows: full } = await client.query<RequestRow>(
        `SELECT pr.*, ${LINE_ITEMS_SUBQUERY}
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id`,
        [updated[0].id]
      );

      return full[0];
    });

    if (!result) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json(rowToRequest(result));
  } catch (error) {
    const err = error as Error & {
      code?: string;
      currentStatus?: string;
      newStatus?: string;
    };

    if (err.code === 'INVALID_TRANSITION') {
      return NextResponse.json(
        { error: err.message, currentStatus: err.currentStatus, newStatus: err.newStatus },
        { status: 409 }
      );
    }

    console.error(`[api/requests/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/requests/[id]
// Only allowed when status is Pending Approval or Rejected.
// ---------------------------------------------------------------------------

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM product_requests WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (rows.length === 0) return { found: false, deletable: false, status: '' };

      const { status } = rows[0];

      if (status === 'In Progress' || status === 'Approved' || status === 'Completed' || status === 'Pending SciOps Approval') {
        return { found: true, deletable: false, status };
      }

      await client.query('DELETE FROM product_requests WHERE id = $1', [id]);
      return { found: true, deletable: true, status };
    });

    if (!result.found) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!result.deletable) {
      return NextResponse.json(
        {
          error: `Cannot delete a request with status "${result.status}". ` +
            'Only Pending Approval or Rejected requests can be deleted.',
        },
        { status: 409 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`[api/requests/${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}
