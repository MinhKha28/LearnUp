import React, { forwardRef } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { cx } from '@/lib/cx';
import styles from './DropdownMenu.module.css';

/**
 * Accessible menu (Radix): role="menu", arrow-key navigation, typeahead, Esc to close,
 * focus returns to the trigger. Compose it like Radix:
 *
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button>…</Button></DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem onSelect={…}>…</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.Content>
>(({ className, sideOffset = 6, align = 'end', ...rest }, ref) => (
  <Menu.Portal>
    <Menu.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cx(styles.content, className)}
      {...rest}
    />
  </Menu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, icon, tone = 'default', children, ...rest }, ref) => (
    <Menu.Item
      ref={ref}
      className={cx(styles.item, tone === 'danger' && styles.danger, className)}
      {...rest}
    >
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Menu.Item>
  )
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.Label>
>(({ className, ...rest }, ref) => (
  <Menu.Label ref={ref} className={cx(styles.label, className)} {...rest} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.Separator>
>(({ className, ...rest }, ref) => (
  <Menu.Separator ref={ref} className={cx(styles.separator, className)} {...rest} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuRadioGroup = Menu.RadioGroup;

/** A checkable option inside DropdownMenuRadioGroup; the check mark shows on the selected one. */
export const DropdownMenuRadioItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof Menu.RadioItem>
>(({ className, children, ...rest }, ref) => (
  <Menu.RadioItem ref={ref} className={cx(styles.item, className)} {...rest}>
    <span className={styles.indicator} aria-hidden="true">
      <Menu.ItemIndicator>
        <Check />
      </Menu.ItemIndicator>
    </span>
    {children}
  </Menu.RadioItem>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';
