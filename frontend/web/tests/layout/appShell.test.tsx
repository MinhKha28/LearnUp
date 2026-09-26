import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app/routes';
import { i18n } from '@/i18n';
import type { AuthUser } from '@/types/auth';
import { makeUser, mockAuth } from '../authMock';
import { ROUTER_FUTURE_FLAGS } from '../routerFuture';

const renderApp = (path: string, user: AuthUser | null) => {
  const auth = mockAuth(user);
  const { v7_relativeSplatPath, v7_startTransition } = ROUTER_FUTURE_FLAGS;
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
    future: { v7_relativeSplatPath },
  });
  render(<RouterProvider router={router} future={{ v7_startTransition }} />);
  return { auth, router };
};

/** The fixed sidebar's navigation (the drawer, when open, has its own). */
const mainNav = () => screen.getAllByRole('navigation', { name: 'Điều hướng chính' })[0];

const linkNames = (container: HTMLElement) =>
  within(container)
    .getAllByRole('link')
    .map((link) => link.textContent);

/** Section labels, read through each group's aria-labelledby. */
const sectionLabels = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('group')
    .map((group) => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AppLayout sidebar menu', () => {
  it.each([
    ['ADMIN', '/admin/plans', ['Gói dịch vụ'], ['Nền tảng']],
    [
      'ORGANIZER',
      '/organizer/instructors',
      ['Giảng viên', 'Học viên', 'Phân công'],
      ['Thành viên', 'Đào tạo'],
    ],
    ['INSTRUCTOR', '/instructor/courses', ['Khóa học phụ trách'], ['Giảng dạy']],
    ['LEARNER', '/learner/courses', ['Khóa học của tôi', 'Danh mục khóa học'], ['Học tập']],
  ] as const)(
    '%s sees only its milestone-1 items, grouped by section',
    async (role, path, items, sections) => {
      renderApp(path, makeUser(role));

      const nav = await screen.findByRole('navigation', { name: 'Điều hướng chính' });
      expect(linkNames(nav)).toEqual(items);
      expect(sectionLabels(nav)).toEqual(sections);
    }
  );

  it('marks only the current page with aria-current="page", also on nested pages', async () => {
    const { router } = renderApp('/learner/catalog', makeUser('LEARNER'));

    const nav = await screen.findByRole('navigation', { name: 'Điều hướng chính' });
    const catalog = within(nav).getByRole('link', { name: 'Danh mục khóa học' });
    expect(catalog.getAttribute('aria-current')).toBe('page');
    expect(
      within(nav).getByRole('link', { name: 'Khóa học của tôi' }).hasAttribute('aria-current')
    ).toBe(false);

    await act(() => router.navigate('/learner/courses'));
    await waitFor(() =>
      expect(
        within(mainNav())
          .getByRole('link', { name: 'Khóa học của tôi' })
          .getAttribute('aria-current')
      ).toBe('page')
    );
    expect(catalog.hasAttribute('aria-current')).toBe(false);
  });

  it('renders the page inside the layout: h1 in the content area, header on one line', async () => {
    renderApp('/organizer/learners', makeUser('ORGANIZER', { organizationName: 'Công ty ABC' }));

    const main = await screen.findByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Học viên' })).toBeDefined();

    const header = screen.getByRole('banner');
    expect(within(header).getByText('Công ty ABC')).toBeDefined();
    expect(within(header).getByRole('button', { name: 'Thông báo' })).toBeDefined();
    expect(within(header).getByRole('button', { name: 'Menu tài khoản' })).toBeDefined();
    expect(within(header).queryByRole('heading')).toBeNull();
  });

  it('falls back to the app name when the organization name is unknown', async () => {
    renderApp('/learner/courses', makeUser('LEARNER'));
    const header = await screen.findByRole('banner');
    expect(within(header).getByText('LearnUP')).toBeDefined();
  });

  it('shows "platform administration" instead of an organization for an admin', async () => {
    renderApp('/admin/plans', makeUser('ADMIN', { organizationName: 'Không dùng' }));
    const header = await screen.findByRole('banner');
    expect(within(header).getByText('Quản trị nền tảng')).toBeDefined();
    expect(within(header).queryByText('Không dùng')).toBeNull();

    await act(() => i18n.changeLanguage('en'));
    expect(within(header).getByText('Platform administration')).toBeDefined();
  });
});

