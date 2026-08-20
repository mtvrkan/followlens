import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-8 items-center justify-between gap-1 rounded-md border border-border bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary',
      className,
    )}
    {...props}
  >
    {/* min-w-0 lets this shrink inside the flex row instead of pushing the
        chevron out when the selected label is long (e.g. a long username). */}
    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', sideOffset = 4, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-h-96 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        // Without this, Radix sizes the popper to its own content instead of
        // matching the trigger — the dropdown ends up a different width than
        // the button that opened it.
        position === 'popper' &&
          'w-[var(--radix-select-trigger-width)] min-w-[8rem] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="w-full min-w-0 p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // Logical padding/offset (ps/pe + start) so the checkmark gutter moves to
      // the right-hand side under dir="rtl" (Arabic) instead of staying on the
      // left and overlapping the item's label.
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pe-2 ps-6 text-xs outline-none focus:bg-muted data-[state=checked]:font-medium',
      className,
    )}
    {...props}
  >
    <span className="absolute start-2 flex h-3 w-3 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3 w-3" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText asChild>
      <span className="block truncate">{children}</span>
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'
