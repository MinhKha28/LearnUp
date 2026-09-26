import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UiShowcasePage } from '@/dev/UiShowcasePage';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('/dev/ui showcase', () => {
  it('renders every component section and switches between vi and en', async () => {
    render(<UiShowcasePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Thư viện component giao diện' })
    ).toBeDefined();
    const sections = screen.getAllByRole('region');
    expect(sections.length).toBe(14);
    // Component defaults come from i18n
    expect(screen.getAllByRole('button', { name: 'Hiện mật khẩu' }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByRole('heading', { level: 1, name: 'UI component library' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Show password' }).length).toBeGreaterThan(0);
  });
});
