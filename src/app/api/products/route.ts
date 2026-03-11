import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '@/lib/db';
import { ProductFormCreateSchema } from '@/lib/types';
import {
  PRODUCT_SELECT_SQL,
  ProductRow,
  rowToProduct,
  coerceLotDates,
  generateNextProductId,
} from '@/lib/db/product-queries';

// ---------------------------------------------------------------------------
// GET /api/products
// Returns all products with their lots, ordered by product id (P001, P002…)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { rows } = await query<ProductRow>(
      `${PRODUCT_SELECT_SQL} GROUP BY p.id ORDER BY p.id`
    );
    return NextResponse.json(rows.map(rowToProduct));
  } catch (error) {
    console.error('[api/products] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/products
// Creates a product and its initial lots atomically.
// Server generates a P001-format product id and a UUID for every lot.
// Returns the created product with lots (201).
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Parse body
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

  const parsed = ProductFormCreateSchema.safeParse(toValidate);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { name, vendor, vendorPartNumber, uom, reorderThreshold, lots } = parsed.data;

  try {
    const created = await withTransaction(async (client) => {
      // Generate next sequential product id atomically (FOR UPDATE prevents
      // two concurrent POSTs from receiving the same id)
      const productId = await generateNextProductId(client);

      await client.query(
        `INSERT INTO products (id, name, vendor, vendor_part_number, uom, reorder_threshold)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [productId, name, vendor, vendorPartNumber, uom ?? null, reorderThreshold]
      );

      // Insert each lot with a server-generated UUID
      for (const lot of lots) {
        const lotId = uuidv4();

        await client.query(
          `INSERT INTO lots
             (id, product_id, lot_number, quantity, receipt_date,
              expiration_date, location, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            lotId,
            productId,
            lot.lotNumber,
            lot.quantity,
            lot.receiptDate,
            lot.expirationDate,
            lot.location,
            lot.notes ?? null,
          ]
        );

        // If the client pre-uploaded a file, record its metadata
        if (lot.file) {
          await client.query(
            'INSERT INTO lot_files (id, lot_id, name, type) VALUES ($1, $2, $3, $4)',
            [lot.file.id, lotId, lot.file.name, lot.file.type]
          );
        }
      }

      // Return the fully-joined product so the caller gets real lot ids back
      const { rows } = await client.query<ProductRow>(
        `${PRODUCT_SELECT_SQL} WHERE p.id = $1 GROUP BY p.id`,
        [productId]
      );
      return rows[0];
    });

    return NextResponse.json(rowToProduct(created), { status: 201 });
  } catch (error) {
    console.error('[api/products] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
