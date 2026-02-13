import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Optional: label for the items, e.g. "leads" or "records" */
  itemLabel?: string;
  /** Compact mode for mobile */
  compact?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
  compact = false,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  // Generate visible page numbers (max 5 centered around current)
  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  const btnBase =
    'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-1">
      {/* Item range info */}
      <div className="text-xs text-gray-500 order-2 sm:order-1">
        Showing {startItem}–{endItem} of {totalItems} {itemLabel}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* First page */}
        {!compact && (
          <button
            onClick={() => onPageChange(1)}
            disabled={!canPrev}
            className={`${btnBase} w-8 h-8 text-gray-600 hover:bg-gray-100`}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}

        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
          className={`${btnBase} w-8 h-8 text-gray-600 hover:bg-gray-100`}
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {!compact &&
          getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`${btnBase} w-8 h-8 ${
                  page === currentPage
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ),
          )}

        {/* Compact: just show page x of y */}
        {compact && (
          <span className="px-2 text-xs text-gray-600 font-medium">
            {currentPage} / {totalPages}
          </span>
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
          className={`${btnBase} w-8 h-8 text-gray-600 hover:bg-gray-100`}
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        {!compact && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={!canNext}
            className={`${btnBase} w-8 h-8 text-gray-600 hover:bg-gray-100`}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
