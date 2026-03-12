// ---------------------------------------------------------------------------
// Shared SQL fragments and mappers for product_requests + request_line_items
// ---------------------------------------------------------------------------
// Centralised here to avoid duplication across 7+ API route files.

/**
 * SQL subquery that aggregates request_line_items into a JSON array.
 * Expects the main query to JOIN `request_line_items rli ON rli.request_id = pr.id`
 * and GROUP BY pr.id.
 */
export const LINE_ITEMS_SUBQUERY = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', rli.id,
        'requestId', rli.request_id,
        'requestedDate', to_char(rli.requested_date, 'YYYY-MM-DD'),
        'quantity', rli.quantity,
        'status', rli.status,
        'fulfilledQuantity', rli.fulfilled_quantity,
        'fulfillmentId', rli.fulfillment_id
      ) ORDER BY rli.requested_date
    ) FILTER (WHERE rli.id IS NOT NULL),
    '[]'
  ) AS line_items
`;

// ---------------------------------------------------------------------------
// Row type — columns returned by SELECT pr.* plus the line_items aggregate
// ---------------------------------------------------------------------------

export interface RequestRow {
  id: string;
  product_id: string;
  product_name: string;
  requestor_name: string;
  requestor_email: string;
  department: string;
  project: string | null;
  justification: string;
  sop_read: boolean;
  status: string;
  rejection_note: string | null;
  director_id: string | null;
  director_approved_at: Date | null;
  director_rejection_note: string | null;
  director_comments: string | null;
  rejected_by: string | null;
  rejection_stage: string | null;
  date: Date;
  request_number: number | null;
  request_id: string | null;
  // SOM fields
  som_approval_status: string | null;
  som_approval_required: boolean;
  sciops_director_approved_at: Date | null;
  sciops_director_approved_by: string | null;
  // Product join fields (optional — only present when JOINed)
  product_manufacturer_part_number?: string | null;
  product_uom?: string | null;
  line_items: Array<{
    id: string;
    requestId: string;
    requestedDate: string;
    quantity: number;
    status: string;
    fulfilledQuantity: number;
    fulfillmentId: string | null;
  }> | null;
}

// ---------------------------------------------------------------------------
// Row → API response mapper
// ---------------------------------------------------------------------------

export function rowToRequest(row: RequestRow) {
  return {
    id: row.id,
    requestId: row.request_id ?? undefined,
    requestNumber: row.request_number ?? undefined,
    productId: row.product_id,
    productName: row.product_name,
    requestorName: row.requestor_name,
    requestorEmail: row.requestor_email,
    department: row.department,
    project: row.project ?? null,
    justification: row.justification,
    sopRead: row.sop_read,
    status: row.status,
    rejectionNote: row.rejection_note ?? undefined,
    directorId: row.director_id ?? null,
    directorApprovedAt: row.director_approved_at
      ? row.director_approved_at.toISOString()
      : null,
    directorRejectionNote: row.director_rejection_note ?? null,
    directorComments: row.director_comments ?? null,
    rejectedBy: row.rejected_by ?? null,
    rejectionStage: row.rejection_stage ?? null,
    somApprovalStatus: row.som_approval_status ?? null,
    sciopsDirectorApprovedAt: row.sciops_director_approved_at
      ? row.sciops_director_approved_at.toISOString()
      : null,
    sciopsDirectorApprovedBy: row.sciops_director_approved_by ?? null,
    somApprovalRequired: row.som_approval_required ?? false,
    manufacturerPartNumber: row.product_manufacturer_part_number ?? null,
    uom: row.product_uom ?? null,
    date: row.date,
    lineItems: (row.line_items ?? []).map((li) => ({
      id: li.id,
      requestId: li.requestId,
      requestedDate: li.requestedDate,
      quantity: li.quantity,
      status: li.status,
      fulfilledQuantity: li.fulfilledQuantity,
      fulfillmentId: li.fulfillmentId ?? null,
    })),
  };
}
