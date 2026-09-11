import { mock } from "bun:test";

/**
 * Configurable mock for lib/db/db that supports all Drizzle query patterns:
 *   select().from().where().orderBy()
 *   select({...}).from().where()
 *   insert().values()
 *   update().set().where()
 *
 * Call setSelectResults() to queue results consumed in order by successive
 * select() calls. Each result is an array returned at the deepest chain level
 */
let selectQueue: unknown[][] = [];
let selectIndex = 0;

export const resetDbMock = () => {
  selectIndex = 0;
  selectQueue = [];
  insertReturningData = [];
  updateReturningData = [];
  // Clear calls AND restore the default implementation, so a persistent
  // mockImplementation set by one test file does not leak into another
  mockInsertValues.mockClear();
  mockInsertValues.mockImplementation(defaultInsertValuesImpl);
  mockInsertOnConflict.mockClear();
  mockUpdateWhere.mockClear();
  mockUpdateSet.mockClear();
  mockDeleteWhere.mockClear();
  mockDbPool.select.mockClear();
  mockDbPool.insert.mockClear();
  mockDbPool.update.mockClear();
  mockDbPool.delete.mockClear();
};

export const setSelectResults = (results: unknown[][]) => {
  selectQueue = results;
  selectIndex = 0;
};

const getNextResult = (): unknown[] => {
  const data = selectQueue[selectIndex] ?? [];
  selectIndex++;
  return data;
};

// Build a result array that also has chainable Drizzle methods
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildResult = (data: unknown[]): any => {
  const arr = [...data];

  return Object.assign(arr, {
    where: mock(() => {
      const result = [...data];
      return Object.assign(result, {
        orderBy: mock(() => [...data]),
        groupBy: mock(() => [...data]),
        limit: mock(() => [...data]),
      });
    }),
    orderBy: mock(() => [...data]),
    groupBy: mock(() => [...data]),
    limit: mock(() => [...data]),
    innerJoin: mock(() => buildResult(data)),
    leftJoin: mock(() => buildResult(data)),
  });
};

let insertReturningData: unknown[] = [];
export const setInsertReturningData = (data: unknown[]) => {
  insertReturningData = data;
};
// Captures the config passed to .values().onConflictDoUpdate(config), so tests
// can assert the upsert target and set clause
export const mockInsertOnConflict = mock((_config?: unknown) =>
  Promise.resolve(insertReturningData),
);
// Default shape of insert().values(): resolves for a bare await, and supports
// both .returning() and .onConflictDoUpdate() chains
const defaultInsertValuesImpl = () => ({
  returning: mock(() => insertReturningData),
  onConflictDoUpdate: mockInsertOnConflict,
});
export const mockInsertValues = mock(defaultInsertValuesImpl);
let updateReturningData: unknown[] = [];
export const setUpdateReturningData = (data: unknown[]) => {
  updateReturningData = data;
};
export const mockUpdateWhere = mock(() => ({
  returning: mock(() => updateReturningData),
}));
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));

export const mockDeleteWhere = mock(() => ({}));

export const mockDbPool = {
  select: mock((..._args: unknown[]) => ({
    from: mock(() => buildResult(getNextResult())),
  })),
  insert: mock(() => ({
    values: mockInsertValues,
  })),
  update: mock(() => ({
    set: mockUpdateSet,
  })),
  delete: mock(() => ({
    where: mockDeleteWhere,
  })),
};
