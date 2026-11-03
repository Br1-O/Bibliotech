/**
* Project     : Bibliotech  |  Capa: Aplicacion / Utilidades
* Contrato unico de paginacion para listados HTTP.
*/

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const toPositiveInteger = (value, fallback) => {
    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) && number > 0 ? number : fallback;
};

function parsePagination(query = {}, options = {}) {
    const defaultPageSize = toPositiveInteger(options.defaultPageSize, DEFAULT_PAGE_SIZE);
    const maxPageSize = toPositiveInteger(options.maxPageSize, MAX_PAGE_SIZE);
    const page = toPositiveInteger(query.page, 1);
    const requestedSize = query.pageSize ?? query.page_size ?? query.limit;
    const pageSize = Math.min(toPositiveInteger(requestedSize, defaultPageSize), maxPageSize);
    return {
        page,
        pageSize,
        limit: pageSize,
        offset: (page - 1) * pageSize
    };
}

function paginationMeta(total, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    const count = Math.max(0, Number(total) || 0);
    const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(count / size));
    const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
    return {
        page: current,
        pageSize: size,
        total: count,
        totalPages,
        hasNext: current < totalPages,
        hasPrev: current > 1
    };
}

function pageResult(items, total, pagination) {
    return { items, total, pagination: paginationMeta(total, pagination) };
}

module.exports = {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    parsePagination,
    paginationMeta,
    pageResult
};
