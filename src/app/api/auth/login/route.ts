import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow {
  id: string;
  role: string;
  department: string;
  full_name: string;
  email: string;
  password_hash: string | null;
  functional_group_id: string | null;
  functional_group_name: string | null;
  is_active: boolean;
}

// POST /api/auth/login
// Verifies email + password, returns a user profile (no password_hash).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 422 });
  }

  const { email, password } = parsed.data;

  try {
    const { rows } = await query<UserRow>(
      `SELECT u.*, fg.name AS functional_group_name
       FROM users u
       LEFT JOIN functional_groups fg ON fg.id = u.functional_group_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    // Use a generic message to avoid email enumeration
    if (rows.length === 0 || !rows[0].password_hash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password_hash!);
    if (!match) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact an administrator.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: user.id,
      role: user.role,
      department: user.department,
      fullName: user.full_name,
      email: user.email,
      functionalGroupId: user.functional_group_id ?? undefined,
      functionalGroupName: user.functional_group_name ?? undefined,
      isActive: user.is_active,
    });
  } catch (error) {
    console.error('[api/auth/login] POST error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
