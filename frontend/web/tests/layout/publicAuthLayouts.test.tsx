import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AuthLayout, LanguageSwitcher, PublicLayout } from '@/components/layout';
import { i18n, LANGUAGE_STORAGE_KEY } from '@/i18n';
import { ROUTER_FUTURE_FLAGS } from '../routerFuture';

const renderAt = (path: string, ui: React.ReactElement) =>
  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[path]}>
      {ui}
    </MemoryRouter>
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('LanguageSwitcher', () => {
  const Greeting: React.FC = () => {
    const { t } = useTranslation();
    return <p>{t('actions.signOut')}</p>;
  };

  it('marks the current language as pressed', () => {
    render(<LanguageSwitcher />);
    const group = screen.getByRole('group', { name: 'Ngôn ngữ' });

    expect(
      within(group).getByRole('button', { name: 'Tiếng Việt' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      within(group).getByRole('button', { name: 'English' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('switches the text, saves the choice in localStorage and updates <html lang>', async () => {
    render(
      <>
        <LanguageSwitcher />
        <Greeting />
      </>
    );
    expect(screen.getByText('Đăng xuất')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await waitFor(() => expect(screen.getByText('Sign out')).toBeDefined());
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(
      'true'
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    await waitFor(() => expect(i18n.language).toBe('vi'));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  });
});

describe('PublicLayout', () => {
  it('has a header with logo, pricing link, language switcher and sign-in, content and footer', () => {
    renderAt(
      '/pricing',
      <PublicLayout>
        <h1>Nội dung trang</h1>
      </PublicLayout>
    );

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'LearnUP' })).toBeDefined();
    const pricing = within(
      within(header).getByRole('navigation', { name: 'Điều hướng trang công khai' })
    ).getByRole('link', { name: 'Bảng giá' });
    expect(pricing.getAttribute('aria-current')).toBe('page');
    expect(within(header).getByRole('group', { name: 'Ngôn ngữ' })).toBeDefined();
    expect(within(header).getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe(
      '/login'
    );

    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: 'Nội dung trang' })
    ).toBeDefined();
    expect(within(screen.getByRole('contentinfo')).getByText(/© \d{4} LearnUP/)).toBeDefined();
  });
});

describe('AuthLayout', () => {
  it('shows the default hero, a back link, the language switcher and the form', () => {
    renderAt(
      '/login',
      <AuthLayout>
        <form aria-label="Đăng nhập" />
      </AuthLayout>
    );

    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Đào tạo nội bộ cho mọi tổ chức')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Quay lại' }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeDefined();
    expect(within(screen.getByRole('main')).getByRole('form', { name: 'Đăng nhập' })).toBeDefined();
  });

  it('takes the panel content and the back link from props', () => {
    renderAt(
      '/register',
      <AuthLayout
        heroTitle="Đăng ký tổ chức"
        heroDescription="Ba bước để bắt đầu."
        panelContent={<ol aria-label="Các bước" />}
        backTo="/pricing"
        backLabel="Về bảng giá"
      />
    );

    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText('Đăng ký tổ chức')).toBeDefined();
    expect(within(panel).getByText('Ba bước để bắt đầu.')).toBeDefined();
    expect(within(panel).getByRole('list', { name: 'Các bước' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Về bảng giá' }).getAttribute('href')).toBe('/pricing');
  });
});
