// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ReadingResource } from './reading.resource';
import { fetchReadingAccess } from '@/services/learning.service';
vi.mock('@/components/context/app.context', () => ({ useCurrentApp: () => ({ user: { id: 'u', organizationId: 'o' } }) }));
const enrollment = vi.hoisted(() => ({ status: 'InProgress' }));
vi.mock('@/hooks/use.api.query', () => ({ useApiQuery: () => ({ data: enrollment, reload: vi.fn() }) }));
vi.mock('@/hooks/use.learning.refresh', () => ({ useLearningRefresh: vi.fn(), notifyLearningProgress: vi.fn() }));
vi.mock('@/services/learning.service', () => ({ fetchReadingAccess: vi.fn(), fetchCurriculum: vi.fn(), completeReading: vi.fn() }));
afterEach(() => { enrollment.status = 'InProgress'; cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const CurrentPath = () => <output>{useLocation().pathname}</output>;
const mount = () => render(<MemoryRouter><CurrentPath /><ReadingResource enrollmentId="e" lessonId="l" material={{ materialId: 'm', title: 'PDF', materialType: 'Reading', isRequired: false, completed: false, durationSeconds: null }} /></MemoryRouter>);
it('requests a fresh URL on each click and starts a same-page download without a popup', async () => {
  const open = vi.spyOn(window, 'open');
  const downloads: { href: string; target: string; download: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ href: this.href, target: this.target, download: this.download });
  });
  vi.mocked(fetchReadingAccess).mockResolvedValue({ accessUrl: 'https://example.test/new.pdf', materialId: 'm', title: 'PDF', expiresAt: new Date().toISOString(), mimeType: 'application/pdf', fixture: false });
  mount();
  expect(fetchReadingAccess).not.toHaveBeenCalled();
  for (let i = 1; i <= 2; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'Mở tài liệu đọc' }));
    await waitFor(() => expect(downloads).toHaveLength(i));
    expect(fetchReadingAccess).toHaveBeenCalledTimes(i);
  }
  expect(downloads).toEqual(Array(2).fill({ href: 'https://example.test/new.pdf', target: '', download: '' }));
  expect(open).not.toHaveBeenCalled();
  expect(document.querySelector('a[download]')).toBeNull();
});
it('does not navigate and shows the Vietnamese error if fresh access fails; a later click can recover', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.mocked(fetchReadingAccess).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ accessUrl: 'https://example.test/new.pdf', materialId: 'm', title: 'PDF', expiresAt: new Date().toISOString(), mimeType: 'application/pdf', fixture: false });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Mở tài liệu đọc' }));
  await screen.findByText('Chưa thể mở tài liệu. Vui lòng thử lại.');
  expect(click).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mở tài liệu đọc' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(screen.queryByText('Chưa thể mở tài liệu. Vui lòng thử lại.')).toBeNull();
});

it('names the reading and course states separately when the course is complete', () => {
  enrollment.status = 'Completed';
  mount();
  expect(screen.getByText('Tài liệu: Chưa hoàn thành')).toBeTruthy();
  expect(screen.getByText('Khóa học: Đã hoàn thành')).toBeTruthy();
});

it('places the lesson button at the top of the resource card and opens the lesson', async () => {
  mount();
  const back = screen.getByRole('button', { name: 'Về bài học' });
  const card = screen.getByRole('heading', { name: 'PDF' }).closest('section');
  expect(card?.firstElementChild).toBe(back);
  fireEvent.click(back);
  expect(await screen.findByText('/learner/courses/e/lessons/l')).toBeTruthy();
});
