import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';
import { isUniqueViolation } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

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

const UpdateGroupSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.isActive !== undefined, {
    message: 'At least one of name or isActive must be provided',
  });

// PUT /api/functional-groups/[id] — Admin only
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

  const parsed = UpdateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { name, isActive } = parsed.data;
  const userId = request.headers.get('x-user-id') || null;
  const setParts: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (name !== undefined) {
    setParts.push(`name = $${idx++}`);
    values.push(name);
  }
  if (isActive !== undefined) {
    setParts.push(`is_active = $${idx++}`);
    values.push(isActive);
  }
  if (userId) {
    setParts.push(`updated_by = $${idx++}`);
    values.push(userId);
  }
  values.push(id);

  try {
    const { rows } = await query<FunctionalGroupRow>(
      `UPDATE functional_groups SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Functional group not found' }, { status: 404 });
    }
    return NextResponse.json(rowToGroup(rows[0]));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A group with that name already exists' },
        { status: 409 }
      );
    }
    console.error(`[api/functional-groups/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update functional group' }, { status: 500 });
  }
}
