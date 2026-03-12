import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// DELETE /api/transactions/[id]
// Reverses the transaction atomically:
//   1. Fetches and locks the transaction row
//   2. Restores each lot's quantity from transaction_items
//   3. Deletes the transaction (CASCADE removes transaction_items)
// Returns 404 if the transaction does not exist.
// ---------------------------------------------------------------------------

export async function DELETE(request: Request, { params }: RouteContext) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const deleted = await withTransaction(async (client) => {
      // 1. Fetch and lock the transaction
      const { rows: transactions } = await client.query<{ id: string }>(
        'SELECT id FROM transactions WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (transactions.length === 0) return false;

      // 2. Fetch the line items so we know how much to restore per lot
      const { rows: items } = await client.query<{ lot_id: string; quantity: number }>(
        'SELECT lot_id, quantity FROM transaction_items WHERE transaction_id = $1',
        [id]
      );

      // 3. Restore each lot's quantity
      for (const item of items) {
        await client.query('UPDATE lots SET quantity = quantity + $1 WHERE id = $2', [
          item.quantity,
          item.lot_id,
        ]);
      }

      // 4. Delete the transaction — CASCADE removes transaction_items
      await client.query('DELETE FROM transactions WHERE id = $1', [id]);

      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`[api/transactions/${id}] DELETE error:`, error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
