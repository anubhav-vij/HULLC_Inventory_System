import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

const LocationCreateSchema = z.object({
  name: z.string().min(1).max(255),
});

// GET /api/storage-locations — list all storage locations
export async function GET() {
  try {
    const { rows } = await query(
      'SELECT id, name, is_active AS "isActive", created_at AS "createdAt" FROM storage_locations ORDER BY name'
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('[api/storage-locations] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch storage locations' }, { status: 500 });
  }
}

// POST /api/storage-locations — create a new storage location (Admin only)
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

  const parsed = LocationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  const userId = request.headers.get('x-user-id') || null;
  try {
    const { rows } = await query(
      `INSERT INTO storage_locations (name, created_by, updated_by) VALUES ($1, $2, $2)
       RETURNING id, name, is_active AS "isActive", created_at AS "createdAt"`,
      [parsed.data.name.trim(), userId]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A storage location with that name already exists' }, { status: 409 });
    }
    console.error('[api/storage-locations] POST error:', error);
    return NextResponse.json({ error: 'Failed to create storage location' }, { status: 500 });
  }
}
