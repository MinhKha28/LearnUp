const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UsersService } = require('../dist/src/modules/users/users.service');

test('Organizer batch lookup returns only live Instructors in its Organization', async () => {
  const organizer = { role: 'ORGANIZER', organizationId: 'org-a' };
  const instructor = { id: 'same-org', fullName: 'Demo Instructor' };
  const activeInstructor = {
    ...instructor,
    organizationId: organizer.organizationId,
    role: 'Instructor',
    deletedAt: null,
  };
  const rows = [
    activeInstructor,
    { ...activeInstructor, id: 'other-org', organizationId: 'org-b' },
    { ...activeInstructor, id: 'deleted', deletedAt: new Date() },
    { ...activeInstructor, id: 'learner', role: 'Learner' },
  ];
  const service = Object.create(UsersService.prototype);
  service.prisma = {
    user: {
      findMany: async ({ where, select }) => {
        assert.deepEqual(select, { id: true, fullName: true });
        return rows
          .filter(row =>
            where.id.in.includes(row.id) &&
            row.organizationId === where.organizationId &&
            row.role === where.role &&
            row.deletedAt === where.deletedAt,
          )
          .map(({ id, fullName }) => ({ id, fullName }));
      },
    },
  };

  assert.deepEqual(
    await service.findBatch(organizer, rows.map(row => row.id)),
    [instructor],
  );
});
