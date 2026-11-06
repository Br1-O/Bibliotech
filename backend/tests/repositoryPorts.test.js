const test = require('node:test');
const assert = require('node:assert/strict');

const contracts = [
    ['AuditLogRepositoryInterface', 'MariaDBAuditLogRepository'],
    ['CareerRepositoryInterface', 'MariaDBCareerRepository'],
    ['MaterialRepositoryInterface', 'MariaDBMaterialRepository'],
    ['NotificationRepositoryInterface', 'MariaDBNotificationRepository'],
    ['RoleRepositoryInterface', 'MariaDBRoleRepository'],
    ['SubjectRepositoryInterface', 'MariaDBSubjectRepository'],
    ['SubscriptionRepositoryInterface', 'MariaDBSubscriptionRepository'],
    ['ThematicTagRepositoryInterface', 'MariaDBThematicTagRepository'],
    ['UserRepositoryInterface', 'MariaDBUserRepository']
];

const methodNames = (prototype) =>
    Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function'
    );

for (const [portName, adapterName] of contracts) {
    test(`${adapterName} implements ${portName}`, () => {
        const Port = require(`../domain/ports/${portName}`);
        const Adapter = require(`../infrastructure/repositories/${adapterName}`);
        const prototype = Object.getPrototypeOf(new Adapter());
        for (const method of methodNames(Port.prototype)) {
            assert.equal(typeof prototype[method], 'function', `${adapterName}.${method} is missing`);
        }
    });
}
