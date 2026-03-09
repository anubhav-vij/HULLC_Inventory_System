import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

function isAdmin(request: Request) {
  return request.headers.get('x-user-role') === 'Admin';
}

const StatusSchema = z.object({
  isActive: z.boolean(),
});

// PUT /api/users/[id]/status — Admin only
export async function PUT(request: Request, { params }: RouteContext) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const { rows, rowCount } = await query<{ id: string; is_active: boolean }>(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active',
      [parsed.data.isActive, id]
    );

    if (!rowCount || rowCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ id: rows[0].id, isActive: rows[0].is_active });
  } catch (error) {
    console.error(`[api/users/${id}/status] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update user status' }, { status: 500 });
  }
}
