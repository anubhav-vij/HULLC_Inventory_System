import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }
  const { name, isActive } = parsed.data;
  const userId = request.headers.get('x-user-id') || null;
  if (name === undefined && isActive === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }
  try {
    const setParts: string[] = [];
    const vals: unknown[] = [];
    if (name !== undefined) { vals.push(name); setParts.push(`name = $${vals.length}`); }
    if (isActive !== undefined) { vals.push(isActive); setParts.push(`is_active = $${vals.length}`); }
    if (userId) { vals.push(userId); setParts.push(`updated_by = $${vals.length}`); }
    vals.push(id);
    const { rows } = await query<{ id: string; name: string; is_active: boolean }>(
      `UPDATE projects SET ${setParts.join(', ')} WHERE id = $${vals.length} RETURNING id, name, is_active`,
      vals
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ id: rows[0].id, name: rows[0].name, isActive: rows[0].is_active });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A project with that name already exists' }, { status: 409 });
    }
    console.error(`[api/projects/${id}] PUT error:`, error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
