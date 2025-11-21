import { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: string;
  direction: SortDirection;
}

interface UseTableSortProps<T> {
  data: T[];
  defaultSortColumn: string;
  compareFn?: (a: T, b: T, column: string, direction: SortDirection) => number;
}

export function useTableSort<T>({
  data,
  defaultSortColumn,
  compareFn,
}: UseTableSortProps<T>) {
  const [sort, setSort] = useState<SortState>({
    column: defaultSortColumn,
    direction: "asc",
  });

  const handleSort = useCallback((column: string) => {
    setSort((prevSort) => {
      if (prevSort.column === column) {
        // Toggle direction if clicking same column
        return {
          column,
          direction: prevSort.direction === "asc" ? "desc" : "asc",
        };
      }
      // New column, start with asc
      return {
        column,
        direction: "asc",
      };
    });
  }, []);

  const sortedData = useMemo(() => {
    const dataCopy = [...data];

    if (compareFn) {
      dataCopy.sort((a, b) =>
        compareFn(a, b, sort.column, sort.direction)
      );
    } else {
      dataCopy.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sort.column];
        const bVal = (b as Record<string, unknown>)[sort.column];

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sort.direction === "asc" ? 1 : -1;
        if (bVal == null) return sort.direction === "asc" ? -1 : 1;

        // String comparison
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sort.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        // Number comparison
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        // Date comparison
        if (aVal instanceof Date && bVal instanceof Date) {
          return sort.direction === "asc"
            ? aVal.getTime() - bVal.getTime()
            : bVal.getTime() - aVal.getTime();
        }

        // Fallback to string comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sort.direction === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return dataCopy;
  }, [data, sort, compareFn]);

  return {
    sortedData,
    sort,
    handleSort,
  };
}
