import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { LINE_ITEMS_SUBQUERY, RequestRow, rowToRequest } from '@/lib/db/request-queries';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PUT /api/requests/[id]/approve
// Director approves a Pending Approval request for their functional group.
// Admin can approve any request (override for OOO Directors).
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';

  if (role !== 'Director' && role !== 'Admin') {
    return NextResponse.json({ error: 'Only Directors and Admins can approve requests' }, { status: 403 });
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
      // Verify the approving user exists
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

      const approver = userRows[0];

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

      // Directors can only approve requests from their own functional group.
      // Admins can approve any request (override for OOO Directors).
      if (role === 'Director') {
        if (!approver.functional_group_id) {
          throw Object.assign(new Error('Director has no functional group assigned'), { code: 'NO_GROUP' });
        }

        const { rows: groupRows } = await client.query<{ name: string }>(
          'SELECT name FROM functional_groups WHERE id = $1',
          [approver.functional_group_id]
        );

        if (groupRows.length === 0) {
          throw Object.assign(new Error('Functional group not found'), { code: 'GROUP_NOT_FOUND' });
        }

        if (req.department.toLowerCase() !== groupRows[0].name.toLowerCase()) {
          throw Object.assign(
            new Error('You can only approve requests from your functional group'),
            { code: 'WRONG_GROUP' }
          );
        }
      }

      // Check if the product requires SOM approval
      const { rows: productRows } = await client.query<{ som_approval_required: boolean }>(
        'SELECT som_approval_required FROM products WHERE id = (SELECT product_id FROM product_requests WHERE id = $1)',
        [id]
      );
      const somRequired = productRows.length > 0 && productRows[0].som_approval_required;
      const newStatus = somRequired ? 'Pending SciOps Approval' : 'Approved';

      await client.query(
        `UPDATE product_requests
         SET status = $1, director_id = $2, director_approved_at = NOW(), director_comments = $3,
             som_approval_status = CASE WHEN $4 THEN 'pending' ELSE som_approval_status END,
             updated_by = $2
         WHERE id = $5`,
        [newStatus, userId, comments, somRequired, id]
      );

      // Reserve stock when transitioning to Approved (not SciOps pending)
      if (newStatus === 'Approved') {
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
      }

      // Log status change
      const approverName = (await client.query<{full_name: string}>('SELECT full_name FROM users WHERE id = $1', [userId])).rows[0]?.full_name ?? 'Unknown';
      await client.query(
        `INSERT INTO request_status_history (request_id, from_status, to_status, changed_by, changed_by_name, comments)
         VALUES ($1, 'Pending Approval', $2, $3, $4, $5)`,
        [id, newStatus, userId, approverName, comments ?? (newStatus === 'Pending SciOps Approval' ? 'Director approved — forwarded for SciOps review' : 'Director approved')]
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
