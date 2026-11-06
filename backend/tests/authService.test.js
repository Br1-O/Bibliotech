const test = require('node:test');
const assert = require('node:assert/strict');
const AuthService = require('../application/services/AuthService');

test('listUsers delegates the documented query filters to the repository', async () => {
    const calls = [];
    const userRepository = {
        async findAll(filters) {
            calls.push(filters);
            return { items: [{ id: 1 }], total: 1 };
        }
    };
    const service = new AuthService(userRepository, null, null, null, null, null);
    const filters = { page: 2, pageSize: 25, q: 'ana', role: 'Alumno', estado: 'activo' };

    const result = await service.listUsers(filters);

    assert.deepEqual(calls, [filters]);
    assert.equal(result.total, 1);
    assert.deepEqual(result.items, [{ id: 1 }]);
});
