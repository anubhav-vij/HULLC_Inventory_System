import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

const VendorCreateSchema = z.object({
  name: z.string().min(1).max(255),
});

// GET /api/vendors — list all vendors
export async function GET() {
  try {
    const { rows } = await query(
      'SELECT id, name, is_active AS "isActive", created_at AS "createdAt" FROM vendors ORDER BY name'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[api/vendors] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

// POST /api/vendors — create a new vendor (Admin only)
export async function POST(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = VendorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const { rows } = await query(
      `INSERT INTO vendors (name) VALUES ($1)
       RETURNING id, name, is_active AS "isActive", created_at AS "createdAt"`,
      [parsed.data.name.trim()]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A vendor with that name already exists' }, { status: 409 });
    }
    console.error('[api/vendors] POST error:', error);
    return NextResponse.json({ error: 'Failed to create vendor' }, { status: 500 });
  }
}
