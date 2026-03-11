/**
 * Shared SQL, row types, and mappers for the products API.
 * Imported by both /api/products/route.ts and /api/products/[id]/route.ts.
 */

import type { PoolClient } from 'pg';
import type { Product, Lot, LotFile } from '@/lib/types';

// ---------------------------------------------------------------------------
// DB row shapes (what pg returns from the json_agg query)
// ---------------------------------------------------------------------------

// The lots column is a JSON array built by json_build_object — keys are
// already camelCase so the mapper below is straightforward.
export type LotJsonRow = {
  id: string;
  lotNumber: string;
  quantity: number;
  // Dates come back as ISO strings inside the JSON blob
  receiptDate: string;
  expirationDate: string | null;
  location: string;
  notes: string | null;
  file: { id: string; name: string; type: string } | null;
};

export type ProductRow = {
  id: string;
  name: string;
  vendor: string;
  vendor_part_number: string;
  uom: string | null;
  reorder_threshold: number | null;
  // json_agg produces a parsed JS array because pg auto-parses JSON columns
  lots: LotJsonRow[];
};

// ---------------------------------------------------------------------------
// Base SELECT — append WHERE / GROUP BY / ORDER BY in callers
// ---------------------------------------------------------------------------
// Using json_build_object with camelCase keys keeps the mapper trivial.
// FILTER (WHERE l.id IS NOT NULL) prevents a [null] array when a product
// has no lots yet (result of the LEFT JOIN producing a null row).
// ---------------------------------------------------------------------------

export const PRODUCT_SELECT_SQL = `
  SELECT
    p.id,
    p.name,
    p.vendor,
    p.vendor_part_number,
    p.uom,
    p.reorder_threshold,
    COALESCE(
      json_agg(
        json_build_object(
          'id',             l.id,
          'lotNumber',      l.lot_number,
          'quantity',       l.quantity,
          'receiptDate',    l.receipt_date,
          'expirationDate', l.expiration_date,
          'location',       l.location,
          'notes',          l.notes,
          'file', CASE
            WHEN lf.id IS NOT NULL
              THEN json_build_object('id', lf.id, 'name', lf.name, 'type', lf.type)
            ELSE NULL
          END
        ) ORDER BY l.created_at
      ) FILTER (WHERE l.id IS NOT NULL),
      '[]'::json
    ) AS lots
  FROM products p
  LEFT JOIN lots l ON l.product_id = p.id
  LEFT JOIN lot_files lf ON lf.lot_id = l.id
`;

// ---------------------------------------------------------------------------
// Row → Product mapper
// ---------------------------------------------------------------------------

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor,
    vendorPartNumber: row.vendor_part_number,
    uom: row.uom ?? undefined,
    reorderThreshold: row.reorder_threshold,
    lots: row.lots.map((lot): Lot => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      quantity: lot.quantity,
      // Dates arrive as ISO strings inside the JSON blob — convert to Date
      receiptDate: new Date(lot.receiptDate),
      expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
      location: lot.location,
      // DB null → undefined to match Lot.notes?: string
      notes: lot.notes ?? undefined,
      file: lot.file as LotFile | null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Date coercion for request bodies
// ---------------------------------------------------------------------------
// Zod's z.date() expects a Date object, but JSON bodies carry ISO strings.
// Preprocess each lot before passing to safeParse.

export function coerceLotDates(lots: unknown[]): unknown[] {
  return (lots as Record<string, unknown>[]).map((lot) => ({
    ...lot,
    receiptDate: lot.receiptDate ? new Date(lot.receiptDate as string) : undefined,
    expirationDate: lot.expirationDate ? new Date(lot.expirationDate as string) : null,
  }));
}

// ---------------------------------------------------------------------------
// Next product ID — must run inside a transaction
// ---------------------------------------------------------------------------
// FOR UPDATE locks the last row so concurrent POSTs cannot generate the
// same ID. The lock is released when the transaction commits or rolls back.

export async function generateNextProductId(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM products ORDER BY id DESC LIMIT 1 FOR UPDATE'
  );
  if (rows.length === 0) return 'P001';
  const lastNum = parseInt(rows[0].id.substring(1), 10);
  return `P${String(lastNum + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Sync a lot's file record — used by PUT when updating existing lots
// ---------------------------------------------------------------------------
// Three cases:
//   • no old file, no new file → nothing to do
//   • same file id → nothing to do (file unchanged)
//   • any other combination → delete old record (if any), insert new (if any)
// Note: this only manages the lot_files row. The binary in object storage
// must be cleaned up separately by the caller if a file was removed.

export async function syncLotFile(
  client: PoolClient,
  lotId: string,
  newFile: LotFile | null
): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM lot_files WHERE lot_id = $1',
    [lotId]
  );
  const existingFileId = rows[0]?.id ?? null;

  // Nothing changed
  if (existingFileId === null && newFile === null) return;
  if (existingFileId !== null && newFile !== null && existingFileId === newFile.id) return;

  if (existingFileId !== null) {
    await client.query('DELETE FROM lot_files WHERE lot_id = $1', [lotId]);
  }
  if (newFile !== null) {
    await client.query(
      'INSERT INTO lot_files (id, lot_id, name, type) VALUES ($1, $2, $3, $4)',
      [newFile.id, lotId, newFile.name, newFile.type]
    );
  }
}
