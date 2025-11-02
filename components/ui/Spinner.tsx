import { cn } from "@/lib/utils";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const colorClasses = {
  primary: "border-blue-600",
  white: "border-white",
};

export function Spinner({
  size = "md",
  color = "primary",
  className,
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block rounded-full border-4 border-transparent animate-spin",
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      style={{
        borderTopColor: color === "primary" ? "rgb(37, 99, 235)" : "white",
        borderRightColor: color === "primary" ? "rgb(37, 99, 235)" : "white",
      }}
    />
  );
}
