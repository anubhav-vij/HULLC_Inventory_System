import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '@/lib/db';
import { ProductRequestFormSchema } from '@/lib/types';

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
// POST body schema — form fields + productId / productName
// ---------------------------------------------------------------------------

const CreateRequestSchema = ProductRequestFormSchema.extend({
  productId: z.string().min(1, 'Product ID is required.'),
  productName: z.string().min(1, 'Product name is required.'),
});

// ---------------------------------------------------------------------------
// GET /api/requests
// Returns all product requests ordered by submission date descending.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const { rows } = await query<RequestRow>(
      'SELECT * FROM product_requests ORDER BY date DESC'
    );
    return NextResponse.json(rows.map(rowToRequest));
  } catch (error) {
    console.error('[api/requests] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/requests
// Creates a new product request with status Pending.
// Returns 404 if the referenced product does not exist.
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
    department, quantity, project, justification, sopRead,
  } = parsed.data;

  try {
    // Verify the product exists before creating the request
    const { rows: products } = await query<{ id: string }>(
      'SELECT id FROM products WHERE id = $1',
      [productId]
    );
    if (products.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const id = uuidv4();
    const { rows } = await query<RequestRow>(
      `INSERT INTO product_requests
         (id, product_id, product_name, requestor_name, requestor_email,
          department, quantity, project, justification, sop_read, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending')
       RETURNING *`,
      [
        id, productId, productName,
        requestorName, requestorEmail,
        department, quantity, project, justification, sopRead,
      ]
    );

    return NextResponse.json(rowToRequest(rows[0]), { status: 201 });
  } catch (error) {
    console.error('[api/requests] POST error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
