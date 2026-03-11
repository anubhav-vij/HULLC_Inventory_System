import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';

// ---------------------------------------------------------------------------
// Row types / mapper
// ---------------------------------------------------------------------------

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
  request_number: number | null;
  request_id: string | null;
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

function rowToRequest(row: RequestRow) {
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
    somApprovalStatus: (row as any).som_approval_status ?? null,
    sciopsDirectorApprovedAt: (row as any).sciops_director_approved_at ? (row as any).sciops_director_approved_at.toISOString() : null,
    sciopsDirectorApprovedBy: (row as any).sciops_director_approved_by ?? null,
    somApprovalRequired: (row as any).som_approval_required ?? false,
    manufacturerPartNumber: (row as any).product_manufacturer_part_number ?? null,
    uom: (row as any).product_uom ?? null,
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

// ---------------------------------------------------------------------------
// POST body schema
// ---------------------------------------------------------------------------

const LineItemInputSchema = z.object({
  requestedDate: z.string().min(1),
  quantity: z.coerce.number().min(1),
});

const CreateRequestSchema = z.object({
  productId: z.string().min(1, 'Product ID is required.'),
  productName: z.string().min(1, 'Product name is required.'),
  requestorName: z.string().min(1),
  requestorEmail: z.string().email(),
  department: z.string().min(1),
  project: z.string().optional(),
  justification: z.string().min(1),
  sopRead: z.boolean(),
  lineItems: z.array(LineItemInputSchema).min(1),
});

// ---------------------------------------------------------------------------
// GET /api/requests
// Role-aware: Admin sees Approved/In Progress/Completed/Rejected,
// Director sees Pending Approval for their group, Staff sees own requests.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') ?? '';
  const userEmail = request.headers.get('x-user-email') ?? '';

  try {
    let whereClause = '';
    const params: unknown[] = [];

    if (role === 'Admin') {
      // Admin sees everything except Pending Approval and Pending SciOps (those go to Directors)
      whereClause = "WHERE pr.status IN ('Approved', 'Pending SciOps Approval', 'In Progress', 'Completed', 'Rejected')";
    } else if (role === 'Director') {
      // Director sees Pending Approval requests for their functional group
      // Sci-Ops Director also sees Pending SciOps Approval requests
      if (userId) {
        const { rows: userRows } = await query<{ functional_group_id: string }>(
          'SELECT functional_group_id FROM users WHERE id = $1',
          [userId]
        );
        if (userRows.length > 0 && userRows[0].functional_group_id) {
          const fgId = userRows[0].functional_group_id;
          const { rows: groupRows } = await query<{ name: string }>(
            'SELECT name FROM functional_groups WHERE id = $1',
            [fgId]
          );
          if (groupRows.length > 0) {
            const groupName = groupRows[0].name;
            const isSciOps = groupName === 'Scientific Operations';
            params.push(groupName);
            if (isSciOps) {
              // Sci-Ops Director sees own group's Pending Approval AND all Pending SciOps Approval
              whereClause = "WHERE (pr.status = 'Pending Approval' AND LOWER(pr.department) = LOWER($1)) OR pr.status = 'Pending SciOps Approval'";
            } else {
              whereClause = "WHERE pr.status = 'Pending Approval' AND LOWER(pr.department) = LOWER($1)";
            }
          } else {
            whereClause = "WHERE 1=0";
          }
        } else {
          whereClause = "WHERE 1=0";
        }
      } else {
        whereClause = "WHERE 1=0";
      }
    } else {
      // Staff sees their own requests by email
      if (userEmail) {
        params.push(userEmail);
        whereClause = 'WHERE pr.requestor_email = $1';
      } else if (userId) {
        const { rows: userRows } = await query<{ email: string }>(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        if (userRows.length > 0) {
          params.push(userRows[0].email);
          whereClause = 'WHERE pr.requestor_email = $1';
        } else {
          whereClause = 'WHERE 1=0';
        }
      } else {
        whereClause = 'WHERE 1=0';
      }
    }

    const sql = `
      SELECT
        pr.*,
        COALESCE(p_prod.som_approval_required, false) AS som_approval_required,
        p_prod.manufacturer_part_number AS product_manufacturer_part_number,
        p_prod.uom AS product_uom,
        ${LINE_ITEMS_SUBQUERY}
      FROM product_requests pr
      LEFT JOIN request_line_items rli ON rli.request_id = pr.id
      LEFT JOIN products p_prod ON p_prod.id = pr.product_id
      ${whereClause}
      GROUP BY pr.id, p_prod.som_approval_required, p_prod.manufacturer_part_number, p_prod.uom
      ORDER BY pr.date DESC
    `;

    const { rows } = await query<RequestRow>(sql, params);
    return NextResponse.json(rows.map(rowToRequest));
  } catch (error) {
    console.error('[api/requests] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/requests
// Creates a new product request with status Pending Approval + line items.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const {
    productId, productName,
    requestorName, requestorEmail,
    department, project, justification, sopRead, lineItems,
  } = parsed.data;

  // Server-side date validation: all requested dates must be today or in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const li of lineItems) {
    const d = new Date(li.requestedDate);
    if (d < today) {
      return NextResponse.json(
        { error: 'All requested dates must be today or in the future.' },
        { status: 422 }
      );
    }
  }

  try {
    const result = await withTransaction(async (client) => {
      // Verify product exists
      const { rows: products } = await client.query<{ id: string }>(
        'SELECT id FROM products WHERE id = $1',
        [productId]
      );
      if (products.length === 0) {
        throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND' });
      }

      const requestId = uuidv4();
      await client.query(
        `INSERT INTO product_requests
           (id, product_id, product_name, requestor_name, requestor_email,
            department, project, justification, sop_read, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending Approval')`,
        [requestId, productId, productName, requestorName, requestorEmail,
         department, project ?? null, justification, sopRead]
      );

      // Insert line items
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO request_line_items (id, request_id, requested_date, quantity)
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), requestId, li.requestedDate, li.quantity]
        );
      }

      // Generate HULLC-YYYY-XXXX request ID
      const year = new Date().getFullYear();
      const { rows: seqRows } = await client.query<{ last_number: number }>(
        `INSERT INTO request_id_sequences (year, last_number)
         VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE SET last_number = request_id_sequences.last_number + 1
         RETURNING last_number`,
        [year]
      );
      const lastNumber = seqRows[0].last_number;
      const hullcRequestId = `HULLC-${year}-${String(lastNumber).padStart(4, '0')}`;
      await client.query(
        `UPDATE product_requests SET request_number = $1, request_id = $2 WHERE id = $3`,
        [lastNumber, hullcRequestId, requestId]
      );

      // Fetch the created request with line items
      const { rows } = await client.query<RequestRow>(
        `SELECT pr.*, ${LINE_ITEMS_SUBQUERY}
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id`,
        [requestId]
      );
      return rows[0];
    });

    return NextResponse.json(rowToRequest(result), { status: 201 });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    console.error('[api/requests] POST error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
