import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE_FLAGS } from './routerFuture';
import { makeUser, mockAuth } from './authMock';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

const renderPage = (page: React.ReactElement) =>
  render(<MemoryRouter future={ROUTER_FUTURE_FLAGS}>{page}</MemoryRouter>);

describe('status pages', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('NotFoundPage links a signed-in user to their role home', () => {
    mockAuth(makeUser('ORGANIZER'));
    renderPage(<NotFoundPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: '404 — Không tìm thấy trang' })
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe(
      '/organizer/instructors'
    );
  });

  it('NotFoundPage links a guest to the sign-in page', () => {
    mockAuth(null);
    renderPage(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Đến trang đăng nhập' }).getAttribute('href')).toBe(
      '/login'
    );
  });

  it('UnauthorizedPage shows the translated role in bold and links to the role home', () => {
    mockAuth(makeUser('LEARNER'));
    renderPage(<UnauthorizedPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: '403 — Không có quyền truy cập' })
    ).toBeDefined();
    expect(screen.getByText('Học viên').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe(
      '/learner/courses'
    );
  });

  it('UnauthorizedPage falls back to the guest label and the sign-in page without a user', () => {
    mockAuth(null);
    renderPage(<UnauthorizedPage />);

    expect(screen.getByText('Khách').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Đến trang đăng nhập' }).getAttribute('href')).toBe(
      '/login'
    );
  });
});
