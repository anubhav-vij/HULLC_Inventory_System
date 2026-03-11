import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

const VendorUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/vendors/[id] — update a vendor (Admin only)
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

  const parsed = VendorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }

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

  if (sets.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 });
  }

  vals.push(id);

  try {
    const { rows } = await query(
      `UPDATE vendors SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, is_active AS "isActive", created_at AS "createdAt"`,
      vals
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A vendor with that name already exists' }, { status: 409 });
    }
    console.error(`[api/vendors/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}
