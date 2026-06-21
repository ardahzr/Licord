import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Carbon & Rust input. Mono font, dark container, Rust focus border
 * (no glow shadow — depth comes from outlines per the design spec).
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded bg-surface-container-highest border border-outline-variant text-on-surface font-code-sm text-code-sm placeholder:text-outline px-sm py-sm transition-colors",
        "focus:outline-none focus:border-primary-container focus:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