describe('routing', () => {
  it.each([
    ['ADMIN', '/admin/plans'],
    ['ORGANIZER', '/organizer/instructors'],
    ['INSTRUCTOR', '/instructor/courses'],
    ['LEARNER', '/learner/courses'],
  ] as const)('"/" and the role root send %s to %s', async (role, home) => {
    const { router } = renderApp('/', makeUser(role));
    await waitFor(() => expect(router.state.location.pathname).toBe(home));

    const base = home.split('/')[1];
    await act(() => router.navigate(`/${base}`));
    await waitFor(() => expect(router.state.location.pathname).toBe(home));
  });

  it('RoleRoute sends a user of another role to the 403 page', async () => {
    const { router } = renderApp('/admin/plans', makeUser('LEARNER'));

    expect(
      await screen.findByRole('heading', { level: 1, name: '403 — Không có quyền truy cập' })
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/unauthorized');
    expect(screen.getByRole('link', { name: 'Về trang chủ' }).getAttribute('href')).toBe(
      '/learner/courses'
    );
  });

  it('sends a guest to /login, rendered inside AuthLayout', async () => {
    const { router } = renderApp('/learner/courses', null);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeDefined();
  });

  it('answers 404 for a menu item of a later milestone', async () => {
    renderApp('/learner/certificates', makeUser('LEARNER'));
    expect(
      await screen.findByRole('heading', { level: 1, name: '404 — Không tìm thấy trang' })
    ).toBeDefined();
  });
});

describe('user menu', () => {
  const openUserMenu = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Menu tài khoản' }));
    return screen.findByRole('menu');
  };

  it('shows the name, role, account pages, language and sign out', async () => {
    renderApp('/learner/courses', makeUser('LEARNER'));
    const menu = await openUserMenu();

    expect(within(menu).getByText('Nguyễn Văn An')).toBeDefined();
    expect(within(menu).getByText('Học viên')).toBeDefined();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual(['Hồ sơ', 'Đổi mật khẩu', 'Đăng xuất']);
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent)
    ).toEqual(['Tiếng Việt', 'English']);
  });

  it('opens the profile placeholder page', async () => {
    const { router } = renderApp('/learner/courses', makeUser('LEARNER'));
    const menu = await openUserMenu();

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Hồ sơ' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/account/profile'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Hồ sơ' })).toBeDefined();
  });

  it('signs out and goes to /login', async () => {
    const { auth, router } = renderApp('/learner/courses', makeUser('LEARNER'));
    // Like the real AuthProvider, signing out clears the user
    vi.mocked(auth.logout).mockImplementation(() => void mockAuth(null));
    const menu = await openUserMenu();

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Đăng xuất' }));

    expect(auth.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('switches the language from the menu', async () => {
    renderApp('/learner/courses', makeUser('LEARNER'));
    const menu = await openUserMenu();

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'English' }));

    await waitFor(() => expect(i18n.language).toBe('en'));
    expect(localStorage.getItem('learnup.language')).toBe('en');
    const nav = screen.getAllByRole('navigation', { name: 'Main navigation' })[0];
    expect(within(nav).getByRole('link', { name: 'My courses' })).toBeDefined();
  });
});

describe('navigation drawer (below 1024px)', () => {
  const openDrawer = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Mở menu điều hướng' }));
    return screen.findByRole('dialog', { name: 'Menu điều hướng' });
  };

  it('opens with the same menu and closes on Esc', async () => {
    renderApp('/learner/courses', makeUser('LEARNER'));
    const drawer = await openDrawer();

    const nav = within(drawer).getByRole('navigation', { name: 'Điều hướng chính' });
    expect(linkNames(nav)).toEqual(['Khóa học của tôi', 'Danh mục khóa học']);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes when an item is chosen and navigates to it', async () => {
    const { router } = renderApp('/learner/courses', makeUser('LEARNER'));
    const drawer = await openDrawer();

    await userEvent.click(within(drawer).getByRole('link', { name: 'Danh mục khóa học' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/learner/catalog');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Danh mục khóa học' })
    ).toBeDefined();
  });

  it('closes with its close button', async () => {
    renderApp('/learner/courses', makeUser('LEARNER'));
    const drawer = await openDrawer();

    await userEvent.click(within(drawer).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
