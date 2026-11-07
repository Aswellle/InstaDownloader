import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Loader2, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
        secondary: 'bg-surface-hover text-app hover:bg-surface-active',
        ghost: 'text-muted hover:bg-surface-hover hover:text-app',
        outline: 'border border-app-strong text-app hover:bg-surface-hover'
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
        icon: 'h-8 w-8'
      }
    },
    defaultVariants: { variant: 'secondary', size: 'md' }
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-lg border border-app bg-surface px-3 text-sm text-app placeholder:text-subtle focus-visible:border-zinc-400 focus-visible:outline-none dark:focus-visible:border-zinc-500',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function Progress({
  value,
  className,
  indeterminate = false
}: {
  value: number
  className?: string
  indeterminate?: boolean
}) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-active', className)}>
      {indeterminate ? (
        <div className="progress-indeterminate h-full w-1/3 rounded-full bg-rose-500" />
      ) : (
        <div
          className="h-full rounded-full bg-rose-500 transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
        />
      )}
    </div>
  )
}

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      tone: {
        waiting: 'bg-surface-hover text-subtle',
        downloading: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
        paused: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        failed: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        canceled: 'bg-surface-hover text-subtle',
        neutral: 'bg-surface-hover text-app'
      }
    },
    defaultVariants: { tone: 'neutral' }
  }
)

export function Badge({
  tone,
  children,
  className
}: VariantProps<typeof badgeVariants> & { children: React.ReactNode; className?: string }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-hover', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-muted', className)} />
}

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  className
}: {
  checked: boolean
  indeterminate?: boolean
  onChange?: (e: React.MouseEvent) => void
  className?: string
}) {
  const active = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate && !checked ? 'mixed' : checked}
      onClick={onChange}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
        active
          ? 'border-rose-600 bg-rose-600 text-white'
          : 'border-zinc-400 bg-white/70 text-transparent hover:border-zinc-600 dark:border-zinc-500 dark:bg-black/40 dark:hover:border-zinc-300',
        className
      )}
    >
      {indeterminate ? <Minus className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
    </button>
  )
}
