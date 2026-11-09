import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-sunk font-normal text-foreground hover:bg-border aria-pressed:bg-border',
        danger: 'bg-destructive-soft font-normal text-destructive hover:bg-destructive-soft/70',
        ghost: 'font-normal hover:bg-sunk',
      },
      size: { default: 'h-9 px-[15px]', sm: 'h-[30px] rounded-lg px-[11px] text-xs' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

/** shadcn/ui's Button in the admin's tokens. */
export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
