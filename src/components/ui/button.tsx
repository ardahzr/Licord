import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Carbon & Rust button. Defaults to the technical "label-caps" (JetBrains Mono)
 * styling the Stitch designs use for actions (NEW SERVER, EXECUTE_LOGIN, …).
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-xs whitespace-nowrap rounded font-label-caps text-label-caps transition-colors cursor-pointer active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-container",
  {
    variants: {
      variant: {
        default:
          "bg-primary-container text-on-primary-container hover:bg-tertiary-container",
        secondary:
          "bg-surface-container-high text-on-surface border border-outline-variant hover:border-primary-container",
        outline:
          "bg-transparent border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary",
        ghost: "bg-transparent text-on-surface-variant hover:text-primary",
        destructive:
          "bg-error-container text-on-error-container hover:opacity-90",
      },
      size: {
        default: "h-9 px-md py-sm",
        sm: "h-8 px-sm py-xs",
        lg: "h-10 px-lg",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
