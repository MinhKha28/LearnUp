import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: React.ReactNode;
  /** A single focusable element; the tooltip shows on hover and keyboard focus. */
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

/**
 * Supplementary hint only — never put essential information or interactive content in a tooltip
 * (touch users cannot hover). The trigger gets aria-describedby while it is open.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delayDuration = 300,
}) => (
  <RadixTooltip.Provider delayDuration={delayDuration}>
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={6} className={styles.content}>
          {content}
          <RadixTooltip.Arrow className={styles.arrow} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
);
