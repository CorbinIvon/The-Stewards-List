import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTableSort, type SortDirection } from "@/lib/use-table-sort";
import Badge from "./Badge";

/**
 * Cell renderer type - can be a string (property key) or custom renderer function
 */
export type CellRenderer<T> = string | ((item: T) => React.ReactNode);

/**
 * Column definition for SortableTable
 */
export interface TableColumn<T> {
  /** Unique identifier for the column */
  key: string;
  /** Display label for the column header */
  label: string;
  /** How to render the cell value - property name or render function */
  render?: CellRenderer<T>;
  /** CSS classes to apply to header and cells */
  className?: string;
  /** Whether this column is sortable (default: true) */
  sortable?: boolean;
  /** Custom comparison function for sorting this column */
  compareFn?: (a: T, b: T, direction: SortDirection) => number;
}

/**
 * Props for SortableTable component
 */
export interface SortableTableProps<T> {
  /** Data to display in the table */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Key to extract for React list rendering */
  rowKey: (item: T) => string | number;
  /** Default column to sort by */
  defaultSortColumn?: string;
  /** Callback when a row is clicked */
  onRowClick?: (item: T) => void;
  /** Row className or function to determine className */
  rowClassName?: string | ((item: T) => string);
  /** Hover effect on rows */
  hoverable?: boolean;
  /** Global comparison function used for all columns without custom compareFn */
  compareFn?: (
    a: T,
    b: T,
    column: string,
    direction: SortDirection
  ) => number;
  /** CSS classes for the table wrapper */
  className?: string;
  /** Color for hover state on headers (default: text-blue-400) */
  headerHoverColor?: string;
}

/**
 * Sortable table component with flexible column rendering
 *
 * Features:
 * - Click column headers to sort ascending/descending
 * - Customizable column rendering
 * - Support for links and badges in cells
 * - Hover effects on rows
 * - TypeScript support with generics
 *
 * @example
 * ```tsx
 * const columns: TableColumn<Task>[] = [
 *   { key: "title", label: "Task Title", render: (task) => task.title },
 *   { key: "status", label: "Status" },
 * ];
 *
 * <SortableTable
 *   data={tasks}
 *   columns={columns}
 *   rowKey={(task) => task.id}
 *   defaultSortColumn="title"
 * />
 * ```
 */
export function SortableTable<T>({
  data,
  columns,
  rowKey,
  defaultSortColumn = columns[0]?.key ?? "id",
  onRowClick,
  rowClassName,
  hoverable = true,
  compareFn,
  className,
  headerHoverColor = "hover:text-blue-400",
}: SortableTableProps<T>): React.ReactElement {
  // Build custom comparator that respects per-column overrides
  const tableCompareFn = (
    a: T,
    b: T,
    column: string,
    direction: SortDirection
  ): number => {
    const col = columns.find((c) => c.key === column);
    if (col?.compareFn) {
      return col.compareFn(a, b, direction);
    }
    if (compareFn) {
      return compareFn(a, b, column, direction);
    }
    return 0;
  };

  const { sortedData, sort, handleSort } = useTableSort({
    data,
    defaultSortColumn,
    compareFn: compareFn ? tableCompareFn : undefined,
  });

  const getSortIndicator = (columnKey: string): string => {
    if (sort.column !== columnKey) return "";
    return sort.direction === "asc" ? "↑" : "↓";
  };

  const getCellValue = (item: T, column: TableColumn<T>): React.ReactNode => {
    if (column.render) {
      if (typeof column.render === "function") {
        return column.render(item);
      }
      // It's a string (property key)
      return (item as Record<string, unknown>)[column.render] ?? "—";
    }
    // Default: use column.key as property name
    return (item as Record<string, unknown>)[column.key] ?? "—";
  };

  const getRowClassName = (item: T): string => {
    if (typeof rowClassName === "function") {
      return rowClassName(item);
    }
    return rowClassName || "";
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-left font-semibold text-[color:var(--muted)]",
                  column.sortable !== false &&
                    "cursor-pointer select-none " + headerHoverColor,
                  column.className
                )}
                onClick={() => {
                  if (column.sortable !== false) {
                    handleSort(column.key);
                  }
                }}
              >
                {column.label} {getSortIndicator(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr
              key={rowKey(item)}
              className={cn(
                "border-b border-slate-700",
                hoverable && "hover:bg-[color:var(--panel)]",
                onRowClick && "cursor-pointer",
                getRowClassName(item)
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td
                  key={`${rowKey(item)}-${column.key}`}
                  className={cn("px-4 py-3", column.className)}
                >
                  {getCellValue(item, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Helper component to render links in table cells
 * @example
 * ```tsx
 * render: (task) => <TableLink href={`/tasks/${task.id}`}>{task.title}</TableLink>
 * ```
 */
export function TableLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Link href={href} className="hover:text-blue-600 hover:underline">
      {children}
    </Link>
  );
}

/**
 * Helper component to render badges in table cells
 * @example
 * ```tsx
 * render: (task) => (
 *   <TableBadge variant={task.status === "COMPLETED" ? "success" : "warning"}>
 *     {task.status}
 *   </TableBadge>
 * )
 * ```
 */
interface TableBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}

export function TableBadge({
  children,
  variant = "default",
  size = "sm",
}: TableBadgeProps): React.ReactElement {
  return (
    <Badge variant={variant} size={size}>
      {children}
    </Badge>
  );
}
