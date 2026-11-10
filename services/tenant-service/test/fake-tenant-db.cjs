// Prisma giả trong bộ nhớ cho unit test của UsersService (UC12.5, UC12.6, UC13.5).
// Chỉ hỗ trợ đúng các truy vấn mà luồng đổi trạng thái / xóa Instructor dùng. Transaction lỗi thì
// trả lại toàn bộ trạng thái như trước khi bắt đầu (giống rollback). Không phải Postgres: không kiểm
// khóa, chỉ mục duy nhất hay đồng thời – các ca đó thuộc integration test.
const { UsersService } = require('../dist/src/modules/users/users.service');

const ORG_A = '01900000-0000-7000-8000-00000000a001';
const ORG_B = '01900000-0000-7000-8000-00000000b001';
const ORGANIZER = {
  userId: '01900000-0000-7000-8000-00000000a010',
  role: 'ORGANIZER',
  organizationId: ORG_A,
};

const id = (suffix) => `01900000-0000-7000-8000-000000000${suffix}`;
const ACTIVATED = new Date('2026-10-01T00:00:00.000Z');

function seedState() {
  const instructor = (suffix, fields) => ({
    id: id(suffix),
    organizationId: ORG_A,
    email: `i${suffix}@a.test`,
    fullName: `Instructor ${suffix}`,
    role: 'Instructor',
    department: null,
    status: 'Active',
    activatedAt: ACTIVATED,
    deletedAt: null,
    ...fields,
  });
  return {
    organizations: [
      { id: ORG_A, name: 'Org A', status: 'Active' },
      { id: ORG_B, name: 'Org B', status: 'Active' },
    ],
    subscriptions: [
      { organizationId: ORG_A, status: 'Active', maxInstructors: 8, maxLearners: 10 },
      { organizationId: ORG_B, status: 'Active', maxInstructors: 5, maxLearners: 5 },
    ],
    users: [
      instructor('101', {}), // A: có chuỗi
      instructor('102', {}), // B: người tiếp nhận hợp lệ
      instructor('103', {}), // C: không có chuỗi
      instructor('104', { status: 'Deactivated' }), // đã vô hiệu hóa
      instructor('105', { status: 'Pending', activatedAt: null }), // chưa kích hoạt
      instructor('106', { deletedAt: new Date('2026-10-20T00:00:00.000Z') }), // đã xóa
      instructor('107', { status: 'Deactivated', activatedAt: null }), // Deactivated chưa từng kích hoạt
      { ...instructor('201', {}), role: 'Learner' },
      { ...instructor('301', {}), organizationId: ORG_B }, // Instructor tổ chức khác
      {
        ...instructor('302', { deletedAt: new Date('2026-10-21T00:00:00.000Z') }),
        organizationId: ORG_B,
      }, // đã xóa ở tổ chức khác
    ],
    accountTokens: [
      {
        id: 't105',
        userId: id('105'),
        purpose: 'Invitation',
        consumedAt: null,
        revokedAt: null,
      },
    ],
    outbox: [],
  };
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date) return value?.getTime() === condition.getTime();
    if (typeof condition === 'object') {
      if ('in' in condition && !condition.in.includes(value)) return false;
      if ('not' in condition) {
        if (condition.not === null) return value !== null && value !== undefined;
        if (value === condition.not) return false;
      }
      return true;
    }
    return value === condition;
  });
}

function pick(row, select) {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
}

function sortRows(rows, orderBy) {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((left, right) => {
    for (const order of orders) {
      const [[field, direction]] = Object.entries(order);
      if (left[field] === right[field]) continue;
      const result = left[field] < right[field] ? -1 : 1;
      return direction === 'desc' ? -result : result;
    }
    return 0;
  });
}

function model(db, table) {
  const rows = () => db.state[table];
  return {
    findFirst: async ({ where, select, orderBy } = {}) => {
      const found = sortRows(rows().filter((row) => matches(row, where)), orderBy)[0];
      return found ? pick(found, select) : null;
    },
    findUnique: async ({ where, select } = {}) => {
      const found = rows().find((row) => matches(row, where));
      return found ? pick(found, select) : null;
    },
    findMany: async ({ where, select, orderBy } = {}) =>
      sortRows(rows().filter((row) => matches(row, where)), orderBy).map((row) =>
        pick(row, select),
      ),
    count: async ({ where } = {}) => rows().filter((row) => matches(row, where)).length,
    updateMany: async ({ where, data }) => {
      const hit = rows().filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    },
  };
}

