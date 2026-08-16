import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui text-sm font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'border border-border bg-surface text-text hover:bg-hover',
        outline:
          'border border-border bg-transparent text-text hover:bg-hover',
        ghost: 'border border-border bg-surface text-text hover:bg-hover',
        danger: 'bg-danger text-white hover:bg-[#a72c2c]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-[14px] py-2',
        sm: 'px-3 py-1.5 text-xs',
        lg: 'px-6 py-3 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
