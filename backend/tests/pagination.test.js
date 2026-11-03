const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, paginationMeta, pageResult, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../utils/pagination');

test('parsePagination uses defaults and alias limit', () => {
    assert.deepEqual(parsePagination({}), { page: 1, pageSize: DEFAULT_PAGE_SIZE, limit: DEFAULT_PAGE_SIZE, offset: 0 });
    assert.deepEqual(parsePagination({ limit: '1' }), { page: 1, pageSize: 1, limit: 1, offset: 0 });
    assert.deepEqual(parsePagination({ page: '3', pageSize: '5' }), { page: 3, pageSize: 5, limit: 5, offset: 10 });
});

test('parsePagination caps page size and ignores invalid values', () => {
    const capped = parsePagination({ pageSize: 9999 });
    assert.equal(capped.pageSize, MAX_PAGE_SIZE);
    assert.equal(parsePagination({ page: '0', pageSize: '-2' }).page, 1);
    assert.equal(parsePagination({ page: 'abc' }).page, 1);
});

test('paginationMeta reports totals and navigation flags', () => {
    assert.deepEqual(paginationMeta(0, { page: 1, pageSize: 20 }), {
        page: 1, pageSize: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false
    });
    assert.deepEqual(paginationMeta(45, { page: 2, pageSize: 20 }), {
        page: 2, pageSize: 20, total: 45, totalPages: 3, hasNext: true, hasPrev: true
    });
    assert.equal(paginationMeta(10, { page: 99, pageSize: 20 }).page, 1);
});

test('pageResult wraps items and metadata', () => {
    const result = pageResult(['a'], 1, { page: 1, pageSize: 20 });
    assert.equal(result.items[0], 'a');
    assert.equal(result.total, 1);
    assert.equal(result.pagination.totalPages, 1);
});
