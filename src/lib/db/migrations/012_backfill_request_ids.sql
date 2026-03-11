-- Backfill existing requests with HULLC-YYYY-XXXX IDs.
-- Uses a window function to assign sequential numbers per year, ordered by date.

UPDATE product_requests
SET request_number = sub.row_num,
    request_id = 'HULLC-' || sub.req_year || '-' || LPAD(sub.row_num::TEXT, 4, '0')
FROM (
  SELECT id,
         EXTRACT(YEAR FROM date)::INTEGER AS req_year,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM date) ORDER BY date ASC, id ASC)::INTEGER AS row_num
  FROM product_requests
  WHERE request_id IS NULL
) sub
WHERE product_requests.id = sub.id;

INSERT INTO request_id_sequences (year, last_number)
SELECT EXTRACT(YEAR FROM date)::INTEGER, MAX(request_number)
FROM product_requests
WHERE request_id IS NOT NULL
GROUP BY EXTRACT(YEAR FROM date)::INTEGER
ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(request_id_sequences.last_number, EXCLUDED.last_number)
