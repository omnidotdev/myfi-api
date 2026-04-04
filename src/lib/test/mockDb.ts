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
  mockInsertValues.mockClear();
  mockUpdateWhere.mockClear();
  mockUpdateSet.mockClear();
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
const buildResult = (data: unknown[]) => {
  const arr = [...data];

  return Object.assign(arr, {
    where: mock(() => {
      const result = [...data];
      return Object.assign(result, {
        orderBy: mock(() => [...data]),
      });
    }),
    orderBy: mock(() => [...data]),
  });
};

export const mockInsertValues = mock(() => ({}));
export const mockUpdateWhere = mock(() => ({}));
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));

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
};
