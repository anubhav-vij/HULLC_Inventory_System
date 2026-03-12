import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';

// ---------------------------------------------------------------------------
// Row type returned by the joined SELECT
// ---------------------------------------------------------------------------

interface TransactionRow {
  id: string;
  product_id: string;
  product_name: string;
  date: Date;
  notes: string;
  total_quantity: number;
  requestor_name: string | null;
  department: string | null;
  fulfillment_id: string | null;
  items: Array<{ lotId: string; lotNumber: string; quantity: number }>;
}

const TRANSACTION_SELECT_SQL = `
  SELECT
    t.id,
    t.product_id,
    t.product_name,
    t.date,
    t.notes,
    t.total_quantity,
    t.requestor_name,
    t.department,
    t.fulfillment_id,
    COALESCE(
      json_agg(
        json_build_object(
          'lotId',     ti.lot_id,
          'lotNumber', ti.lot_number,
          'quantity',  ti.quantity
        ) ORDER BY ti.created_at
      ) FILTER (WHERE ti.id IS NOT NULL),
      '[]'
    ) AS items
  FROM transactions t
  LEFT JOIN transaction_items ti ON ti.transaction_id = t.id`;

function rowToTransaction(row: TransactionRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    date: row.date,
    notes: row.notes,
    totalQuantity: row.total_quantity,
    requestorName: row.requestor_name ?? undefined,
    department: row.department ?? undefined,
    fulfillmentId: row.fulfillment_id ?? undefined,
    items: row.items ?? [],
  };
}

// ---------------------------------------------------------------------------
// POST body schema
// ---------------------------------------------------------------------------

const CreateTransactionSchema = z.object({
  productId: z.string().min(1, 'Product ID is required.'),
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
  requestorName: z.string().optional(),
  department: z.string().optional(),
  fulfillmentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/transactions
// Returns all transactions with their items, optionally filtered by productId.
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  try {
    const params: unknown[] = [];
    let sql = TRANSACTION_SELECT_SQL;

    if (productId) {
      params.push(productId);
      sql += ` WHERE t.product_id = $1`;
    }

    sql += ` GROUP BY t.id ORDER BY t.date DESC`;

    const { rows } = await query<TransactionRow>(sql, params);
    return NextResponse.json(rows.map(rowToTransaction));
  } catch (error) {
    console.error('[api/transactions] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/transactions
// Creates a dispense transaction atomically. Validates lot quantities before
// deducting. Returns 409 if any lot has insufficient stock.
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { productId, date, notes, items, requestorName, department, fulfillmentId } = parsed.data;
  const userId = request.headers.get('x-user-id') || null;

  try {
    const created = await withTransaction(async (client) => {
      // 1. Lock the product row and grab the denormalized name snapshot
      const { rows: products } = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );
      if (products.length === 0) {
        throw Object.assign(new Error('Product not found'), { code: 'PRODUCT_NOT_FOUND' });
      }
      const productName = products[0].name;

      // 2. Lock each lot row and verify sufficient stock before touching anything
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

      // 3. Sum total quantity
      const totalQuantity = lotData.reduce((sum, item) => sum + item.quantityTaken, 0);

      // 4. Insert the transaction record
      const transactionId = uuidv4();
      await client.query(
        `INSERT INTO transactions
           (id, product_id, product_name, date, notes, total_quantity,
            requestor_name, department, fulfillment_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [
          transactionId,
          productId,
          productName,
          date,
          notes,
          totalQuantity,
          requestorName ?? null,
          department ?? null,
          fulfillmentId ?? null,
          userId,
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

      // 6. Return the fully-joined transaction
      const { rows } = await client.query<TransactionRow>(
        `${TRANSACTION_SELECT_SQL} WHERE t.id = $1 GROUP BY t.id`,
        [transactionId]
      );
      return rows[0];
    });

    return NextResponse.json(rowToTransaction(created), { status: 201 });
  } catch (error) {
    const err = error as Error & {
      code?: string;
      lotNumber?: string;
      available?: number;
      requested?: number;
    };

    if (err.code === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
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

    console.error('[api/transactions] POST error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
