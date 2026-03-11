import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '@/lib/db';
import { ProductFormSchema } from '@/lib/types';
import {
  PRODUCT_SELECT_SQL,
  ProductRow,
  rowToProduct,
  coerceLotDates,
  syncLotFile,
} from '@/lib/db/product-queries';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/products/[id]
// Returns a single product with all its lots (404 if not found).
// ---------------------------------------------------------------------------

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const { rows } = await query<ProductRow>(
      `${PRODUCT_SELECT_SQL} WHERE p.id = $1 GROUP BY p.id`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(rowToProduct(rows[0]));
  } catch (error) {
    console.error(`[api/products/${id}] GET error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/products/[id]
// Updates product fields and syncs its lots atomically:
//   • Lots in body whose id already exists in DB → UPDATE
//   • Lots in body whose id is new               → INSERT
//   • Lots in DB that are absent from body       → DELETE (cascade: lot_files)
// Returns the updated product with lots (404 if not found).
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Coerce ISO date strings → Date before Zod validation
  const raw = body as Record<string, unknown>;
  const toValidate = {
    ...raw,
    lots: Array.isArray(raw?.lots) ? coerceLotDates(raw.lots as unknown[]) : raw?.lots,
  };

  // PUT uses ProductFormSchema (allows quantity >= 0, lots may be empty)
  const parsed = ProductFormSchema.safeParse(toValidate);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { name, vendor, vendorPartNumber, uom, reorderThreshold, lots } = parsed.data;

  try {
    const updated = await withTransaction(async (client) => {
      // Lock the product row for the duration of the transaction so
      // concurrent PUTs to the same product are serialised
      const { rows: existing } = await client.query<{ id: string }>(
        'SELECT id FROM products WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (existing.length === 0) return null;

      // 1. Update scalar product fields
      await client.query(
        `UPDATE products
         SET name = $1, vendor = $2, vendor_part_number = $3, uom = $4, reorder_threshold = $5
         WHERE id = $6`,
        [name, vendor, vendorPartNumber, uom ?? null, reorderThreshold, id]
      );

      // 2. Fetch current lots for this product so we can diff
      const { rows: currentLots } = await client.query<{ id: string }>(
        'SELECT id FROM lots WHERE product_id = $1',
        [id]
      );
      const currentLotIds = new Set(currentLots.map((l) => l.id));
      const incomingLotIds = new Set(lots.map((l) => l.id));

      // 3. Delete removed lots (CASCADE removes their lot_files rows too)
      for (const current of currentLots) {
        if (!incomingLotIds.has(current.id)) {
          await client.query('DELETE FROM lots WHERE id = $1', [current.id]);
        }
      }

      // 4. Update existing lots / insert new lots
      for (const lot of lots) {
        if (currentLotIds.has(lot.id)) {
          // Existing lot — update all mutable fields
          await client.query(
            `UPDATE lots
             SET lot_number      = $1,
                 quantity        = $2,
                 receipt_date    = $3,
                 expiration_date = $4,
                 location        = $5,
                 notes           = $6
             WHERE id = $7`,
            [
              lot.lotNumber,
              lot.quantity,
              lot.receiptDate,
              lot.expirationDate,
              lot.location,
              lot.notes ?? null,
              lot.id,
            ]
          );
          // Sync file attachment: handles add / replace / remove
          await syncLotFile(client, lot.id, lot.file ?? null);
        } else {
          // New lot — use the client-provided UUID so the caller can
          // reference the lot by the same id it already knows about
          await client.query(
            `INSERT INTO lots
               (id, product_id, lot_number, quantity, receipt_date,
                expiration_date, location, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              lot.id ?? uuidv4(),
              id,
              lot.lotNumber,
              lot.quantity,
              lot.receiptDate,
              lot.expirationDate,
              lot.location,
              lot.notes ?? null,
            ]
          );
          if (lot.file) {
            await client.query(
              'INSERT INTO lot_files (id, lot_id, name, type) VALUES ($1, $2, $3, $4)',
              [lot.file.id, lot.id, lot.file.name, lot.file.type]
            );
          }
        }
      }

      // 5. Return the fully-joined product
      const { rows } = await client.query<ProductRow>(
        `${PRODUCT_SELECT_SQL} WHERE p.id = $1 GROUP BY p.id`,
        [id]
      );
      return rows[0] ?? null;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(rowToProduct(updated));
  } catch (error) {
    console.error(`[api/products/${id}] PUT error:`, error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/products/[id]
// Deletes the product. The DB schema cascades deletes to lots and lot_files.
// Returns 204 No Content on success, 404 if not found, 409 if the product
// has existing transaction history (RESTRICT FK prevents the delete).
// ---------------------------------------------------------------------------

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const result = await query('DELETE FROM products WHERE id = $1', [id]);

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`[api/products/${id}] DELETE error:`, error);

    // PostgreSQL error code 23503 = foreign_key_violation.
    // pg DatabaseError exposes the SQLSTATE as .code; fall back to the message
    // text in case the error is wrapped or the property is inaccessible.
    const pgCode = (error as Record<string, unknown>)?.['code'];
    const isFKViolation =
      pgCode === '23503' ||
      (error instanceof Error && error.message.includes('foreign key constraint'));
    if (isFKViolation) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this product because other records still reference it ' +
            '(transactions, requests, or fulfillments). Remove those first.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
