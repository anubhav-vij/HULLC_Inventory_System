import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { ProductRequestStatusSchema } from '@/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Row type / mapper
// ---------------------------------------------------------------------------

interface RequestRow {
  id: string;
  product_id: string;
  product_name: string;
  requestor_name: string;
  requestor_email: string;
  department: string;
  quantity: number;
  project: string;
  justification: string;
  sop_read: boolean;
  status: string;
  rejection_note: string | null;
  date: Date;
}

function rowToRequest(row: RequestRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    requestorName: row.requestor_name,
    requestorEmail: row.requestor_email,
    department: row.department,
    quantity: row.quantity,
    project: row.project,
    justification: row.justification,
    sopRead: row.sop_read,
    status: row.status,
    rejectionNote: row.rejection_note ?? undefined,
    date: row.date,
  };
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  'Pending':     ['In Progress', 'Rejected'],
  'In Progress': ['Completed'],
  'Completed':   [],
  'Rejected':    [],
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
// Returns a single product request. 404 if not found.
// ---------------------------------------------------------------------------

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const { rows } = await query<RequestRow>(
      'SELECT * FROM product_requests WHERE id = $1',
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
// Updates request status. Enforces valid state transitions.
// Returns 404 if not found, 409 if transition is invalid.
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
      // Lock the row for the duration of the status check + update
      const { rows } = await client.query<RequestRow>(
        'SELECT * FROM product_requests WHERE id = $1 FOR UPDATE',
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

      const { rows: updated } = await client.query<RequestRow>(
        `UPDATE product_requests
         SET status = $1, rejection_note = $2
         WHERE id = $3
         RETURNING *`,
        [newStatus, rejectionNote ?? null, id]
      );

      return updated[0];
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
        {
          error: err.message,
          currentStatus: err.currentStatus,
          newStatus: err.newStatus,
        },
        { status: 409 }
      );
    }

    console.error(`[api/requests/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/requests/[id]
// Deletes a request. Only allowed when status is Pending or Rejected.
// Returns 409 if In Progress or Completed, 404 if not found, 204 on success.
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

      if (status === 'In Progress' || status === 'Completed') {
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
            'Only Pending or Rejected requests can be deleted.',
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
