import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { i18n } from '@/i18n';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingScreen,
  Spinner,
} from '@/components/ui';

afterEach(cleanup);

describe('Alert', () => {
  it('danger uses role="alert" so it is announced immediately', () => {
    render(
      <Alert tone="danger" title="Đăng nhập không thành công">
        Kiểm tra lại email và mật khẩu.
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Đăng nhập không thành công');
    expect(alert.textContent).toContain('Kiểm tra lại email và mật khẩu.');
  });

  it.each(['info', 'success', 'warning'] as const)('%s uses role="status"', (tone) => {
    render(<Alert tone={tone}>Thông báo</Alert>);
    expect(screen.getByRole('status').textContent).toContain('Thông báo');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('defaults to the info tone (role="status")', () => {
    render(<Alert>Mặc định</Alert>);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('keeps its icon out of the accessibility tree', () => {
    render(<Alert tone="success">Đã lưu</Alert>);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Badge', () => {
  it.each(['neutral', 'info', 'success', 'warning', 'danger'] as const)(
    'renders its text as content (%s)',
    (tone) => {
      render(<Badge tone={tone}>Quá hạn</Badge>);
      expect(screen.getByText('Quá hạn')).toBeDefined();
    }
  );

  it('passes through aria attributes', () => {
    render(<Badge aria-label="Trạng thái: Quá hạn">Quá hạn</Badge>);
    expect(screen.getByLabelText('Trạng thái: Quá hạn')).toBeDefined();
  });
});

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Nội dung</Card>);
    expect(screen.getByText('Nội dung')).toBeDefined();
  });

  it('can be a labelled landmark (section)', () => {
    render(
      <Card as="section" aria-labelledby="card-title">
        <h2 id="card-title">Gói đã chọn</h2>
      </Card>
    );
    expect(screen.getByRole('region', { name: 'Gói đã chọn' })).toBeDefined();
  });
});

describe('Spinner', () => {
  it('is a status with the default i18n label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status').textContent).toBe('Đang tải…');
  });

  it('uses the English default after switching language', async () => {
    await i18n.changeLanguage('en');
    render(<Spinner />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
  });

  it('accepts a custom label', () => {
    render(<Spinner label="Đang đồng bộ tiến độ" />);
    expect(screen.getByRole('status').textContent).toBe('Đang đồng bộ tiến độ');
  });

  it('decorative spinners are hidden and have no status role', () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('LoadingScreen', () => {
  it('announces exactly its message as a status', () => {
    render(<LoadingScreen message="Đang xác thực phiên đăng nhập…" />);
    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].textContent).toBe('Đang xác thực phiên đăng nhập…');
  });
});

describe('EmptyState', () => {
  it('renders a heading (h2 by default), description, decorative icon and action', () => {
    render(
      <EmptyState
        icon={<Inbox data-testid="icon" />}
        title="Chưa có gói nào"
        description="Vui lòng quay lại sau."
        action={<Button>Làm mới</Button>}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Chưa có gói nào' })).toBeDefined();
    expect(screen.getByText('Vui lòng quay lại sau.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDefined();
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('supports another heading level', () => {
    render(<EmptyState title="Trống" headingLevel={3} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Trống' })).toBeDefined();
  });
});

describe('Avatar', () => {
  it('renders the image with the person name as alt text', () => {
    render(<Avatar name="Trần Minh Đức" src="/avatar.png" />);
    const img = screen.getByRole('img', { name: 'Trần Minh Đức' });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/avatar.png');
  });

  it('shows initials (first + last word) exposed as an image named after the person', () => {
    render(<Avatar name="Nguyễn Văn An" />);
    const avatar = screen.getByRole('img', { name: 'Nguyễn Văn An' });
    expect(avatar.tagName).toBe('SPAN');
    expect(avatar.textContent).toBe('NA');
  });

  it('upper-cases Vietnamese initials and handles single names', () => {
    render(
      <>
        <Avatar name="đỗ thùy linh" />
        <Avatar name="learner1" />
      </>
    );
    expect(screen.getByRole('img', { name: 'đỗ thùy linh' }).textContent).toBe('ĐL');
    expect(screen.getByRole('img', { name: 'learner1' }).textContent).toBe('L');
  });

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar name="Mai Nguyen" src="/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Mai Nguyen' }));

    const fallback = screen.getByRole('img', { name: 'Mai Nguyen' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('MN');
  });
});
