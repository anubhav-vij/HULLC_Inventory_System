import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const ALLOWED_ROLES = ['Admin', 'ProjectManager', 'Chief'];

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') ?? '';
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const dateFilter = from && to;

  try {
    // 1. Transactions per day (last 30 days or filtered range)
    const txPerDayQuery = dateFilter
      ? `SELECT date_trunc('day', t.date)::date AS day, COUNT(*)::int AS count
         FROM transactions t WHERE t.date >= $1::date AND t.date <= $2::date
         GROUP BY day ORDER BY day`
      : `SELECT date_trunc('day', t.date)::date AS day, COUNT(*)::int AS count
         FROM transactions t WHERE t.date >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY day ORDER BY day`;

    // 2. Transactions per week (last 12 weeks or filtered range)
    const txPerWeekQuery = dateFilter
      ? `SELECT date_trunc('week', t.date)::date AS week, COUNT(*)::int AS count
         FROM transactions t WHERE t.date >= $1::date AND t.date <= $2::date
         GROUP BY week ORDER BY week`
      : `SELECT date_trunc('week', t.date)::date AS week, COUNT(*)::int AS count
         FROM transactions t WHERE t.date >= CURRENT_DATE - INTERVAL '12 weeks'
         GROUP BY week ORDER BY week`;

    // 3. Requests by functional group
    const reqByGroupQuery = dateFilter
      ? `SELECT COALESCE(pr.requestor_department, 'Unknown') AS group_name, COUNT(*)::int AS count
         FROM product_requests pr WHERE pr.date >= $1::date AND pr.date <= $2::date
         GROUP BY group_name ORDER BY count DESC`
      : `SELECT COALESCE(pr.requestor_department, 'Unknown') AS group_name, COUNT(*)::int AS count
         FROM product_requests pr
         GROUP BY group_name ORDER BY count DESC`;

    // 4. Requests by status
    const reqByStatusQuery = dateFilter
      ? `SELECT pr.status, COUNT(*)::int AS count
         FROM product_requests pr WHERE pr.date >= $1::date AND pr.date <= $2::date
         GROUP BY pr.status ORDER BY count DESC`
      : `SELECT pr.status, COUNT(*)::int AS count
         FROM product_requests pr
         GROUP BY pr.status ORDER BY count DESC`;

    // 5. Products added over time (cumulative, by month)
    const productsOverTimeQuery = dateFilter
      ? `SELECT date_trunc('month', p.created_at)::date AS month, COUNT(*)::int AS count
         FROM products p WHERE p.created_at >= $1::date AND p.created_at <= $2::date
         GROUP BY month ORDER BY month`
      : `SELECT date_trunc('month', p.created_at)::date AS month, COUNT(*)::int AS count
         FROM products p WHERE p.created_at IS NOT NULL
         GROUP BY month ORDER BY month`;

    const params = dateFilter ? [from, to] : [];

    const [txDay, txWeek, reqGroup, reqStatus, prodTime] = await Promise.all([
      query(txPerDayQuery, params),
      query(txPerWeekQuery, params),
      query(reqByGroupQuery, params),
      query(reqByStatusQuery, params),
      query(productsOverTimeQuery, params),
    ]);

    // Build cumulative products array
    let cumulative = 0;
    const productsCumulative = prodTime.rows.map((r: any) => {
      cumulative += r.count;
      return { month: r.month, count: r.count, cumulative };
    });

    return NextResponse.json({
      transactionsPerDay: txDay.rows,
      transactionsPerWeek: txWeek.rows,
      requestsByGroup: reqGroup.rows,
      requestsByStatus: reqStatus.rows,
      productsOverTime: productsCumulative,
    });
  } catch (error) {
    console.error('[api/metrics/dashboard] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard metrics' }, { status: 500 });
  }
}