function client(db) {
  return {
    user: model(db, 'users'),
    organization: model(db, 'organizations'),
    subscription: model(db, 'subscriptions'),
    async $queryRaw(strings, ...values) {
      const text = strings.join('?');
      db.rawQueries.push(text.replace(/\s+/g, ' ').trim());
      if (/FROM organizations/.test(text)) {
        const organization = db.state.organizations.find((row) => row.id === values[0]);
        return organization ? [{ name: organization.name, status: organization.status }] : [];
      }
      if (/FROM users/.test(text) && /FOR UPDATE/.test(text)) {
        const [userId, organizationId, role] = values;
        db.locks.push(userId);
        const user = db.state.users.find(
          (row) =>
            row.id === userId &&
            row.organizationId === organizationId &&
            row.role === role &&
            row.deletedAt === null,
        );
        return user
          ? [
              {
                id: user.id,
                full_name: user.fullName,
                email: user.email,
                status: user.status,
                activated_at: user.activatedAt,
              },
            ]
          : [];
      }
      throw new Error(`Fake prisma: unsupported raw query: ${text}`);
    },
  };
}

function createFakeDb() {
  const db = { state: seedState(), rawQueries: [], locks: [], transactions: [] };
  const prisma = client(db);
  prisma.$transaction = async (fn, options) => {
    db.transactions.push(options ?? null);
    const snapshot = structuredClone(db.state);
    try {
      return await fn(client(db));
    } catch (error) {
      db.state = snapshot;
      throw error;
    }
  };
  db.prisma = prisma;
  return db;
}

/** course-service giả: chains = [{ chainId, instructorId, organizationId }]. */
function createCourseClient(db, chains) {
  const course = {
    chains,
    calls: [],
    fail: {},
    afterTransfer: null,
    view(chain) {
      return {
        chainId: chain.chainId,
        courseId: `course-${chain.chainId}`,
        name: `Course ${chain.chainId}`,
        versionNumber: 1,
        status: 'Published',
        courseType: 'Standard',
        approvedAt: null,
      };
    },
    owned(user, instructorId) {
      return course.chains.filter(
        (chain) =>
          chain.instructorId === instructorId && chain.organizationId === user.organizationId,
      );
    },
    async countCourseChainsByInstructors(user, ids) {
      course.calls.push(['count', ...ids]);
      if (course.fail.count) throw new Error('course-service down');
      return Object.fromEntries(ids.map((instructorId) => [instructorId, course.owned(user, instructorId).length]));
    },
    async listCourseChainsByInstructor(user, instructorId) {
      course.calls.push(['list', instructorId]);
      if (course.fail.list) throw new Error('course-service down');
      return course.owned(user, instructorId).map((chain) => course.view(chain));
    },
    async transferCourseChains(user, from, to) {
      course.calls.push(['transfer', from, to]);
      if (course.fail.transfer) throw new Error('course-service down');
      const moved = course.owned(user, from);
      moved.forEach((chain) => {
        chain.instructorId = to;
      });
      if (course.afterTransfer) course.afterTransfer();
      return moved.map((chain) => course.view(chain));
    },
  };
  return course;
}

function createHarness({ chains } = {}) {
  const db = createFakeDb();
  const course = createCourseClient(
    db,
    chains ?? [
      { chainId: 'c1', instructorId: id('101'), organizationId: ORG_A },
      { chainId: 'c2', instructorId: id('101'), organizationId: ORG_A },
    ],
  );
  const outbox = {
    enqueueEmail: async (_tx, params) =>
      db.state.outbox.push({ type: 'EmailRequested', ...structuredClone(params) }),
    enqueueAudit: async (_tx, params) =>
      db.state.outbox.push({ type: 'AuditRecorded', ...structuredClone(params) }),
    // UC13.5: event UserDeactivated / UserReactivated.
    enqueueAccountStatusEvent: async (_tx, params) =>
      db.state.outbox.push({ type: params.eventType, ...structuredClone(params) }),
  };
  const accountTokens = {
    revokeOpen: async (_tx, { userId, purpose }, revokedAt = new Date()) => {
      const open = db.state.accountTokens.filter(
        (token) =>
          token.userId === userId &&
          token.purpose === purpose &&
          token.consumedAt === null &&
          token.revokedAt === null,
      );
      open.forEach((token) => {
        token.revokedAt = revokedAt;
      });
      db.rawQueries.push(`revokeOpen ${userId}`);
      return open.length;
    },
  };
  const service = new UsersService(
    db.prisma,
    course,
    { get: () => undefined },
    {},
    outbox,
    {},
    {},
    {}, // storage (UC12.1)
    accountTokens,
  );
  return { db, course, service, user: ORGANIZER };
}

/** Kết quả hoặc lỗi HTTP dạng so sánh được. Nhận hàm để bắt cả lỗi ném đồng bộ. */
async function outcome(call) {
  try {
    return { ok: await call() };
  } catch (error) {
    if (typeof error.getStatus !== 'function') throw error;
    return { status: error.getStatus(), error: error.getResponse() };
  }
}

function userRow(db, suffix) {
  return db.state.users.find((row) => row.id === id(suffix));
}

module.exports = { ORG_A, ORG_B, ORGANIZER, id, createHarness, outcome, userRow };
