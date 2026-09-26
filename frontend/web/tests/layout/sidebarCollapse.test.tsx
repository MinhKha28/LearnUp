import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout, useForceSidebarCollapsed } from '@/components/layout';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '@/components/layout/sidebarCollapse';
import { makeUser, mockAuth } from '../authMock';
import { ROUTER_FUTURE_FLAGS } from '../routerFuture';

/** Stands in for a Course workspace page that needs the full width. */
const CourseWorkspace: React.FC = () => {
  useForceSidebarCollapsed();
  return <p>Course workspace</p>;
};

const Harness: React.FC = () => {
  const [inCourse, setInCourse] = useState(false);
  return (
    <AppLayout>
      <button type="button" onClick={() => setInCourse((value) => !value)}>
        {inCourse ? 'Leave course' : 'Enter course'}
      </button>
      {inCourse && <CourseWorkspace />}
    </AppLayout>
  );
};

const renderShell = () => {
  mockAuth(makeUser('LEARNER'));
  render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={['/learner/catalog']}>
      <Harness />
    </MemoryRouter>
  );
};

const isCollapsed = () => document.querySelector('[data-sidebar-collapsed]') !== null;
const sidebarNav = () => screen.getByRole('navigation', { name: 'Điều hướng chính' });
const collapseButton = () => screen.getByRole('button', { name: 'Thu gọn thanh bên' });
const expandButton = () => screen.getByRole('button', { name: 'Mở rộng thanh bên' });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('collapsible sidebar', () => {
  it('collapses to icons only and expands again', async () => {
    renderShell();
    expect(isCollapsed()).toBe(false);
    expect(within(sidebarNav()).getByText('Danh mục khóa học')).toBeDefined();

    await userEvent.click(collapseButton());

    expect(isCollapsed()).toBe(true);
    // Label text is gone, but the link keeps its name and its active state
    expect(within(sidebarNav()).queryByText('Danh mục khóa học')).toBeNull();
    const catalog = within(sidebarNav()).getByRole('link', { name: 'Danh mục khóa học' });
    expect(catalog.getAttribute('aria-label')).toBe('Danh mục khóa học');
    expect(catalog.getAttribute('aria-current')).toBe('page');

    await userEvent.click(expandButton());

    expect(isCollapsed()).toBe(false);
    expect(within(sidebarNav()).getByText('Danh mục khóa học')).toBeDefined();
  });

  it('shows the item name in a tooltip while collapsed', async () => {
    renderShell();
    await userEvent.click(collapseButton());

    const courses = within(sidebarNav()).getByRole('link', { name: 'Khóa học của tôi' });
    fireEvent.focus(courses);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Khóa học của tôi');
  });

  it("saves the user's choice and restores it on the next visit", async () => {
    renderShell();
    await userEvent.click(collapseButton());
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

    cleanup();
    renderShell();
    expect(isCollapsed()).toBe(true);

    await userEvent.click(expandButton());
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');
  });

  it('still works when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    renderShell();
    expect(isCollapsed()).toBe(false);

    await userEvent.click(collapseButton());
    expect(isCollapsed()).toBe(true);
  });

  it("lets a child page force it collapsed, then gives back the user's choice", async () => {
    renderShell();
    expect(isCollapsed()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Enter course' }));
    expect(isCollapsed()).toBe(true);
    // Forcing is temporary: the saved choice is untouched
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Leave course' }));
    expect(isCollapsed()).toBe(false);
  });

  it('keeps a collapsed choice collapsed after leaving a forcing page', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'true');
    renderShell();

    await userEvent.click(screen.getByRole('button', { name: 'Enter course' }));
    expect(isCollapsed()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Leave course' }));
    expect(isCollapsed()).toBe(true);
  });

  it('can be expanded while forced without changing the saved choice', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Enter course' }));

    await userEvent.click(expandButton());
    expect(isCollapsed()).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Leave course' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enter course' }));
    expect(isCollapsed()).toBe(true);
  });
});
