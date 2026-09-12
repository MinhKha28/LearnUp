import { PaginationUtils } from '../../src/pagination/pagination.utils';

describe('PaginationUtils', () => {
  it('should clamp page index correctly', () => {
    expect(PaginationUtils.clampPage(undefined)).toBe(0);
    expect(PaginationUtils.clampPage(-5)).toBe(0);
    expect(PaginationUtils.clampPage('2')).toBe(2);
    expect(PaginationUtils.clampPage(3)).toBe(3);
  });

  it('should clamp page size within bounds', () => {
    expect(PaginationUtils.clampSize(undefined)).toBe(20);
    expect(PaginationUtils.clampSize(0)).toBe(20);
    expect(PaginationUtils.clampSize(-5)).toBe(20);
    expect(PaginationUtils.clampSize(50)).toBe(50);
    expect(PaginationUtils.clampSize(500)).toBe(100);
  });

  it('should calculate offset correctly', () => {
    expect(PaginationUtils.calculateOffset(0, 20)).toBe(0);
    expect(PaginationUtils.calculateOffset(1, 20)).toBe(20);
    expect(PaginationUtils.calculateOffset(3, 25)).toBe(75);
  });

  it('should slice and paginate in-memory array correctly', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    const page0 = PaginationUtils.paginateArray(list, 0, 3);
    expect(page0.items).toEqual(['A', 'B', 'C']);
    expect(page0.meta.page).toBe(0);
    expect(page0.meta.size).toBe(3);
    expect(page0.meta.totalElements).toBe(7);
    expect(page0.meta.totalPages).toBe(3);
    expect(page0.meta.hasNext).toBe(true);
    expect(page0.meta.hasPrevious).toBe(false);

    const page2 = PaginationUtils.paginateArray(list, 2, 3);
    expect(page2.items).toEqual(['G']);
    expect(page2.meta.hasNext).toBe(false);
    expect(page2.meta.hasPrevious).toBe(true);

    const pageOut = PaginationUtils.paginateArray(list, 10, 3);
    expect(pageOut.items).toEqual([]);
  });
});
