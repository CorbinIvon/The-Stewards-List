import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * CardProps - Props for the main Card container component
 */
export interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * CardHeaderProps - Props for the CardHeader component
 */
export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * CardTitleProps - Props for the CardTitle heading component
 */
export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

/**
 * CardBodyProps - Props for the CardBody content component
 */
export interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

/**
 * CardFooterProps - Props for the CardFooter component
 */
export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card - Main container component with white background, rounded corners, shadow, and border
 * @param children - Card content
 * @param className - Additional CSS classes to apply
 */
export function Card({ children, className }: CardProps): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-700 bg-slate-800 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader - Optional header section with padding
 * @param children - Header content
 * @param className - Additional CSS classes to apply
 */
export function CardHeader({
  children,
  className,
}: CardHeaderProps): React.ReactElement {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

/**
 * CardTitle - Styled heading for card header
 * @param children - Title text
 * @param className - Additional CSS classes to apply
 */
export function CardTitle({
  children,
  className,
}: CardTitleProps): React.ReactElement {
  return (
    <h3 className={cn("text-lg font-semibold text-slate-100", className)}>
      {children}
    </h3>
  );
}

/**
 * CardBody - Main content area with padding
 * @param children - Body content
 * @param className - Additional CSS classes to apply
 */
export function CardBody({ children, className }: CardBodyProps): React.ReactElement {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

/**
 * CardFooter - Optional footer section with top border and padding
 * @param children - Footer content
 * @param className - Additional CSS classes to apply
 */
export function CardFooter({
  children,
  className,
}: CardFooterProps): React.ReactElement {
  return (
    <div className={cn("border-t border-slate-700 px-6 py-4", className)}>
      {children}
    </div>
  );
}
