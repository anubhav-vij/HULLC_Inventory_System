import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string; lineItemId: string }> };

const DispenseItemSchema = z.object({
  lotId: z.string().min(1),
  quantityTaken: z.coerce.number().min(1),
});

const FulfillLineItemSchema = z.object({
  date: z.string().min(1),
  notes: z.string().min(1),
  items: z.array(DispenseItemSchema).min(1),
});

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
// PUT /api/requests/[id]/line-items/[lineItemId]
// Admin only: fulfill a specific line item by dispensing lots.
// ---------------------------------------------------------------------------

export async function PUT(request: Request, { params }: RouteContext) {
  const { id: requestId, lineItemId } = await params;

  const role = request.headers.get('x-user-role') ?? '';
  const userId = request.headers.get('x-user-id') || null;
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = FulfillLineItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { date, notes, items } = parsed.data;
  const activeItems = items.filter(i => i.quantityTaken > 0);
  const totalDispensed = activeItems.reduce((sum, i) => sum + i.quantityTaken, 0);

  if (activeItems.length === 0) {
    return NextResponse.json({ error: 'At least one item must have quantity > 0' }, { status: 422 });
  }

  try {
    const result = await withTransaction(async (client) => {
      // 1. Lock and validate the request
      const { rows: reqRows } = await client.query<{
        id: string;
        product_id: string;
        product_name: string;
        department: string;
        requestor_name: string;
        status: string;
      }>(
        `SELECT id, product_id, product_name, department, requestor_name, status
         FROM product_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      if (reqRows.length === 0) {
        throw Object.assign(new Error('Request not found'), { code: 'REQUEST_NOT_FOUND' });
      }

      const req = reqRows[0];

      if (req.status !== 'Approved' && req.status !== 'In Progress') {
        throw Object.assign(
          new Error(`Request must be Approved or In Progress to fulfill line items (is "${req.status}")`),
          { code: 'INVALID_REQUEST_STATUS', status: req.status }
        );
      }

      // 2. Lock and validate the line item
      const { rows: liRows } = await client.query<{
        id: string;
        request_id: string;
        quantity: number;
        status: string;
      }>(
        `SELECT id, request_id, quantity, status
         FROM request_line_items WHERE id = $1 AND request_id = $2 FOR UPDATE`,
        [lineItemId, requestId]
      );

      if (liRows.length === 0) {
        throw Object.assign(new Error('Line item not found'), { code: 'LINE_ITEM_NOT_FOUND' });
      }

      const li = liRows[0];

      if (li.status !== 'Pending') {
        throw Object.assign(
          new Error(`Line item is already "${li.status}"`),
          { code: 'LINE_ITEM_NOT_PENDING', status: li.status }
        );
      }

      // 3. Validate lot stock
      for (const item of activeItems) {
        const { rows: lotRows } = await client.query<{ id: string; quantity: number }>(
          'SELECT id, quantity FROM lots WHERE id = $1 AND product_id = $2 FOR UPDATE',
          [item.lotId, req.product_id]
        );

        if (lotRows.length === 0) {
          throw Object.assign(
            new Error(`Lot "${item.lotId}" not found for this product`),
            { code: 'LOT_NOT_FOUND', lotId: item.lotId }
          );
        }

        if (lotRows[0].quantity < item.quantityTaken) {
          throw Object.assign(
            new Error(`Lot "${item.lotId}" has insufficient stock (${lotRows[0].quantity} available, ${item.quantityTaken} requested)`),
            { code: 'INSUFFICIENT_STOCK', lotId: item.lotId }
          );
        }
      }

      // 4. Create fulfillment record
      const fulfillmentId = uuidv4();
      await client.query(
        `INSERT INTO fulfillments
           (id, request_id, product_id, product_name, department, total_quantity_requested, request_line_item_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [fulfillmentId, requestId, req.product_id, req.product_name, req.department, totalDispensed, lineItemId, userId]
      );

      // 5. Create transaction
      const transactionId = uuidv4();
      await client.query(
        `INSERT INTO transactions
           (id, product_id, product_name, date, notes, total_quantity, requestor_name, department, fulfillment_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [transactionId, req.product_id, req.product_name, new Date(date), notes,
         totalDispensed, req.requestor_name, req.department, fulfillmentId, userId]
      );

      // 6. Insert transaction items + decrement lot quantities
      for (const item of activeItems) {
        const { rows: lotRows } = await client.query<{ lot_number: string }>(
          'SELECT lot_number FROM lots WHERE id = $1',
          [item.lotId]
        );
        const lotNumber = lotRows[0]?.lot_number ?? item.lotId;

        await client.query(
          `INSERT INTO transaction_items (transaction_id, lot_id, lot_number, quantity, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [transactionId, item.lotId, lotNumber, item.quantityTaken, userId]
        );

        await client.query(
          'UPDATE lots SET quantity = quantity - $1 WHERE id = $2',
          [item.quantityTaken, item.lotId]
        );
      }

      // 7. Update line item to Fulfilled
      await client.query(
        `UPDATE request_line_items
         SET status = 'Fulfilled', fulfilled_quantity = $1, fulfillment_id = $2, updated_by = $3
         WHERE id = $4`,
        [totalDispensed, fulfillmentId, userId, lineItemId]
      );

      // 8. Check if ALL line items for this request are now Fulfilled
      const { rows: allItems } = await client.query<{ status: string }>(
        'SELECT status FROM request_line_items WHERE request_id = $1',
        [requestId]
      );

      const allFulfilled = allItems.every(item => item.status === 'Fulfilled');
      const newRequestStatus = allFulfilled ? 'Completed' : 'In Progress';

      await client.query(
        'UPDATE product_requests SET status = $1, updated_by = $2 WHERE id = $3',
        [newRequestStatus, userId, requestId]
      );

      // Fetch and return the updated request
      const { rows: full } = await client.query(
        `SELECT pr.*,
          ${LINE_ITEMS_SUBQUERY}
         FROM product_requests pr
         LEFT JOIN request_line_items rli ON rli.request_id = pr.id
         WHERE pr.id = $1
         GROUP BY pr.id`,
        [requestId]
      );

      return full[0];
    });

    // Map the result
    const mapped = {
      id: result.id,
      productId: result.product_id,
      productName: result.product_name,
      requestorName: result.requestor_name,
      requestorEmail: result.requestor_email,
      department: result.department,
      project: result.project ?? null,
      justification: result.justification,
      sopRead: result.sop_read,
      status: result.status,
      rejectionNote: result.rejection_note ?? undefined,
      directorId: result.director_id ?? null,
      directorApprovedAt: result.director_approved_at ? new Date(result.director_approved_at).toISOString() : null,
      directorRejectionNote: result.director_rejection_note ?? null,
      rejectedBy: result.rejected_by ?? null,
      rejectionStage: result.rejection_stage ?? null,
      date: result.date,
      lineItems: (result.line_items ?? []).map((li: any) => ({
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

    return NextResponse.json(mapped);
  } catch (error) {
    const err = error as Error & { code?: string; status?: string; lotId?: string };

    if (err.code === 'REQUEST_NOT_FOUND' || err.code === 'LINE_ITEM_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'INVALID_REQUEST_STATUS' || err.code === 'LINE_ITEM_NOT_PENDING') {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err.code === 'INSUFFICIENT_STOCK' || err.code === 'LOT_NOT_FOUND') {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }

    console.error(`[api/requests/${requestId}/line-items/${lineItemId}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to fulfill line item' }, { status: 500 });
  }
}
