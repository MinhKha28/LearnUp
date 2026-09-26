import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cx } from '@/lib/cx';
import { IconButton } from './IconButton';
import styles from './Modal.module.css';

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the modal (rendered via asChild, so pass a single focusable element). */
  trigger?: React.ReactElement;
  /** Required: names the dialog for assistive tech. */
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Action buttons, rendered right-aligned at the bottom. */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible dialog (Radix): focus is trapped inside and restored on close,
 * Esc and the close button dismiss it, and background scrolling is locked.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={cx(styles.content, styles[size])}
          // Without a description Radix warns unless aria-describedby is explicitly undefined
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label={t('actions.close')} icon={<X />} className={styles.close} />
            </Dialog.Close>
          </div>

          {description && (
            <Dialog.Description className={styles.description}>{description}</Dialog.Description>
          )}

          {children && <div className={styles.body}>{children}</div>}

          {footer && <div className={styles.footer}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

/** Wrap a footer button with this to make it close the modal (e.g. "Hủy"). */
export const ModalClose = Dialog.Close;
