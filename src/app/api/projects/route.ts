import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
});

export async function GET() {
  try {
    const { rows } = await query<{ id: string; name: string; is_active: boolean }>(
      'SELECT id, name, is_active FROM projects ORDER BY name ASC'
    );
    return NextResponse.json(rows.map(r => ({ id: r.id, name: r.name, isActive: r.is_active })));
  } catch (error) {
    console.error('[api/projects] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { rows } = await query<{ id: string; name: string; is_active: boolean }>(
      'INSERT INTO projects (name) VALUES ($1) RETURNING id, name, is_active',
      [parsed.data.name]
    );
    return NextResponse.json({ id: rows[0].id, name: rows[0].name, isActive: rows[0].is_active }, { status: 201 });
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A project with that name already exists' }, { status: 409 });
    }
    console.error('[api/projects] POST error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
