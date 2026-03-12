import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query, withTransaction } from '@/lib/db';
import { isUniqueViolation } from '@/lib/api-error';

type RouteContext = { params: Promise<{ id: string }> };

function isAdmin(request: Request) {
  return request.headers.get('x-user-role') === 'Admin';
}

interface UserRow {
  id: string;
  role: string;
  department: string;
  full_name: string;
  email: string | null;
  functional_group_id: string | null;
  functional_group_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToUser(row: UserRow) {
  return {
    id: row.id,
    role: row.role,
    department: row.department,
    fullName: row.full_name,
    email: row.email ?? '',
    functionalGroupId: row.functional_group_id ?? undefined,
    functionalGroupName: row.functional_group_name ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_SELECT = `
  SELECT u.*, fg.name AS functional_group_name
  FROM users u
  LEFT JOIN functional_groups fg ON fg.id = u.functional_group_id
`;

const RoleEnum = z.enum(['Admin', 'Staff', 'Director', 'ProjectManager', 'Chief']);

const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().toLowerCase().optional(),
  role: RoleEnum.optional(),
  functionalGroupId: z.string().uuid().nullable().optional(),
  department: z.string().optional(),
});

// PUT /api/users/[id] — Admin only
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

  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { fullName, email, role, functionalGroupId, department } = parsed.data;

  // Enforce one Director per functional group when changing role/group
  if (role === 'Director' && functionalGroupId) {
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE role = $1 AND functional_group_id = $2 AND is_active = TRUE AND id != $3',
      ['Director', functionalGroupId, id]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'This functional group already has an active Director. Deactivate the existing Director first.' },
        { status: 409 }
      );
    }
  }

  const actorId = request.headers.get('x-user-id') || null;
  const setParts: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fullName !== undefined)          { setParts.push(`full_name = $${idx++}`);            values.push(fullName); }
  if (email !== undefined)             { setParts.push(`email = $${idx++}`);                 values.push(email); }
  if (role !== undefined)              { setParts.push(`role = $${idx++}`);                  values.push(role); }
  if (functionalGroupId !== undefined) { setParts.push(`functional_group_id = $${idx++}`);   values.push(functionalGroupId); }
  if (department !== undefined)        { setParts.push(`department = $${idx++}`);             values.push(department); }
  if (actorId)                         { setParts.push(`updated_by = $${idx++}`);             values.push(actorId); }

  if (setParts.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 });
  }

  values.push(id);

  try {
    const user = await withTransaction(async (client) => {
      const { rows: check } = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (check.length === 0) return null;

      await client.query(
        `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx}`,
        values
      );

      const { rows: full } = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [id]
      );
      return full[0];
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(rowToUser(user));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A user with that email already exists' },
        { status: 409 }
      );
    }
    console.error(`[api/users/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
