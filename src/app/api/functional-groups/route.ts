import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { isUniqueViolation } from '@/lib/api-error';

function isAdmin(request: Request) {
  return request.headers.get('x-user-role') === 'Admin';
}

interface FunctionalGroupRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToGroup(row: FunctionalGroupRow) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/functional-groups
// ?active=false includes inactive groups (Admin only for inactive)
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('active') === 'false';

    const sql = includeInactive
      ? 'SELECT * FROM functional_groups ORDER BY name'
      : 'SELECT * FROM functional_groups WHERE is_active = TRUE ORDER BY name';

    const { rows } = await query<FunctionalGroupRow>(sql);
    return NextResponse.json(rows.map(rowToGroup));
  } catch (error) {
    console.error('[api/functional-groups] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch functional groups' }, { status: 500 });
  }
}

const CreateGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).trim(),
});

// POST /api/functional-groups — Admin only
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const userId = request.headers.get('x-user-id') || null;

  try {
    const { rows } = await query<FunctionalGroupRow>(
      'INSERT INTO functional_groups (name, created_by, updated_by) VALUES ($1, $2, $2) RETURNING *',
      [parsed.data.name, userId]
    );
    return NextResponse.json(rowToGroup(rows[0]), { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A group with that name already exists' },
        { status: 409 }
      );
    }
    console.error('[api/functional-groups] POST error:', error);
    return NextResponse.json({ error: 'Failed to create functional group' }, { status: 500 });
  }
}
