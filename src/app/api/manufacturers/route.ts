import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

const ManufacturerCreateSchema = z.object({
  name: z.string().min(1).max(255),
  alternateNames: z.string().optional(),
});

// GET /api/manufacturers — list all manufacturers
export async function GET() {
  try {
    const { rows } = await query(
      'SELECT id, name, alternate_names AS "alternateNames", is_active AS "isActive", created_at AS "createdAt" FROM manufacturers ORDER BY name'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[api/manufacturers] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
  }
}

// POST /api/manufacturers — create a new manufacturer (Admin only)
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

  const parsed = ManufacturerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  const userId = request.headers.get('x-user-id') || null;
  try {
    const { rows } = await query(
      `INSERT INTO manufacturers (name, alternate_names, created_by, updated_by) VALUES ($1, $2, $3, $3)
       RETURNING id, name, alternate_names AS "alternateNames", is_active AS "isActive", created_at AS "createdAt"`,
      [parsed.data.name.trim(), parsed.data.alternateNames?.trim() || null, userId]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A manufacturer with that name already exists' }, { status: 409 });
    }
    console.error('[api/manufacturers] POST error:', error);
    return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 });
  }
}
