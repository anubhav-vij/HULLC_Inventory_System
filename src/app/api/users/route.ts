import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '@/lib/db';
import { isUniqueViolation } from '@/lib/api-error';

const FULL_VIEW_ROLES = ['Admin', 'ProjectManager', 'Chief'];

function isAdmin(request: Request) {
  return request.headers.get('x-user-role') === 'Admin';
}

function hasFullView(request: Request) {
  return FULL_VIEW_ROLES.includes(request.headers.get('x-user-role') ?? '');
}

interface UserRow {
  id: string;
  role: string;
  department: string;
  full_name: string;
  email: string | null;
  password_hash: string | null;
  functional_group_id: string | null;
  functional_group_name: string | null;
  is_active: boolean;
  is_system: boolean;
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
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_SELECT = `
  SELECT u.*, fg.name AS functional_group_name
  FROM users u
  LEFT JOIN functional_groups fg ON fg.id = u.functional_group_id
`;

// GET /api/users — Admin, ProjectManager, Chief
export async function GET(request: Request) {
  if (!hasFullView(request)) {
    return NextResponse.json({ error: 'Access required: Admin, ProjectManager, or Chief' }, { status: 403 });
  }

  try {
    const { rows } = await query<UserRow>(`${USER_SELECT} ORDER BY u.full_name, u.email`);
    return NextResponse.json(rows.map(rowToUser));
  } catch (error) {
    console.error('[api/users] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

const RoleEnum = z.enum(['Admin', 'Staff', 'Director', 'ProjectManager', 'Chief']);

const CreateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200).trim(),
  email: z.string().email('Valid email is required').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: RoleEnum,
  functionalGroupId: z.string().uuid().nullable().optional(),
  department: z.string().optional().default('core'),
});

// POST /api/users — Admin only
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

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { fullName, email, password, role, functionalGroupId, department } = parsed.data;

  // Enforce one Director per functional group
  if (role === 'Director' && functionalGroupId) {
    const { rows: existing } = await query(
      'SELECT id FROM users WHERE role = $1 AND functional_group_id = $2 AND is_active = TRUE',
      ['Director', functionalGroupId]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'This functional group already has an active Director. Deactivate the existing Director first.' },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const actorId = request.headers.get('x-user-id') || null;

  try {
    const user = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (full_name, email, password_hash, role, department, functional_group_id, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $7)
         RETURNING id`,
        [fullName, email, passwordHash, role, department, functionalGroupId ?? null, actorId]
      );
      const { rows: full } = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [rows[0].id]
      );
      return full[0];
    });

    return NextResponse.json(rowToUser(user), { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A user with that email already exists' },
        { status: 409 }
      );
    }
    console.error('[api/users] POST error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
