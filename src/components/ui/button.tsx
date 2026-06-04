import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

const buttonVariants = cva(
  "inline-flex items-center gap-[7px] h-[34px] px-[14px] rounded-md border text-[13px] font-semibold transition-all duration-fast ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-focus",
  {
    variants: {
      variant: {
        primary:   "bg-accent text-white border-transparent hover:bg-accent-700",
        secondary: "bg-white border-border-1 text-fg-1 hover:bg-slate-50 hover:border-slate-300",
        ghost:     "bg-transparent border-transparent text-fg-2 hover:bg-slate-100 hover:text-fg-1",
        danger:    "bg-danger text-white border-transparent hover:bg-[#a32a23]",
        success:   "bg-success text-white border-transparent hover:bg-success-700",
      },
      size: {
        sm: "h-7 px-[10px] text-[12px]",
        md: "",
        lg: "h-10 px-[18px] text-[14px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {icon && <span className="inline-flex">{icon}</span>}
      {children}
    </button>
  )
);
Button.displayName = "Button";
