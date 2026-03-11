import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const dbSsl = process.env.DATABASE_SSL;
  const nodeEnv = process.env.NODE_ENV;

  // Check if env var is even set (mask the password)
  const maskedUrl = dbUrl
    ? dbUrl.replace(/:[^@]+@/, ':***@')
    : 'NOT SET';

  if (!dbUrl) {
    return NextResponse.json({
      status: 'error',
      message: 'DATABASE_URL is not set',
      nodeEnv,
      dbSsl,
    }, { status: 500 });
  }

  try {
    // Dynamic import to avoid crashing if DATABASE_URL is missing
    const { query } = await import('@/lib/db');
    const { rows } = await query<{ now: Date }>('SELECT NOW()');
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: rows[0].now,
      nodeEnv,
      maskedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
        nodeEnv,
        dbSsl,
        maskedUrl,
      },
      { status: 500 }
    );
  }
}
