"use client";

import { Button } from "@/components/ui/button";

const PAGE_SIZE = 75;

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
  pageSize?: number;
}

export function PaginationControls({
  currentPage,
  totalItems,
  onPageChange,
  label = "items",
  pageSize = PAGE_SIZE,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Build page numbers with ellipsis
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | string)[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm" style={{ color: "#64748b" }}>
        Showing {start}&ndash;{end} of {totalItems} {label}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) =>
            typeof p === "string" ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-sm" style={{ color: "#94a3b8" }}>
                ...
              </span>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Paginate an array client-side */
export function paginate<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export { PAGE_SIZE };
