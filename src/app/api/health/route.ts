import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await query<{ now: Date }>('SELECT NOW()');
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: rows[0].now,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
      { status: 500 }
    );
  }
}
