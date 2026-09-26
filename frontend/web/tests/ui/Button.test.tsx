import React, { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui';

afterEach(cleanup);

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Lưu</Button>
      </form>
    );

    expect(screen.getByRole('button', { name: 'Lưu' }).getAttribute('type')).toBe('button');
  });

  it('can still be a submit button', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Gửi</Button>
      </form>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tạo khóa học</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Tạo khóa học' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Tạo khóa học
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Tạo khóa học' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('isLoading disables the button, sets aria-busy and keeps the accessible name', async () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Lưu thay đổi
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Lưu thay đổi' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    // The spinner is decorative: no extra status role inside the button
    expect(screen.queryByRole('status')).toBeNull();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not set aria-busy when not loading', () => {
    render(<Button>Lưu</Button>);
    expect(screen.getByRole('button').hasAttribute('aria-busy')).toBe(false);
  });

  it('renders icons as decorative so they do not change the accessible name', () => {
    render(
      <Button leftIcon={<Plus data-testid="left" />} rightIcon={<Plus data-testid="right" />}>
        Thêm
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Thêm' })).toBeDefined();
    expect(screen.getByTestId('left').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByTestId('right').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('forwards the ref to the <button>', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Lưu</Button>);
    expect(ref.current).toBe(screen.getByRole('button'));
  });
});

describe('IconButton', () => {
  it('uses aria-label as its accessible name', async () => {
    const onClick = vi.fn();
    render(<IconButton aria-label="Xóa khóa học" icon={<Plus />} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Xóa khóa học' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides the icon from assistive tech', () => {
    render(<IconButton aria-label="Thêm" icon={<Plus data-testid="icon" />} />);
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('isLoading disables it and sets aria-busy', () => {
    render(<IconButton aria-label="Tải lên" icon={<Plus />} isLoading />);

    const button = screen.getByRole('button', { name: 'Tải lên' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('forwards the ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} aria-label="Thêm" icon={<Plus />} />);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Thêm' }));
  });
});
