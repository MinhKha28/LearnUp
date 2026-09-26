import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { i18n } from '@/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Modal,
  ModalClose,
  TextField,
  Tooltip,
} from '@/components/ui';

afterEach(cleanup);

const ControlledModal: React.FC<{ onConfirm?: () => void }> = ({ onConfirm }) => {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>Xóa học viên</Button>}
      title="Xóa học viên khỏi tổ chức?"
      description="Học viên sẽ mất quyền truy cập."
      footer={
        <>
          <ModalClose asChild>
            <Button variant="secondary">Hủy</Button>
          </ModalClose>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm?.();
              setOpen(false);
            }}
          >
            Xác nhận
          </Button>
        </>
      }
    >
      <TextField label="Lý do" />
    </Modal>
  );
};

describe('Modal', () => {
  it('opens from the trigger as a named, described dialog', async () => {
    render(<ControlledModal />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));

    const dialog = await screen.findByRole('dialog', { name: 'Xóa học viên khỏi tổ chức?' });
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe(
      'Học viên sẽ mất quyền truy cập.'
    );
  });

  it('moves focus inside the dialog when it opens', async () => {
    render(<ControlledModal />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Esc and returns focus to the trigger', async () => {
    render(<ControlledModal />);
    const trigger = screen.getByRole('button', { name: 'Xóa học viên' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with the i18n-labelled close button', async () => {
    render(<ControlledModal />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes from a footer action wrapped in ModalClose, and runs footer handlers', async () => {
    const onConfirm = vi.fn();
    render(<ControlledModal onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps Tab focus inside the dialog', async () => {
    render(<ControlledModal />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));
    const dialog = await screen.findByRole('dialog');

    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('locks background scrolling while open', async () => {
    render(<ControlledModal />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa học viên' }));
    await screen.findByRole('dialog');

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.body.hasAttribute('data-scroll-locked')).toBe(false));
  });

  it('labels the close button in English after switching language', async () => {
    await i18n.changeLanguage('en');
    render(<Modal open title="Confirm" />);
    expect(await screen.findByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('renders without a description and without aria-describedby', async () => {
    render(<Modal open title="Chỉ có tiêu đề" />);
    const dialog = await screen.findByRole('dialog', { name: 'Chỉ có tiêu đề' });
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
  });
});

const UserMenu: React.FC<{ onProfile: () => void; onSignOut: () => void }> = ({
  onProfile,
  onSignOut,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button>Menu người dùng</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
      <DropdownMenuItem onSelect={onProfile}>Hồ sơ</DropdownMenuItem>
      <DropdownMenuItem disabled>Mục không khả dụng</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem tone="danger" onSelect={onSignOut}>
        Đăng xuất
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

describe('DropdownMenu', () => {
  it('opens a menu of menuitems from the trigger', async () => {
    render(<UserMenu onProfile={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Menu người dùng' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(trigger);

    expect(await screen.findByRole('menu')).toBeDefined();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Hồ sơ',
      'Mục không khả dụng',
      'Đăng xuất',
    ]);
    expect(
      screen.getByRole('menuitem', { name: 'Mục không khả dụng' }).getAttribute('aria-disabled')
    ).toBe('true');
  });

  it('runs onSelect and closes when an item is chosen with the keyboard', async () => {
    const onSignOut = vi.fn();
    render(<UserMenu onProfile={vi.fn()} onSignOut={onSignOut} />);

    screen.getByRole('button', { name: 'Menu người dùng' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');

    // Arrow keys skip the disabled item
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('Đăng xuất');
    await userEvent.keyboard('{Enter}');

    expect(onSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('closes on Esc and returns focus to the trigger', async () => {
    render(<UserMenu onProfile={vi.fn()} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Menu người dùng' });

    await userEvent.click(trigger);
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Tooltip', () => {
  it('shows on keyboard focus and describes its trigger', async () => {
    render(
      <Tooltip content="Tải xuống báo cáo dạng Excel">
        <Button>Tải báo cáo</Button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Tải báo cáo' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Tải xuống báo cáo dạng Excel');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('hides on Esc', async () => {
    render(
      <Tooltip content="Gợi ý">
        <Button>Nút</Button>
      </Tooltip>
    );
    await userEvent.tab();
    await screen.findByRole('tooltip');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });
});
