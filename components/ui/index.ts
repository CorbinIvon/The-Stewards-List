/**
 * Barrel export file for all UI components
 * Centralized import location for component consumers
 *
 * Usage:
 * import { Button, Input, Select, Card, CardHeader, Modal, Badge, Spinner } from "@/components/ui";
 */

// Button component
export { Button, type ButtonProps } from "./Button";

// Input component
export { default as Input, type InputProps } from "./Input";

// Select component
export { default as Select, type SelectProps } from "./Select";

// Textarea component - Not yet implemented
// export { default as Textarea, type TextareaProps } from "./Textarea";

// Card component and sub-components
export {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  type CardProps,
  type CardHeaderProps,
  type CardTitleProps,
  type CardBodyProps,
  type CardFooterProps,
} from "./Card";

// Modal component
export { default as Modal, type ModalProps } from "./Modal";

// Badge component
export { default as Badge, type BadgeProps } from "./Badge";

// Spinner component
export { Spinner, type SpinnerProps } from "./Spinner";

// Alert component
export { default as Alert, type AlertProps } from "./Alert";

// SortableTable component
export {
  SortableTable,
  TableLink,
  TableBadge,
  type SortableTableProps,
  type TableColumn,
  type CellRenderer,
} from "./SortableTable";
