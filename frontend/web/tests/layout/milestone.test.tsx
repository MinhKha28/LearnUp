import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app/routes';
import { makeUser, mockAuth } from '../authMock';
import { ROUTER_FUTURE_FLAGS } from '../routerFuture';

// vi.mock is hoisted above the imports: the app is built as for milestone 3
vi.mock('@/config/milestone', () => ({ CURRENT_MILESTONE: 3 }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('menu and routes follow CURRENT_MILESTONE', () => {
  it('shows every learner item and section at milestone 3', async () => {
    mockAuth(makeUser('LEARNER'));
    const { v7_relativeSplatPath, v7_startTransition } = ROUTER_FUTURE_FLAGS;
    const router = createMemoryRouter(routes, {
      initialEntries: ['/learner/certificates'],
      future: { v7_relativeSplatPath },
    });
    render(<RouterProvider router={router} future={{ v7_startTransition }} />);

    const nav = await screen.findByRole('navigation', { name: 'Điều hướng chính' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual([
      'Khóa học của tôi',
      'Danh mục khóa học',
      'Bài cần làm',
      'Bài cần chấm',
      'Chứng chỉ',
    ]);
    expect(within(nav).getAllByRole('group')).toHaveLength(3);
    // The milestone-3 route exists now
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Chứng chỉ' })
    ).toBeDefined();
  });
});
