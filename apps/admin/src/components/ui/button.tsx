import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border bg-surface hover:bg-muted aria-pressed:bg-muted',
        ghost: 'hover:bg-muted',
      },
      size: { default: 'h-9 px-4', sm: 'h-8 px-3' },
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
