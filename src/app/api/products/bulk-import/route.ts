import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '@/lib/db';
import {
  PRODUCT_SELECT_SQL,
  ProductRow,
  rowToProduct,
} from '@/lib/db/product-queries';
import type { PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// POST /api/products/bulk-import
// Bulk-imports products from an Excel/CSV upload.
// Accepts an array of product objects. Missing mandatory fields get
// persistent placeholder values (e.g. LOT-1-Missing, MFR-2-Missing).
// All products are created in a single transaction.
// ---------------------------------------------------------------------------

interface ImportLot {
  lotNumber?: string;
  quantity?: number;
  receiptDate?: string;
  expirationDate?: string | null;
  location?: string;
  notes?: string;
}

interface ImportProduct {
  name?: string;
  manufacturer?: string;
  manufacturerPartNumber?: string;
  vwrPartNumber?: string;
  uom?: string;
  somApprovalRequired?: boolean;
  costPerUnit?: number | null;
  reorderThreshold?: number | null;
  lots?: ImportLot[];
}

// Query the current max counter for a given placeholder pattern.
// Pattern example: LOT-%-Missing → extracts max number from LOT-123-Missing.
async function getMaxCounter(
  client: PoolClient,
  table: string,
  column: string,
  prefix: string,
  suffix: string
): Promise<number> {
  const pattern = `${prefix}%-${suffix}`;
  const regex = `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)-${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  const { rows } = await client.query<{ max_num: string | null }>(`
    SELECT MAX(CAST(SUBSTRING(${column} FROM $1) AS INTEGER)) AS max_num
    FROM ${table}
    WHERE ${column} LIKE $2
  `, [regex, pattern]);
  return rows[0]?.max_num ? parseInt(rows[0].max_num, 10) : 0;
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { products?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.products) || body.products.length === 0) {
    return NextResponse.json({ error: 'Body must contain a non-empty "products" array' }, { status: 400 });
  }

  const products = body.products as ImportProduct[];
  const userId = request.headers.get('x-user-id') || null;

  try {
    const result = await withTransaction(async (client) => {
      // Load current max counters for all placeholder patterns
      let productNameCounter = await getMaxCounter(client, 'products', 'name', 'PRODUCT-', 'Missing');
      let mfrCounter = await getMaxCounter(client, 'products', 'manufacturer', 'MFR-', 'Missing');
      let partCounter = await getMaxCounter(client, 'products', 'manufacturer_part_number', 'PART-', 'Missing');
      let lotCounter = await getMaxCounter(client, 'lots', 'lot_number', 'LOT-', 'Missing');
      let locCounter = await getMaxCounter(client, 'lots', 'location', 'LOC-', 'Missing');

      // Compute starting product ID once, then increment in memory.
      // Lock existing rows to prevent concurrent inserts.
      await client.query('SELECT id FROM products FOR UPDATE');
      const { rows: idRows } = await client.query<{ max_num: string | null }>(`
        SELECT MAX(
          CASE
            WHEN id LIKE 'HULLC-%' THEN CAST(SUBSTRING(id FROM 6) AS INTEGER)
            WHEN id LIKE 'P%'      THEN CAST(SUBSTRING(id FROM 2) AS INTEGER)
            ELSE 0
          END
        ) AS max_num
        FROM products
      `);
      let productIdCounter = idRows[0]?.max_num ? parseInt(idRows[0].max_num, 10) : 0;

      const created: ProductRow[] = [];

      for (const product of products) {
        // Fill missing product-level mandatory fields
        const pName = (product.name && product.name.trim())
          ? product.name.trim()
          : `PRODUCT-${++productNameCounter}-Missing`;
        const pMfr = (product.manufacturer && product.manufacturer.trim())
          ? product.manufacturer.trim()
          : `MFR-${++mfrCounter}-Missing`;
        const pPart = (product.manufacturerPartNumber && product.manufacturerPartNumber.trim())
          ? product.manufacturerPartNumber.trim()
          : `PART-${++partCounter}-Missing`;

        const productId = `HULLC-${String(++productIdCounter).padStart(4, '0')}`;

        await client.query(
          `INSERT INTO products
            (id, name, manufacturer, manufacturer_part_number, vwr_part_number,
             uom, som_approval_required, cost_per_unit, reorder_threshold,
             created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [
            productId,
            pName,
            pMfr,
            pPart,
            product.vwrPartNumber?.trim() || null,
            product.uom?.trim() || null,
            product.somApprovalRequired ?? false,
            product.costPerUnit ?? null,
            product.reorderThreshold ?? null,
            userId,
          ]
        );

        // Insert lots
        const lots = product.lots ?? [];
        for (const lot of lots) {
          const lotId = uuidv4();

          // Fill missing lot-level mandatory fields
          const lotNumber = (lot.lotNumber && lot.lotNumber.trim())
            ? lot.lotNumber.trim()
            : `LOT-${++lotCounter}-Missing`;

          const location = (lot.location && lot.location.trim())
            ? lot.location.trim()
            : `LOC-${++locCounter}-Missing`;

          // receipt_date: use 1900-01-01 sentinel if missing so admins can spot and fix
          const receiptDate = lot.receiptDate
            ? new Date(lot.receiptDate)
            : new Date('1900-01-01');

          const expirationDate = lot.expirationDate
            ? new Date(lot.expirationDate)
            : null;

          await client.query(
            `INSERT INTO lots
              (id, product_id, lot_number, quantity, receipt_date,
               expiration_date, location, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              lotId,
              productId,
              lotNumber,
              lot.quantity ?? 0,
              receiptDate,
              expirationDate,
              location,
              lot.notes?.trim() || null,
            ]
          );
        }

        // Fetch the created product with lots for response
        const { rows } = await client.query<ProductRow>(
          `${PRODUCT_SELECT_SQL} WHERE p.id = $1 GROUP BY p.id`,
          [productId]
        );
        if (rows[0]) created.push(rows[0]);
      }

      return created;
    });

    return NextResponse.json(
      { created: result.length, products: result.map(rowToProduct) },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/products/bulk-import] POST error:', error);
    return NextResponse.json({ error: 'Failed to bulk-import products' }, { status: 500 });
  }
}
