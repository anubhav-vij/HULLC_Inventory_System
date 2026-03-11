import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';

// ---------------------------------------------------------------------------
// Row type / mapper
// ---------------------------------------------------------------------------

interface FulfillmentRow {
  id: string;
  request_id: string | null;
  product_id: string;
  product_name: string;
  department: string;
  total_quantity_requested: number;
  dispensed_items: Array<{
    id: string;
    productId: string;
    productName: string;
    date: string;
    notes: string;
    totalQuantity: number;
    requestorName: string | null;
    department: string | null;
    fulfillmentId: string;
    items: Array<{ lotId: string; lotNumber: string; quantity: number }>;
  }>;
}

// Fetches fulfillments joined with their dispensed transactions and line items.
const FULFILLMENT_SELECT_SQL = `
  SELECT
    f.id,
    f.request_id,
    f.product_id,
    f.product_name,
    f.department,
    f.total_quantity_requested,
    COALESCE(
      json_agg(
        json_build_object(
          'id',            t.id,
          'productId',     t.product_id,
          'productName',   t.product_name,
          'date',          t.date,
          'notes',         t.notes,
          'totalQuantity', t.total_quantity,
          'requestorName', t.requestor_name,
          'department',    t.department,
          'fulfillmentId', t.fulfillment_id,
          'items', (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'lotId',     ti.lot_id,
                  'lotNumber', ti.lot_number,
                  'quantity',  ti.quantity
                ) ORDER BY ti.created_at
              ),
              '[]'::json
            )
            FROM transaction_items ti
            WHERE ti.transaction_id = t.id
          )
        ) ORDER BY t.date
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'
    ) AS dispensed_items
  FROM fulfillments f
  LEFT JOIN transactions t ON t.fulfillment_id = f.id`;

function rowToFulfillment(row: FulfillmentRow) {
  return {
    id: row.id,
    requestId: row.request_id ?? null,
    productId: row.product_id,
    productName: row.product_name,
    department: row.department,
    totalQuantityRequested: row.total_quantity_requested,
    dispensedItems: row.dispensed_items ?? [],
  };
}

// ---------------------------------------------------------------------------
// POST body schema
// ---------------------------------------------------------------------------

const CreateFulfillmentSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required.'),
});

// ---------------------------------------------------------------------------
// GET /api/fulfillments
// Returns all fulfillments with their dispensed transactions.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { rows } = await query<FulfillmentRow>(
      `${FULFILLMENT_SELECT_SQL} GROUP BY f.id ORDER BY f.created_at DESC`
    );
    return NextResponse.json(rows.map(rowToFulfillment));
  } catch (error) {
    console.error('[api/fulfillments] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch fulfillments' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/fulfillments
// Creates a fulfillment for a Pending (or In Progress) request atomically:
//   1. Validates the request exists and is actionable
//   2. Checks no fulfillment exists yet for this request
//   3. Creates the fulfillment record
//   4. Advances the request status to In Progress
// Returns 404 if the request is not found, 409 on any constraint violation.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateFulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { requestId } = parsed.data;
  const userId = request.headers.get('x-user-id') || null;

  try {
    const created = await withTransaction(async (client) => {
      // 1. Fetch and lock the product request
      const { rows: reqRows } = await client.query<{
        id: string;
        product_id: string;
        product_name: string;
        department: string;
        status: string;
      }>(
        `SELECT id, product_id, product_name, department, status
         FROM product_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      if (reqRows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      const req = reqRows[0];

      if (req.status !== 'Approved' && req.status !== 'In Progress') {
        throw Object.assign(
          new Error(`Request is "${req.status}" and cannot be fulfilled`),
          { code: 'INVALID_REQUEST_STATUS', status: req.status }
        );
      }

      // 2. Create the fulfillment record (legacy flow - no line item link)
      const fulfillmentId = uuidv4();
      await client.query(
        `INSERT INTO fulfillments
           (id, request_id, product_id, product_name, department, total_quantity_requested, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          fulfillmentId, requestId,
          req.product_id, req.product_name,
          req.department, 0, userId,
        ]
      );

      // 3. Advance request to In Progress (idempotent if already there)
      await client.query(
        `UPDATE product_requests SET status = 'In Progress' WHERE id = $1`,
        [requestId]
      );

      // Return the newly created fulfillment
      const { rows } = await client.query<FulfillmentRow>(
        `${FULFILLMENT_SELECT_SQL} WHERE f.id = $1 GROUP BY f.id`,
        [fulfillmentId]
      );
      return rows[0];
    });

    return NextResponse.json(rowToFulfillment(created), { status: 201 });
  } catch (error) {
    const err = error as Error & {
      code?: string;
      status?: string;
      fulfillmentId?: string;
    };

    if (err.code === 'REQUEST_NOT_FOUND') {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    if (err.code === 'INVALID_REQUEST_STATUS') {
      return NextResponse.json(
        { error: err.message, status: err.status },
        { status: 409 }
      );
    }
    if (err.code === 'FULFILLMENT_EXISTS') {
      return NextResponse.json(
        { error: err.message, fulfillmentId: err.fulfillmentId },
        { status: 409 }
      );
    }

    console.error('[api/fulfillments] POST error:', error);
    return NextResponse.json({ error: 'Failed to create fulfillment' }, { status: 500 });
  }
}
