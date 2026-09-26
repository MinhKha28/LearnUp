import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { i18n } from '@/i18n';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

describe('PlaceholderPage', () => {
  afterEach(cleanup);

  it('shows the menu entry as the page title and an under-construction state', () => {
    render(<PlaceholderPage titleKey="learner.catalog" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Danh mục khóa học' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Trang đang được xây dựng' })
    ).toBeDefined();
  });

  it('translates the title', async () => {
    await i18n.changeLanguage('en');
    render(<PlaceholderPage titleKey="learner.catalog" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Course catalog' })).toBeDefined();
  });
});
