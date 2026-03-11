import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

const LocationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/storage-locations/[id] — update a storage location (Admin only)
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
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

  const parsed = LocationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

  // If deactivating, check for active lots using this location
  if (parsed.data.isActive === false) {
    const { rows: locRows } = await query<{ name: string }>(
      'SELECT name FROM storage_locations WHERE id = $1',
      [id]
    );
    if (locRows.length > 0) {
      const locationName = locRows[0].name;
      const { rows: lotRefs } = await query<{ cnt: string }>(
        'SELECT COUNT(*) AS cnt FROM lots WHERE location = $1 AND quantity > 0',
        [locationName]
      );
      if (parseInt(lotRefs[0].cnt, 10) > 0) {
        return NextResponse.json(
          { error: `Cannot deactivate: ${lotRefs[0].cnt} active lot(s) reference this location.` },
          { status: 409 }
        );
      }
    }
  }

  const userId = request.headers.get('x-user-id') || null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    vals.push(parsed.data.name.trim());
  }
  if (parsed.data.isActive !== undefined) {
    sets.push(`is_active = $${idx++}`);
    vals.push(parsed.data.isActive);
  }
  if (userId) {
    sets.push(`updated_by = $${idx++}`);
    vals.push(userId);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 });
  }

  vals.push(id);

  try {
    const { rows } = await query(
      `UPDATE storage_locations SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, is_active AS "isActive", created_at AS "createdAt"`,
      vals
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Storage location not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A storage location with that name already exists' }, { status: 409 });
    }
    console.error(`[api/storage-locations/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update storage location' }, { status: 500 });
  }
}
