import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Row type / mapper (mirrors fulfillments/route.ts)
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
// PUT body schema
// ---------------------------------------------------------------------------

const DispenseSchema = z.object({
  date: z
    .union([z.string(), z.date()])
    .transform((val) => (val instanceof Date ? val : new Date(val))),
  notes: z.string().min(1, 'Notes are required.'),
  items: z
    .array(
      z.object({
        lotId: z.string().min(1),
        quantityTaken: z.coerce.number().int().min(1),
      })
    )
    .min(1, 'At least one item is required.'),
});

// ---------------------------------------------------------------------------
// PUT /api/fulfillments/[id]
// Adds a dispense transaction to the fulfillment atomically:
//   1. Fetches and locks the fulfillment + associated request
//   2. Validates lot stock (same logic as the transactions API)
//   3. Inserts the transaction and transaction_items, decrements lot quantities
//   4. Marks the linked request as Completed
// Returns 404 if not found, 409 on insufficient stock.
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = DispenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { date, notes, items } = parsed.data;

  try {
    const updated = await withTransaction(async (client) => {
      // 1. Lock the fulfillment row
      const { rows: fRows } = await client.query<{
        id: string;
        product_id: string;
        product_name: string;
        request_id: string;
      }>(
        'SELECT id, product_id, product_name, request_id FROM fulfillments WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (fRows.length === 0) {
        throw Object.assign(new Error('Fulfillment not found'), { code: 'NOT_FOUND' });
      }

      const { product_id: productId, product_name: productName, request_id: requestId } = fRows[0];

      // 2. Fetch the request for requestorName / department snapshot (if linked)
      let requestorName: string | null = null;
      let reqDepartment: string | null = null;
      if (requestId) {
        const { rows: reqRows } = await client.query<{
          requestor_name: string;
          department: string;
        }>(
          'SELECT requestor_name, department FROM product_requests WHERE id = $1',
          [requestId]
        );
        requestorName = reqRows[0]?.requestor_name ?? null;
        reqDepartment = reqRows[0]?.department ?? null;
      }

      // 3. Lock each lot and verify sufficient stock before writing anything
      const lotData: Array<{ lotId: string; lotNumber: string; quantityTaken: number }> = [];
      for (const item of items) {
        const { rows: lots } = await client.query<{
          id: string;
          lot_number: string;
          quantity: number;
        }>(
          'SELECT id, lot_number, quantity FROM lots WHERE id = $1 AND product_id = $2 FOR UPDATE',
          [item.lotId, productId]
        );

        if (lots.length === 0) {
          throw Object.assign(
            new Error(`Lot ${item.lotId} not found for product ${productId}`),
            { code: 'LOT_NOT_FOUND' }
          );
        }

        const lot = lots[0];
        if (lot.quantity < item.quantityTaken) {
          throw Object.assign(
            new Error(
              `Insufficient stock in lot ${lot.lot_number}: ` +
                `available ${lot.quantity}, requested ${item.quantityTaken}`
            ),
            {
              code: 'INSUFFICIENT_STOCK',
              lotNumber: lot.lot_number,
              available: lot.quantity,
              requested: item.quantityTaken,
            }
          );
        }

        lotData.push({
          lotId: lot.id,
          lotNumber: lot.lot_number,
          quantityTaken: item.quantityTaken,
        });
      }

      // 4. Insert the transaction record (linked to this fulfillment)
      const totalQuantity = lotData.reduce((sum, item) => sum + item.quantityTaken, 0);
      const transactionId = uuidv4();
      const userId = request.headers.get('x-user-id') || null;

      await client.query(
        `INSERT INTO transactions
           (id, product_id, product_name, date, notes, total_quantity,
            requestor_name, department, fulfillment_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [
          transactionId, productId, productName, date, notes, totalQuantity,
          requestorName, reqDepartment, id, userId,
        ]
      );

      // 5. Insert transaction_items and decrement lot quantities
      for (const item of lotData) {
        await client.query(
          `INSERT INTO transaction_items (id, transaction_id, lot_id, lot_number, quantity, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), transactionId, item.lotId, item.lotNumber, item.quantityTaken, userId]
        );

        await client.query('UPDATE lots SET quantity = quantity - $1 WHERE id = $2', [
          item.quantityTaken,
          item.lotId,
        ]);
      }

      // 6. Mark the linked request as Completed and update audit trail
      if (requestId) {
        await client.query(
          `UPDATE product_requests SET status = 'Completed', updated_by = $2 WHERE id = $1`,
          [requestId, userId]
        );
      }

      // 7. Return the updated fulfillment with all dispensed items
      const { rows } = await client.query<FulfillmentRow>(
        `${FULFILLMENT_SELECT_SQL} WHERE f.id = $1 GROUP BY f.id`,
        [id]
      );
      return rows[0];
    });

    return NextResponse.json(rowToFulfillment(updated));
  } catch (error) {
    const err = error as Error & {
      code?: string;
      lotNumber?: string;
      available?: number;
      requested?: number;
    };

    if (err.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 });
    }
    if (err.code === 'LOT_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(
        {
          error: err.message,
          lotNumber: err.lotNumber,
          available: err.available,
          requested: err.requested,
        },
        { status: 409 }
      );
    }

    console.error(`[api/fulfillments/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to dispense items' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/fulfillments/[id]
// Cancels a fulfillment atomically:
//   • Rejects with 409 if any transactions have already been dispensed
//   • Resets the linked request status back to Pending
//   • Deletes the fulfillment record
// Returns 204 on success, 404 if not found, 409 if dispensing has occurred.
// ---------------------------------------------------------------------------

export async function DELETE(request: Request, { params }: RouteContext) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await withTransaction(async (client) => {
      // 1. Fetch and lock the fulfillment
      const { rows: fRows } = await client.query<{
        id: string;
        request_id: string | null;
      }>(
        'SELECT id, request_id FROM fulfillments WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (fRows.length === 0) return { found: false, hasTransactions: false };

      const requestId = fRows[0].request_id;

      // 2. Check whether any transactions have been dispensed
      const { rows: countRows } = await client.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM transactions WHERE fulfillment_id = $1',
        [id]
      );
      const txCount = parseInt(countRows[0].count, 10);

      if (txCount > 0) {
        return { found: true, hasTransactions: true };
      }

      // 3. Reset the linked request back to Approved (if there is one).
      //    The request was Approved before fulfillment started — restoring to
      //    "Pending Approval" would lose the director's approval.
      if (requestId) {
        await client.query(
          `UPDATE product_requests SET status = 'Approved' WHERE id = $1`,
          [requestId]
        );
      }

      // 4. Delete the fulfillment
      await client.query('DELETE FROM fulfillments WHERE id = $1', [id]);

      return { found: true, hasTransactions: false };
    });

    if (!result.found) {
      return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 });
    }

    if (result.hasTransactions) {
      return NextResponse.json(
        {
          error:
            'Cannot cancel a fulfillment that has already dispensed items. ' +
            'Reverse the transactions first.',
        },
        { status: 409 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`[api/fulfillments/${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Failed to cancel fulfillment' }, { status: 500 });
  }
}
