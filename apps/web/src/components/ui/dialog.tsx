import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { Button } from './button';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-[var(--surface)] p-6 shadow-xl focus:outline-none',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close asChild>
          <button
            type="button"
            aria-label={t('common.close')}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <DialogPrimitive.Title className="text-lg font-semibold text-[var(--text)]">
        {title}
      </DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-sm text-[var(--text-muted)]">
          {description}
        </DialogPrimitive.Description>
      ) : null}
    </div>
  );
}

function DialogFooter({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex justify-end gap-2">
      <DialogPrimitive.Close asChild>
        <Button variant="secondary">{t('common.cancel')}</Button>
      </DialogPrimitive.Close>
      {children}
    </div>
  );
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter };
