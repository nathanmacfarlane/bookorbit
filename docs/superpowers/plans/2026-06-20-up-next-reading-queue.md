# Up Next Reading Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single per-user, manually-ordered "Up Next" reading queue of library books, with a dedicated drag-and-drop page (grid ⇄ list views) and a read-only dashboard widget.

**Architecture:** A new NestJS `reading-queue` module (controller/service/repository) backed by a `reading_queue_items` table; shared DTO/response types in `@bookorbit/types`; a Vue feature `reading-queue` (page + composable + api) reusing the existing `useDraggableList` composable and `BookReadService.findCardsByBookIds` for hydration; a new `up-next` dashboard widget; and three add-to-queue entry points. The grid/list toggle persists via a new `reading-queue` category in the existing `user-preferences` module.

**Tech Stack:** NestJS, Drizzle ORM (Postgres), Vitest, Vue 3 + `<script setup>`, Pinia-free composables, the project's `api()` fetch helper, class-validator DTOs.

---

## Environment note

This repo now requires a modern Node for tooling/hooks. Use Node 22+ for all commands:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
```

Run this once per shell before the commands below (the pre-commit/pre-push hooks fail on Node 18).

## Conventions (read once)

- Server tests: `cd server && pnpm exec vitest run <path>`
- Client tests: `cd client && pnpm exec vitest run <path>`
- Typecheck everything: `pnpm run typecheck`
- Backend reads the DB via `@Inject(DB)` and `drizzle-orm` query builders (see `server/src/modules/collection/collection.repository.ts`).
- Controllers get the user via `@CurrentUser()` returning `RequestUser` (`{ id: number; isSuperuser: boolean; ... }`).
- The client calls the API with `api('/api/v1/...')` from `@/lib/api` which returns a `Response`.

## File structure

**Created (server):**

- `server/src/db/schema/reading-queue.ts` — `reading_queue_items` table + inferred types.
- `server/src/modules/reading-queue/reading-queue.repository.ts` — all DB access for the queue.
- `server/src/modules/reading-queue/reading-queue.service.ts` — business rules (add/remove/reorder/hydrate).
- `server/src/modules/reading-queue/reading-queue.controller.ts` — REST endpoints.
- `server/src/modules/reading-queue/reading-queue.module.ts` — module wiring.
- `server/src/modules/reading-queue/dto/add-queue-item.dto.ts`
- `server/src/modules/reading-queue/dto/reorder-queue.dto.ts`
- `server/src/modules/reading-queue/*.test.ts` — repository/service/controller tests.

**Created (types):**

- `packages/types/src/reading-queue.ts` — `ReadingQueueItem`, request/response shapes, `ReadingQueueView`.

**Created (client):**

- `client/src/features/reading-queue/api/reading-queue.api.ts`
- `client/src/features/reading-queue/composables/useReadingQueue.ts` (+ test)
- `client/src/features/reading-queue/composables/useReadingQueueView.ts` (+ test)
- `client/src/features/reading-queue/components/UpNextGrid.vue`
- `client/src/features/reading-queue/components/UpNextList.vue`
- `client/src/features/reading-queue/components/AddToQueueButton.vue`
- `client/src/views/UpNextView.vue`
- `client/src/features/dashboard/components/widgets/UpNextWidget.vue`
- `client/src/features/dashboard/composables/useUpNextWidget.ts`

**Modified (server):**

- `server/src/db/schema/index.ts` — export the new schema.
- `server/src/app.module.ts` — register `ReadingQueueModule`.
- `server/src/modules/user-preferences/user-preferences.controller.ts` / `.service.ts` — add `reading-queue` view preference endpoints.
- `server/src/modules/dashboard/dashboard.controller.ts` + its service — add `GET /dashboard/widgets/up-next`.
- Architecture allowlist (if the boundary test requires it).

**Modified (types):**

- `packages/types/src/index.ts` — export `./reading-queue`.
- `packages/types/src/dashboard.ts` — add `up-next` to `WIDGET_TYPE` and an `UpNextWidgetData` type.

**Modified (client):**

- `client/src/router/index.ts` — add `/up-next` route.
- `client/src/components/AppSidebar.vue` — add nav link.
- `client/src/features/dashboard/composables/useDashboardWidgets.ts` — label + default entry for `up-next`.
- `client/src/features/dashboard/api/dashboard-widget.api.ts` — `fetchUpNext()`.
- `client/src/features/dashboard/components/DashboardWidgetRow.vue` (or wherever widgets switch on type) — render `UpNextWidget`.
- Book detail view + book-dock toolbar — mount `AddToQueueButton` / bulk action.

---

## Task 1: Database schema for `reading_queue_items`

**Files:**

- Create: `server/src/db/schema/reading-queue.ts`
- Modify: `server/src/db/schema/index.ts`
- Migration: generated into `server/src/db/migrations/`

- [ ] **Step 1: Write the schema file**

Create `server/src/db/schema/reading-queue.ts`:

```ts
import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { books } from "./books";
import { users } from "./auth";

export const readingQueueItems = pgTable(
  "reading_queue_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("reading_queue_items_user_book_uidx").on(t.userId, t.bookId),
    index("reading_queue_items_user_position_idx").on(t.userId, t.position),
  ],
);

export type ReadingQueueItemRow = typeof readingQueueItems.$inferSelect;
export type NewReadingQueueItemRow = typeof readingQueueItems.$inferInsert;
```

- [ ] **Step 2: Export the schema**

In `server/src/db/schema/index.ts`, add at the end (after the existing exports):

```ts
export * from "./reading-queue";
```

- [ ] **Step 3: Generate the migration**

Run: `cd server && pnpm db:generate add_reading_queue_items`
Expected: a new `server/src/db/migrations/00XX_add_reading_queue_items.sql` is created containing `CREATE TABLE "reading_queue_items"` plus the two indexes, and `meta/_journal.json` is updated.

- [ ] **Step 4: Verify it typechecks**

Run: `pnpm run typecheck`
Expected: PASS (no TS errors).

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema/reading-queue.ts server/src/db/schema/index.ts server/src/db/migrations
git commit -m "feat(reading-queue): add reading_queue_items schema and migration"
```

---

## Task 2: Shared types

**Files:**

- Create: `packages/types/src/reading-queue.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write the types**

Create `packages/types/src/reading-queue.ts`. `BookCard` is the existing card shape returned by `findCardsByBookIds`; import it from the books types module.

```ts
import type { BookCard } from "./book";

export const READING_QUEUE_VIEWS = ["grid", "list"] as const;
export type ReadingQueueView = (typeof READING_QUEUE_VIEWS)[number];

/** One queue entry: position plus the hydrated book card for rendering. */
export type ReadingQueueItem = {
  position: number;
  book: BookCard;
};

export type ReadingQueueResponse = {
  items: ReadingQueueItem[];
};

export type AddReadingQueueItemRequest = {
  bookId: number;
};

export type ReorderReadingQueueRequest = {
  /** Full ordered list of the user's queued book ids, in the desired order. */
  bookIds: number[];
};

export type ReadingQueueViewPreference = {
  view: ReadingQueueView;
};
```

If `BookCard` is not the exact exported name, run `grep -rn "export type BookCard\|export interface BookCard" packages/types/src` and use the actual card type the `findCardsByBookIds` query returns; adjust the import accordingly.

- [ ] **Step 2: Export from the package index**

In `packages/types/src/index.ts`, add alongside the other exports:

```ts
export * from "./reading-queue";
```

- [ ] **Step 3: Build types + typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/reading-queue.ts packages/types/src/index.ts
git commit -m "feat(reading-queue): add shared reading queue types"
```

---

## Task 3: Repository (TDD)

**Files:**

- Create: `server/src/modules/reading-queue/reading-queue.repository.ts`
- Test: `server/src/modules/reading-queue/reading-queue.repository.test.ts`

The repository owns all DB access. Mirror the DB-mock style used in `server/src/modules/collection/collection.repository.test.ts` (a fake `db` object whose builder methods return canned rows).

- [ ] **Step 1: Write failing tests**

Create `server/src/modules/reading-queue/reading-queue.repository.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ReadingQueueRepository } from "./reading-queue.repository";

function makeDb() {
  // Chainable query-builder stub. Each method returns `this`; terminal
  // calls are awaited, so the object is thenable via the methods we override per test.
  const db: any = {};
  db.select = vi.fn(() => db);
  db.from = vi.fn(() => db);
  db.where = vi.fn(() => db);
  db.orderBy = vi.fn(() => db);
  db.insert = vi.fn(() => db);
  db.values = vi.fn(() => db);
  db.onConflictDoNothing = vi.fn(() => db);
  db.returning = vi.fn(() => Promise.resolve([]));
  db.delete = vi.fn(() => db);
  db.transaction = vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(db));
  db.execute = vi.fn(() => Promise.resolve());
  return db;
}

describe("ReadingQueueRepository", () => {
  let db: ReturnType<typeof makeDb>;
  let repo: ReadingQueueRepository;

  beforeEach(() => {
    db = makeDb();
    repo = new ReadingQueueRepository(db as never);
  });

  it("findOrderedBookIds selects book ids for the user ordered by position", async () => {
    db.orderBy = vi.fn(() => Promise.resolve([{ bookId: 7 }, { bookId: 3 }]));
    const ids = await repo.findOrderedBookIds(42);
    expect(ids).toEqual([7, 3]);
    expect(db.select).toHaveBeenCalled();
  });

  it("getMaxPosition returns 0 when the queue is empty", async () => {
    db.where = vi.fn(() => Promise.resolve([{ max: null }]));
    const max = await repo.getMaxPosition(42);
    expect(max).toBe(0);
  });

  it("getMaxPosition returns the current max position", async () => {
    db.where = vi.fn(() => Promise.resolve([{ max: 5 }]));
    const max = await repo.getMaxPosition(42);
    expect(max).toBe(5);
  });

  it("insertAtEnd inserts with the given position and ignores duplicates", async () => {
    await repo.insertAtEnd(42, 7, 6);
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith({
      userId: 42,
      bookId: 7,
      position: 6,
    });
    expect(db.onConflictDoNothing).toHaveBeenCalled();
  });

  it("remove deletes the row for the user+book", async () => {
    db.where = vi.fn(() => Promise.resolve(undefined));
    await repo.remove(42, 7);
    expect(db.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.repository.test.ts`
Expected: FAIL with "Cannot find module './reading-queue.repository'".

- [ ] **Step 3: Implement the repository**

Create `server/src/modules/reading-queue/reading-queue.repository.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, asc, eq, max, sql } from "drizzle-orm";

import { DB } from "../../db";
import * as schema from "../../db/schema";
import { readingQueueItems } from "../../db/schema";

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ReadingQueueRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findOrderedBookIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ bookId: readingQueueItems.bookId })
      .from(readingQueueItems)
      .where(eq(readingQueueItems.userId, userId))
      .orderBy(asc(readingQueueItems.position));
    return rows.map((r) => r.bookId);
  }

  async getMaxPosition(userId: number): Promise<number> {
    const rows = await this.db
      .select({ max: max(readingQueueItems.position) })
      .from(readingQueueItems)
      .where(eq(readingQueueItems.userId, userId));
    return rows[0]?.max ?? 0;
  }

  async insertAtEnd(
    userId: number,
    bookId: number,
    position: number,
  ): Promise<void> {
    await this.db
      .insert(readingQueueItems)
      .values({ userId, bookId, position })
      .onConflictDoNothing({
        target: [readingQueueItems.userId, readingQueueItems.bookId],
      });
  }

  async remove(userId: number, bookId: number): Promise<void> {
    await this.db
      .delete(readingQueueItems)
      .where(
        and(
          eq(readingQueueItems.userId, userId),
          eq(readingQueueItems.bookId, bookId),
        ),
      );
  }

  /** Rewrite positions for the given ordered ids in a single transaction. */
  async reorder(userId: number, orderedBookIds: number[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedBookIds.length; i++) {
        await tx
          .update(readingQueueItems)
          .set({ position: i + 1 })
          .where(
            and(
              eq(readingQueueItems.userId, userId),
              eq(readingQueueItems.bookId, orderedBookIds[i]!),
            ),
          );
      }
    });
  }

  /** Compact positions to be contiguous 1..n after a removal. */
  async compactPositions(userId: number): Promise<void> {
    await this.db.execute(sql`
      with ordered as (
        select id, row_number() over (order by position) as rn
        from reading_queue_items
        where user_id = ${userId}
      )
      update reading_queue_items q
      set position = ordered.rn
      from ordered
      where q.id = ordered.id
    `);
  }
}
```

Note: add `update` and `set` to the test `makeDb()` stub so the `reorder` path is callable in later service tests — add these lines inside `makeDb()`: `db.update = vi.fn(() => db); db.set = vi.fn(() => db);`. Update the test file now and keep it green.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.repository.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/reading-queue/reading-queue.repository.ts server/src/modules/reading-queue/reading-queue.repository.test.ts
git commit -m "feat(reading-queue): add repository with add/remove/reorder/compact"
```

---

## Task 4: DTOs

**Files:**

- Create: `server/src/modules/reading-queue/dto/add-queue-item.dto.ts`
- Create: `server/src/modules/reading-queue/dto/reorder-queue.dto.ts`

- [ ] **Step 1: Write the add DTO**

Create `server/src/modules/reading-queue/dto/add-queue-item.dto.ts`:

```ts
import { IsInt, Min } from "class-validator";

export class AddQueueItemDto {
  @IsInt()
  @Min(1)
  bookId: number;
}
```

- [ ] **Step 2: Write the reorder DTO**

Create `server/src/modules/reading-queue/dto/reorder-queue.dto.ts`:

```ts
import { ArrayMinSize, IsArray, IsInt, Min } from "class-validator";

export class ReorderQueueDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  bookIds: number[];
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/modules/reading-queue/dto
git commit -m "feat(reading-queue): add request DTOs"
```

---

## Task 5: Service (TDD)

**Files:**

- Create: `server/src/modules/reading-queue/reading-queue.service.ts`
- Test: `server/src/modules/reading-queue/reading-queue.service.test.ts`

The service depends on `ReadingQueueRepository` and `BookReadService` (for `findCardsByBookIds`) and `LibraryService` (to verify the user can access a book's library before adding — mirror how `CollectionService` validates access).

- [ ] **Step 1: Write failing tests**

Create `server/src/modules/reading-queue/reading-queue.service.test.ts`:

```ts
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadingQueueService } from "./reading-queue.service";

const user = { id: 42, isSuperuser: false } as never;

function makeDeps() {
  const repo = {
    findOrderedBookIds: vi.fn(),
    getMaxPosition: vi.fn(),
    insertAtEnd: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    compactPositions: vi.fn(),
  };
  const bookRead = {
    findCardsByBookIds: vi.fn(),
    findLibraryIdByBookId: vi.fn(),
  };
  const library = {
    getAccessibleLibraryIds: vi.fn(),
  };
  return { repo, bookRead, library };
}

describe("ReadingQueueService", () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: ReadingQueueService;

  beforeEach(() => {
    deps = makeDeps();
    service = new ReadingQueueService(
      deps.repo as never,
      deps.bookRead as never,
      deps.library as never,
    );
  });

  it("getQueue returns items ordered by queue position, hydrated with cards", async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([7, 3]);
    // findCardsByBookIds may return cards in any order; service must re-sort to queue order.
    deps.bookRead.findCardsByBookIds.mockResolvedValue([
      { id: 3, title: "B" },
      { id: 7, title: "A" },
    ]);

    const result = await service.getQueue(user);

    expect(result.items.map((i) => i.book.id)).toEqual([7, 3]);
    expect(result.items.map((i) => i.position)).toEqual([1, 2]);
  });

  it("getQueue returns empty items when queue is empty", async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([]);
    const result = await service.getQueue(user);
    expect(result.items).toEqual([]);
    expect(deps.bookRead.findCardsByBookIds).not.toHaveBeenCalled();
  });

  it("addBook rejects a book the user cannot access", async () => {
    deps.bookRead.findLibraryIdByBookId.mockResolvedValue(99);
    deps.library.getAccessibleLibraryIds.mockResolvedValue([1, 2]);
    await expect(service.addBook(user, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(deps.repo.insertAtEnd).not.toHaveBeenCalled();
  });

  it("addBook appends at max+1 for an accessible book", async () => {
    deps.bookRead.findLibraryIdByBookId.mockResolvedValue(1);
    deps.library.getAccessibleLibraryIds.mockResolvedValue([1, 2]);
    deps.repo.getMaxPosition.mockResolvedValue(4);
    deps.repo.findOrderedBookIds.mockResolvedValue([1, 2, 7]);
    deps.bookRead.findCardsByBookIds.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 7 },
    ]);

    await service.addBook(user, 7);

    expect(deps.repo.insertAtEnd).toHaveBeenCalledWith(42, 7, 5);
  });

  it("removeBook deletes then compacts positions", async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([]);
    await service.removeBook(user, 7);
    expect(deps.repo.remove).toHaveBeenCalledWith(42, 7);
    expect(deps.repo.compactPositions).toHaveBeenCalledWith(42);
  });

  it("reorder rejects when the id set does not match current membership", async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([1, 2, 3]);
    await expect(service.reorder(user, [1, 2])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(deps.repo.reorder).not.toHaveBeenCalled();
  });

  it("reorder persists the new order when membership matches", async () => {
    deps.repo.findOrderedBookIds
      .mockResolvedValueOnce([1, 2, 3]) // membership check
      .mockResolvedValueOnce([3, 1, 2]); // post-reorder fetch for response
    deps.bookRead.findCardsByBookIds.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    await service.reorder(user, [3, 1, 2]);

    expect(deps.repo.reorder).toHaveBeenCalledWith(42, [3, 1, 2]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.service.test.ts`
Expected: FAIL with "Cannot find module './reading-queue.service'".

- [ ] **Step 3: Implement the service**

Create `server/src/modules/reading-queue/reading-queue.service.ts`. Confirm the exact `LibraryService` method that returns the user's accessible library ids (run `grep -nE 'getAccessible|accessibleLibrary|AccessibleLibraryIds' server/src/modules/library/library.service.ts`); use that name in place of `getAccessibleLibraryIds` if it differs.

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ReadingQueueResponse } from "@bookorbit/types";
import type { RequestUser } from "../../common/types/request-user";
import { BookReadService } from "../book/book-read.service";
import { LibraryService } from "../library/library.service";
import { ReadingQueueRepository } from "./reading-queue.repository";

const BOOK_NOT_FOUND = "Book not found or not accessible";
const QUEUE_MISMATCH = "Provided book ids do not match the current queue";

@Injectable()
export class ReadingQueueService {
  constructor(
    private readonly repo: ReadingQueueRepository,
    private readonly bookRead: BookReadService,
    private readonly library: LibraryService,
  ) {}

  async getQueue(user: RequestUser): Promise<ReadingQueueResponse> {
    const orderedIds = await this.repo.findOrderedBookIds(user.id);
    return this.hydrate(user, orderedIds);
  }

  async addBook(
    user: RequestUser,
    bookId: number,
  ): Promise<ReadingQueueResponse> {
    await this.assertBookAccessible(user, bookId);
    const max = await this.repo.getMaxPosition(user.id);
    await this.repo.insertAtEnd(user.id, bookId, max + 1);
    return this.getQueue(user);
  }

  async removeBook(
    user: RequestUser,
    bookId: number,
  ): Promise<ReadingQueueResponse> {
    await this.repo.remove(user.id, bookId);
    await this.repo.compactPositions(user.id);
    return this.getQueue(user);
  }

  async reorder(
    user: RequestUser,
    bookIds: number[],
  ): Promise<ReadingQueueResponse> {
    const current = await this.repo.findOrderedBookIds(user.id);
    if (!sameSet(current, bookIds)) {
      throw new BadRequestException(QUEUE_MISMATCH);
    }
    await this.repo.reorder(user.id, bookIds);
    return this.getQueue(user);
  }

  private async assertBookAccessible(
    user: RequestUser,
    bookId: number,
  ): Promise<void> {
    const libraryId = await this.bookRead.findLibraryIdByBookId(bookId);
    if (libraryId == null) throw new NotFoundException(BOOK_NOT_FOUND);
    if (user.isSuperuser) return;
    const accessible = await this.library.getAccessibleLibraryIds(user.id);
    if (!accessible.includes(libraryId))
      throw new NotFoundException(BOOK_NOT_FOUND);
  }

  private async hydrate(
    user: RequestUser,
    orderedIds: number[],
  ): Promise<ReadingQueueResponse> {
    if (orderedIds.length === 0) return { items: [] };
    const cards = await this.bookRead.findCardsByBookIds(orderedIds, user.id);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const items = orderedIds
      .map((id, index) => {
        const book = byId.get(id);
        return book ? { position: index + 1, book } : null;
      })
      .filter(
        (x): x is { position: number; book: (typeof cards)[number] } =>
          x !== null,
      );
    return { items };
  }
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}
```

If `findLibraryIdByBookId` returns a row object rather than a number, adapt `assertBookAccessible` to read the id field; check its signature in `book-read.service.ts` (Task research showed it exists).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.service.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/reading-queue/reading-queue.service.ts server/src/modules/reading-queue/reading-queue.service.test.ts
git commit -m "feat(reading-queue): add service with access checks and reorder guard"
```

---

## Task 6: Controller + module wiring (TDD)

**Files:**

- Create: `server/src/modules/reading-queue/reading-queue.controller.ts`
- Create: `server/src/modules/reading-queue/reading-queue.module.ts`
- Test: `server/src/modules/reading-queue/reading-queue.controller.test.ts`
- Modify: `server/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Create `server/src/modules/reading-queue/reading-queue.controller.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadingQueueController } from "./reading-queue.controller";

const user = { id: 42, isSuperuser: false } as never;

describe("ReadingQueueController", () => {
  let service: { getQueue: any; addBook: any; removeBook: any; reorder: any };
  let controller: ReadingQueueController;

  beforeEach(() => {
    service = {
      getQueue: vi.fn().mockResolvedValue({ items: [] }),
      addBook: vi.fn().mockResolvedValue({ items: [] }),
      removeBook: vi.fn().mockResolvedValue({ items: [] }),
      reorder: vi.fn().mockResolvedValue({ items: [] }),
    };
    controller = new ReadingQueueController(service as never);
  });

  it("GET delegates to service.getQueue", async () => {
    await controller.findAll(user);
    expect(service.getQueue).toHaveBeenCalledWith(user);
  });

  it("POST delegates the bookId to service.addBook", async () => {
    await controller.add({ bookId: 7 }, user);
    expect(service.addBook).toHaveBeenCalledWith(user, 7);
  });

  it("DELETE delegates the bookId param to service.removeBook", async () => {
    await controller.remove(7, user);
    expect(service.removeBook).toHaveBeenCalledWith(user, 7);
  });

  it("PUT reorder delegates ordered ids to service.reorder", async () => {
    await controller.reorder({ bookIds: [3, 1, 2] }, user);
    expect(service.reorder).toHaveBeenCalledWith(user, [3, 1, 2]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.controller.test.ts`
Expected: FAIL with "Cannot find module './reading-queue.controller'".

- [ ] **Step 3: Implement the controller**

Create `server/src/modules/reading-queue/reading-queue.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user";
import { AddQueueItemDto } from "./dto/add-queue-item.dto";
import { ReorderQueueDto } from "./dto/reorder-queue.dto";
import { ReadingQueueService } from "./reading-queue.service";

@Controller("reading-queue")
export class ReadingQueueController {
  constructor(private readonly service: ReadingQueueService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.service.getQueue(user);
  }

  @Post()
  add(@Body() dto: AddQueueItemDto, @CurrentUser() user: RequestUser) {
    return this.service.addBook(user, dto.bookId);
  }

  @Put("reorder")
  reorder(@Body() dto: ReorderQueueDto, @CurrentUser() user: RequestUser) {
    return this.service.reorder(user, dto.bookIds);
  }

  @Delete(":bookId")
  remove(
    @Param("bookId", ParseIntPipe) bookId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeBook(user, bookId);
  }
}
```

- [ ] **Step 4: Implement the module**

Create `server/src/modules/reading-queue/reading-queue.module.ts`. `BookModule` exports `BookReadService` and `LibraryModule` exports `LibraryService` (confirm via `grep -n "exports" server/src/modules/book/book.module.ts server/src/modules/library/library.module.ts`).

```ts
import { Module } from "@nestjs/common";

import { BookModule } from "../book/book.module";
import { LibraryModule } from "../library/library.module";
import { ReadingQueueController } from "./reading-queue.controller";
import { ReadingQueueRepository } from "./reading-queue.repository";
import { ReadingQueueService } from "./reading-queue.service";

@Module({
  imports: [BookModule, LibraryModule],
  controllers: [ReadingQueueController],
  providers: [ReadingQueueService, ReadingQueueRepository],
  exports: [ReadingQueueService],
})
export class ReadingQueueModule {}
```

- [ ] **Step 5: Register in app.module**

In `server/src/app.module.ts`, add the import near the other module imports and add `ReadingQueueModule` to the `imports` array (next to `CollectionModule`):

```ts
import { ReadingQueueModule } from "./modules/reading-queue/reading-queue.module";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue/reading-queue.controller.test.ts`
Expected: PASS (4 tests).
Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 7: Update the architecture boundary allowlist if needed**

Run: `cd server && pnpm exec vitest run src/modules/architecture/architecture-boundaries.test.ts`
If it fails because `ReadingQueueRepository` injects `DB`, add it to the allowlist exactly as that test instructs (repositories are typically already allowed — only act if it actually fails). Re-run until green.

- [ ] **Step 8: Commit**

```bash
git add server/src/modules/reading-queue/reading-queue.controller.ts server/src/modules/reading-queue/reading-queue.controller.test.ts server/src/modules/reading-queue/reading-queue.module.ts server/src/app.module.ts
git commit -m "feat(reading-queue): add controller, module, and app wiring"
```

---

## Task 7: View-toggle preference endpoints (TDD)

Mirror the existing `whats-new` preference flow in `user-preferences`.

**Files:**

- Modify: `server/src/modules/user-preferences/user-preferences.service.ts`
- Modify: `server/src/modules/user-preferences/user-preferences.controller.ts`
- Modify: `server/src/modules/user-preferences/user-preferences.service.test.ts`

- [ ] **Step 1: Write a failing service test**

In `server/src/modules/user-preferences/user-preferences.service.test.ts`, add:

```ts
describe("reading-queue view preference", () => {
  it("returns the default grid view when nothing stored", async () => {
    repo.findByCategory = vi.fn().mockResolvedValue(null);
    const result = await service.getReadingQueuePreferences(42);
    expect(result).toEqual({ view: "grid" });
  });

  it("returns the stored view", async () => {
    repo.findByCategory = vi.fn().mockResolvedValue({ data: { view: "list" } });
    const result = await service.getReadingQueuePreferences(42);
    expect(result).toEqual({ view: "list" });
  });

  it("rejects an invalid view on upsert", async () => {
    await expect(
      service.upsertReadingQueuePreferences(42, { view: "cards" }),
    ).rejects.toBeTruthy();
  });
});
```

Match the existing repo mock variable name in that test file (it may be `repo` or similar); align with whatever the `whats-new` tests already use.

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && pnpm exec vitest run src/modules/user-preferences/user-preferences.service.test.ts`
Expected: FAIL ("getReadingQueuePreferences is not a function").

- [ ] **Step 3: Implement the service methods**

In `server/src/modules/user-preferences/user-preferences.service.ts`, add near the `whats-new` implementation (reuse the same `z` import and repository method names used by `getWhatsNewPreferences`/`upsertWhatsNewPreferences`):

```ts
const READING_QUEUE_CATEGORY = 'reading-queue';
const READING_QUEUE_DEFAULTS = { view: 'grid' as const };
const READING_QUEUE_SCHEMA = z.object({ view: z.enum(['grid', 'list']) }).strict();

// ...inside the class:
async getReadingQueuePreferences(userId: number): Promise<{ view: 'grid' | 'list' }> {
  const row = await this.repo.findByCategory(userId, READING_QUEUE_CATEGORY);
  if (!row) return { ...READING_QUEUE_DEFAULTS };
  const parsed = READING_QUEUE_SCHEMA.safeParse(row.data);
  return parsed.success ? parsed.data : { ...READING_QUEUE_DEFAULTS };
}

async upsertReadingQueuePreferences(userId: number, data: Record<string, unknown>): Promise<void> {
  const parsed = READING_QUEUE_SCHEMA.safeParse(data);
  if (!parsed.success) throw new BadRequestException('Invalid reading queue preferences');
  await this.repo.upsertByCategory(userId, READING_QUEUE_CATEGORY, parsed.data);
}
```

Use the **actual** repository method names from the file (the `whats-new` methods call specific repo methods — copy those exact names; `findByCategory`/`upsertByCategory` are placeholders for whatever the service already uses).

- [ ] **Step 4: Add controller endpoints**

In `server/src/modules/user-preferences/user-preferences.controller.ts`, add (mirroring the `whats-new` pair):

```ts
@Get('reading-queue')
async getReadingQueuePreferences(@CurrentUser() user: RequestUser) {
  const settings = await this.userPreferencesService.getReadingQueuePreferences(user.id);
  return { settings };
}

@Put('reading-queue')
@HttpCode(204)
async upsertReadingQueuePreferences(@Body() dto: UpsertUserPreferenceDto, @CurrentUser() user: RequestUser) {
  await this.userPreferencesService.upsertReadingQueuePreferences(user.id, dto.settings);
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd server && pnpm exec vitest run src/modules/user-preferences/user-preferences.service.test.ts`
Expected: PASS.
Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/user-preferences
git commit -m "feat(reading-queue): persist grid/list view preference"
```

---

## Task 8: Client API module

**Files:**

- Create: `client/src/features/reading-queue/api/reading-queue.api.ts`

- [ ] **Step 1: Write the api module**

Create `client/src/features/reading-queue/api/reading-queue.api.ts`:

```ts
import type { ReadingQueueResponse, ReadingQueueView } from "@bookorbit/types";
import { api } from "@/lib/api";

export async function fetchReadingQueue(): Promise<ReadingQueueResponse> {
  const res = await api("/api/v1/reading-queue");
  if (!res.ok) throw new Error("Failed to fetch reading queue");
  return res.json();
}

export async function addToReadingQueue(
  bookId: number,
): Promise<ReadingQueueResponse> {
  const res = await api("/api/v1/reading-queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId }),
  });
  if (!res.ok) throw new Error("Failed to add to reading queue");
  return res.json();
}

export async function removeFromReadingQueue(
  bookId: number,
): Promise<ReadingQueueResponse> {
  const res = await api(`/api/v1/reading-queue/${bookId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove from reading queue");
  return res.json();
}

export async function reorderReadingQueue(
  bookIds: number[],
): Promise<ReadingQueueResponse> {
  const res = await api("/api/v1/reading-queue/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder reading queue");
  return res.json();
}

export async function fetchReadingQueueView(): Promise<ReadingQueueView> {
  const res = await api("/api/v1/user-preferences/reading-queue");
  if (!res.ok) throw new Error("Failed to fetch reading queue view");
  const data: { settings: { view: ReadingQueueView } } = await res.json();
  return data.settings.view;
}

export async function saveReadingQueueView(
  view: ReadingQueueView,
): Promise<void> {
  const res = await api("/api/v1/user-preferences/reading-queue", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: { view } }),
  });
  if (!res.ok) throw new Error("Failed to save reading queue view");
}
```

Confirm the API base path: other api modules call `/api/v1/...` (see `dashboard-widget.api.ts`). If the project uses a different prefix constant, follow it.

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/reading-queue/api/reading-queue.api.ts
git commit -m "feat(reading-queue): add client api module"
```

---

## Task 9: `useReadingQueue` composable (TDD)

**Files:**

- Create: `client/src/features/reading-queue/composables/useReadingQueue.ts`
- Test: `client/src/features/reading-queue/composables/__tests__/useReadingQueue.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/features/reading-queue/composables/__tests__/useReadingQueue.spec.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../api/reading-queue.api", () => ({
  fetchReadingQueue: vi.fn(),
  addToReadingQueue: vi.fn(),
  removeFromReadingQueue: vi.fn(),
  reorderReadingQueue: vi.fn(),
}));

import * as apiMod from "../../api/reading-queue.api";
import { useReadingQueue } from "../useReadingQueue";

const item = (id: number, position: number) => ({
  position,
  book: { id, title: `B${id}` } as never,
});

describe("useReadingQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("load populates items", async () => {
    (apiMod.fetchReadingQueue as any).mockResolvedValue({
      items: [item(7, 1), item(3, 2)],
    });
    const q = useReadingQueue();
    await q.load();
    expect(q.items.value.map((i) => i.book.id)).toEqual([7, 3]);
  });

  it("applyReorder updates optimistically then persists ordered ids", async () => {
    (apiMod.fetchReadingQueue as any).mockResolvedValue({
      items: [item(1, 1), item(2, 2), item(3, 3)],
    });
    (apiMod.reorderReadingQueue as any).mockResolvedValue({
      items: [item(3, 1), item(1, 2), item(2, 3)],
    });
    const q = useReadingQueue();
    await q.load();

    await q.applyReorder([item(3, 1), item(1, 2), item(2, 3)] as never);

    expect(apiMod.reorderReadingQueue).toHaveBeenCalledWith([3, 1, 2]);
    expect(q.items.value.map((i) => i.book.id)).toEqual([3, 1, 2]);
  });

  it("applyReorder reverts on error", async () => {
    (apiMod.fetchReadingQueue as any).mockResolvedValue({
      items: [item(1, 1), item(2, 2)],
    });
    (apiMod.reorderReadingQueue as any).mockRejectedValue(new Error("nope"));
    const q = useReadingQueue();
    await q.load();

    await q.applyReorder([item(2, 1), item(1, 2)] as never);

    expect(q.items.value.map((i) => i.book.id)).toEqual([1, 2]);
  });

  it("remove drops the item and calls the api", async () => {
    (apiMod.fetchReadingQueue as any).mockResolvedValue({
      items: [item(1, 1), item(2, 2)],
    });
    (apiMod.removeFromReadingQueue as any).mockResolvedValue({
      items: [item(2, 1)],
    });
    const q = useReadingQueue();
    await q.load();

    await q.remove(1);

    expect(apiMod.removeFromReadingQueue).toHaveBeenCalledWith(1);
    expect(q.items.value.map((i) => i.book.id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/composables/__tests__/useReadingQueue.spec.ts`
Expected: FAIL ("Cannot find module '../useReadingQueue'").

- [ ] **Step 3: Implement the composable**

Create `client/src/features/reading-queue/composables/useReadingQueue.ts`:

```ts
import { ref } from "vue";

import type { ReadingQueueItem } from "@bookorbit/types";
import {
  addToReadingQueue,
  fetchReadingQueue,
  removeFromReadingQueue,
  reorderReadingQueue,
} from "../api/reading-queue.api";

export function useReadingQueue() {
  const items = ref<ReadingQueueItem[]>([]);
  const loading = ref(false);
  const error = ref(false);

  async function load() {
    loading.value = true;
    error.value = false;
    try {
      const res = await fetchReadingQueue();
      items.value = res.items;
    } catch {
      error.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function add(bookId: number) {
    const res = await addToReadingQueue(bookId);
    items.value = res.items;
  }

  async function remove(bookId: number) {
    const previous = items.value;
    items.value = items.value.filter((i) => i.book.id !== bookId);
    try {
      const res = await removeFromReadingQueue(bookId);
      items.value = res.items;
    } catch {
      items.value = previous;
      error.value = true;
    }
  }

  async function applyReorder(reordered: ReadingQueueItem[]) {
    const previous = items.value;
    items.value = reordered.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
    try {
      const res = await reorderReadingQueue(reordered.map((i) => i.book.id));
      items.value = res.items;
    } catch {
      items.value = previous;
      error.value = true;
    }
  }

  return { items, loading, error, load, add, remove, applyReorder };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/composables/__tests__/useReadingQueue.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/reading-queue/composables/useReadingQueue.ts client/src/features/reading-queue/composables/__tests__/useReadingQueue.spec.ts
git commit -m "feat(reading-queue): add useReadingQueue composable"
```

---

## Task 10: View-toggle composable (TDD)

**Files:**

- Create: `client/src/features/reading-queue/composables/useReadingQueueView.ts`
- Test: `client/src/features/reading-queue/composables/__tests__/useReadingQueueView.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `client/src/features/reading-queue/composables/__tests__/useReadingQueueView.spec.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../api/reading-queue.api", () => ({
  fetchReadingQueueView: vi.fn(),
  saveReadingQueueView: vi.fn(),
}));

import * as apiMod from "../../api/reading-queue.api";
import { useReadingQueueView } from "../useReadingQueueView";

describe("useReadingQueueView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to grid before load", () => {
    const v = useReadingQueueView();
    expect(v.view.value).toBe("grid");
  });

  it("load applies the persisted view", async () => {
    (apiMod.fetchReadingQueueView as any).mockResolvedValue("list");
    const v = useReadingQueueView();
    await v.load();
    expect(v.view.value).toBe("list");
  });

  it("setView updates immediately and persists", async () => {
    (apiMod.saveReadingQueueView as any).mockResolvedValue(undefined);
    const v = useReadingQueueView();
    await v.setView("list");
    expect(v.view.value).toBe("list");
    expect(apiMod.saveReadingQueueView).toHaveBeenCalledWith("list");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/composables/__tests__/useReadingQueueView.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `client/src/features/reading-queue/composables/useReadingQueueView.ts`:

```ts
import { ref } from "vue";

import type { ReadingQueueView } from "@bookorbit/types";
import {
  fetchReadingQueueView,
  saveReadingQueueView,
} from "../api/reading-queue.api";

export function useReadingQueueView() {
  const view = ref<ReadingQueueView>("grid");

  async function load() {
    try {
      view.value = await fetchReadingQueueView();
    } catch {
      view.value = "grid";
    }
  }

  async function setView(next: ReadingQueueView) {
    view.value = next;
    try {
      await saveReadingQueueView(next);
    } catch {
      // non-fatal; view stays applied locally
    }
  }

  return { view, load, setView };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/composables/__tests__/useReadingQueueView.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/reading-queue/composables/useReadingQueueView.ts client/src/features/reading-queue/composables/__tests__/useReadingQueueView.spec.ts
git commit -m "feat(reading-queue): add view-toggle composable"
```

---

## Task 11: Grid and List view components

These are presentational: they take `items` and emit `reorder` (full reordered array) and `remove` (bookId). Reuse `useDraggableList` for drag handling and the existing `BookCoverImage` component for covers (`@/features/book/components/BookCoverImage.vue`).

**Files:**

- Create: `client/src/features/reading-queue/components/UpNextGrid.vue`
- Create: `client/src/features/reading-queue/components/UpNextList.vue`

> `useDraggableList` lives at `client/src/features/dashboard/composables/useDraggableList.ts`. **Decision (locked):** import it directly from that path for now — do **not** relocate it. If the lint/boundary rules forbid cross-feature imports and the build fails, move it to `client/src/composables/useDraggableList.ts`, update the dashboard import, and re-run. Make this call when the import error actually appears, not preemptively.

- [ ] **Step 1: Implement the grid component**

Create `client/src/features/reading-queue/components/UpNextGrid.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { ReadingQueueItem } from "@bookorbit/types";
import BookCoverImage from "@/features/book/components/BookCoverImage.vue";
import { useDraggableList } from "@/features/dashboard/composables/useDraggableList";

const props = defineProps<{ items: ReadingQueueItem[] }>();
const emit = defineEmits<{ reorder: [ReadingQueueItem[]]; remove: [number] }>();

const local = ref<ReadingQueueItem[]>([...props.items]);
watch(
  () => props.items,
  (next) => {
    local.value = [...next];
  },
);

const { onDragStart, onDragOver, onDrop, onDragEnd } = useDraggableList(local);

function handleDrop(index: number) {
  onDrop(index);
  emit("reorder", [...local.value]);
}

const positions = computed(() => local.value.map((_, i) => i + 1));
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
    <div
      v-for="(item, index) in local"
      :key="item.book.id"
      class="relative cursor-grab"
      draggable="true"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <span
        class="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow"
      >
        {{ positions[index] }}
      </span>
      <BookCoverImage :book="item.book" class="w-full rounded-md" />
      <button
        class="absolute right-1 top-1 rounded bg-black/50 px-1 text-xs text-white opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
        aria-label="Remove from queue"
        @click="emit('remove', item.book.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
```

Check `BookCoverImage`'s required prop name/shape (`grep -n "defineProps" client/src/features/book/components/BookCoverImage.vue`) and pass the field it expects (it may want `:src`/`:cover` rather than the whole `book`). Adjust the binding accordingly.

- [ ] **Step 2: Implement the list component**

Create `client/src/features/reading-queue/components/UpNextList.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";

import type { ReadingQueueItem } from "@bookorbit/types";
import BookCoverImage from "@/features/book/components/BookCoverImage.vue";
import { useDraggableList } from "@/features/dashboard/composables/useDraggableList";

const props = defineProps<{ items: ReadingQueueItem[] }>();
const emit = defineEmits<{ reorder: [ReadingQueueItem[]]; remove: [number] }>();

const local = ref<ReadingQueueItem[]>([...props.items]);
watch(
  () => props.items,
  (next) => {
    local.value = [...next];
  },
);

const { onDragStart, onDragOver, onDrop, onDragEnd } = useDraggableList(local);

function handleDrop(index: number) {
  onDrop(index);
  emit("reorder", [...local.value]);
}
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="(item, index) in local"
      :key="item.book.id"
      class="flex items-center gap-3 rounded-lg border border-border p-2"
      draggable="true"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <span
        class="w-6 text-center text-lg font-extrabold text-muted-foreground"
        >{{ index + 1 }}</span
      >
      <BookCoverImage :book="item.book" class="h-12 w-8 rounded" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold">{{ item.book.title }}</div>
        <div class="truncate text-xs text-muted-foreground">
          {{ (item.book as any).author ?? "" }}
        </div>
      </div>
      <span class="cursor-grab text-muted-foreground">⋮⋮</span>
      <button
        class="text-muted-foreground hover:text-foreground"
        aria-label="Remove from queue"
        @click="emit('remove', item.book.id)"
      >
        ✕
      </button>
    </li>
  </ul>
</template>
```

Use the real author field name from `BookCard` instead of `(item.book as any).author` (check the card type).

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/reading-queue/components/UpNextGrid.vue client/src/features/reading-queue/components/UpNextList.vue
git commit -m "feat(reading-queue): add grid and list view components"
```

---

## Task 12: Up Next page + route + sidebar nav

**Files:**

- Create: `client/src/views/UpNextView.vue`
- Modify: `client/src/router/index.ts`
- Modify: `client/src/components/AppSidebar.vue`

- [ ] **Step 1: Implement the page**

Create `client/src/views/UpNextView.vue`:

```vue
<script setup lang="ts">
import { onMounted } from "vue";

import { useReadingQueue } from "@/features/reading-queue/composables/useReadingQueue";
import { useReadingQueueView } from "@/features/reading-queue/composables/useReadingQueueView";
import UpNextGrid from "@/features/reading-queue/components/UpNextGrid.vue";
import UpNextList from "@/features/reading-queue/components/UpNextList.vue";
import type { ReadingQueueItem } from "@bookorbit/types";

const { items, loading, load, remove, applyReorder } = useReadingQueue();
const { view, load: loadView, setView } = useReadingQueueView();

onMounted(() => {
  load();
  loadView();
});

function onReorder(reordered: ReadingQueueItem[]) {
  applyReorder(reordered);
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl p-4">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold">Up Next</h1>
      <div class="inline-flex overflow-hidden rounded-md border border-border">
        <button
          class="px-3 py-1 text-sm"
          :class="view === 'grid' ? 'bg-primary text-primary-foreground' : ''"
          @click="setView('grid')"
        >
          Grid
        </button>
        <button
          class="px-3 py-1 text-sm"
          :class="view === 'list' ? 'bg-primary text-primary-foreground' : ''"
          @click="setView('list')"
        >
          List
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-muted-foreground">Loading…</div>
    <div
      v-else-if="items.length === 0"
      class="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
    >
      Your queue is empty. Add books from a book's page or the book dock.
    </div>
    <template v-else>
      <UpNextGrid
        v-if="view === 'grid'"
        :items="items"
        @reorder="onReorder"
        @remove="remove"
      />
      <UpNextList v-else :items="items" @reorder="onReorder" @remove="remove" />
    </template>
  </div>
</template>
```

- [ ] **Step 2: Register the route**

In `client/src/router/index.ts`, add inside the same children array as the `/collection/:id` route:

```ts
{
  path: '/up-next',
  name: 'up-next',
  component: () => import('@/views/UpNextView.vue'),
  meta: { title: 'Up Next' },
},
```

- [ ] **Step 3: Add the sidebar nav link**

In `client/src/components/AppSidebar.vue`, find the existing nav entries (e.g. the Collections / Series links) and add an "Up Next" entry pointing to the `up-next` route, following the exact markup pattern already used there (likely a `SidebarNavItem` with an icon from `lucide-vue-next` — use `ListOrdered` or `BookMarked`). Match the surrounding entries' props exactly.

- [ ] **Step 4: Run the app and verify manually**

Run: `pnpm dev` (Node 22). Open the app, sign in, click "Up Next" in the sidebar. Verify: empty state shows; toggling Grid/List persists across reload; after adding books (Task 13), drag-and-drop reorders and survives reload.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm run typecheck` → PASS.

```bash
git add client/src/views/UpNextView.vue client/src/router/index.ts client/src/components/AppSidebar.vue
git commit -m "feat(reading-queue): add Up Next page, route, and sidebar nav"
```

---

## Task 13: Add-to-queue entry points

**Files:**

- Create: `client/src/features/reading-queue/components/AddToQueueButton.vue`
- Modify: book detail view (find via `grep -rln "useBookDetail\|BookDetail" client/src/views client/src/features/book`)
- Modify: `client/src/features/book-dock/components/BookDockToolbar.vue`

- [ ] **Step 1: Implement the button component**

Create `client/src/features/reading-queue/components/AddToQueueButton.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";

import { addToReadingQueue } from "@/features/reading-queue/api/reading-queue.api";
import { toast } from "vue-sonner";

const props = defineProps<{ bookId: number }>();
const busy = ref(false);

async function add() {
  busy.value = true;
  try {
    await addToReadingQueue(props.bookId);
    toast.success("Added to Up Next");
  } catch {
    toast.error("Could not add to Up Next");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button
    :disabled="busy"
    class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
    @click="add"
  >
    Add to Up Next
  </button>
</template>
```

Confirm `vue-sonner`'s `toast` is the project's toast (it is used in `AppHeader.vue`). Match button styling to the book detail page's existing action buttons rather than the generic classes above.

- [ ] **Step 2: Mount it on the book detail page**

In the book detail view, import and render `<AddToQueueButton :book-id="book.id" />` next to the other per-book actions (e.g. near "Add to collection"). Use the actual book id ref available in that view.

- [ ] **Step 3: Add a bulk action in the book dock toolbar**

In `client/src/features/book-dock/components/BookDockToolbar.vue`, add an "Add to Up Next" action to the multi-select toolbar that iterates the selected book ids and calls `addToReadingQueue` for each (or, if you prefer fewer requests, this is a candidate for a future bulk endpoint — for v1, loop and `await Promise.all`). Show a single toast summarizing the count. Follow the existing toolbar action markup/handlers in that file.

```ts
// inside the toolbar <script setup>, given `selectedBookIds: number[]`
import { addToReadingQueue } from "@/features/reading-queue/api/reading-queue.api";
import { toast } from "vue-sonner";

async function addSelectedToQueue() {
  const ids = selectedBookIds.value;
  await Promise.all(ids.map((id) => addToReadingQueue(id)));
  toast.success(
    `Added ${ids.length} book${ids.length === 1 ? "" : "s"} to Up Next`,
  );
}
```

Wire `addSelectedToQueue` to a new toolbar button matching the existing ones.

- [ ] **Step 4: In-page picker (Up Next page)**

On `UpNextView.vue`, add an "+ Add books" button that opens the app's existing book-search/picker (reuse the same component the "Add to collection" flow uses — find it via `grep -rln "AddToCollection" client/src`). On select, call the `add(bookId)` from `useReadingQueue`. If reusing the existing picker is non-trivial, a minimal acceptable v1 is a search input that queries the existing book search endpoint and lists results with an "Add" button each. Keep it behind the same `useReadingQueue().add`.

- [ ] **Step 5: Manual verification**

Run `pnpm dev`. Add a book from the detail page → appears on Up Next. Select several in the book dock → bulk add works. Add via in-page picker → appears and is reorderable.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm run typecheck` → PASS.

```bash
git add client/src/features/reading-queue/components/AddToQueueButton.vue client/src/features/book-dock/components/BookDockToolbar.vue client/src/views/UpNextView.vue
# plus the book detail view file you modified
git commit -m "feat(reading-queue): add entry points (book detail, book dock, in-page picker)"
```

---

## Task 14: Dashboard "Up Next" widget

**Files:**

- Modify: `packages/types/src/dashboard.ts` — add `up-next` to `WIDGET_TYPE`, add `UpNextWidgetData`.
- Modify: `server/src/modules/dashboard/dashboard.controller.ts` + its service — add `GET /dashboard/widgets/up-next`.
- Modify: `client/src/features/dashboard/composables/useDashboardWidgets.ts` — label + default entry.
- Modify: `client/src/features/dashboard/api/dashboard-widget.api.ts` — `fetchUpNext()`.
- Create: `client/src/features/dashboard/composables/useUpNextWidget.ts`.
- Create: `client/src/features/dashboard/components/widgets/UpNextWidget.vue`.
- Modify: the widget switch (e.g. `DashboardWidgetRow.vue`) to render `UpNextWidget` for type `up-next`.

- [ ] **Step 1: Extend the widget type + data type**

In `packages/types/src/dashboard.ts`, add to `WIDGET_TYPE`:

```ts
  UP_NEXT: "up-next",
```

and add the data type:

```ts
export type UpNextWidgetData = {
  items: ReadingQueueItem[];
  totalCount: number;
};
```

Import `ReadingQueueItem` at the top of `dashboard.ts`:

```ts
import type { ReadingQueueItem } from "./reading-queue";
```

- [ ] **Step 2: Add the backend widget endpoint**

In `server/src/modules/dashboard/dashboard.controller.ts`, add (mirroring `widgets/reading-streak`):

```ts
@Get('widgets/up-next')
getUpNext(@CurrentUser() user: RequestUser) {
  return this.dashboardService.getUpNextWidget(user);
}
```

In the dashboard service, implement `getUpNextWidget` by calling the exported `ReadingQueueService.getQueue` and shaping the top 5:

```ts
async getUpNextWidget(user: RequestUser): Promise<UpNextWidgetData> {
  const queue = await this.readingQueueService.getQueue(user);
  return { items: queue.items.slice(0, 5), totalCount: queue.items.length };
}
```

Inject `ReadingQueueService` into the dashboard service and add `ReadingQueueModule` to the dashboard module's `imports`. (Confirm the dashboard module file path and add the import.)

- [ ] **Step 3: Register the widget on the client**

In `client/src/features/dashboard/composables/useDashboardWidgets.ts`, add to `WIDGET_LABELS`:

```ts
  'up-next': 'Up Next',
```

and add a default (disabled by default to avoid surprising existing users) to `DEFAULT_WIDGETS`:

```ts
  { id: '13', type: 'up-next', enabled: false, order: 13 },
```

- [ ] **Step 4: Add the client api + composable**

In `client/src/features/dashboard/api/dashboard-widget.api.ts`, add:

```ts
export async function fetchUpNext(): Promise<UpNextWidgetData> {
  const res = await api("/api/v1/dashboard/widgets/up-next");
  if (!res.ok) throw new Error("Failed to fetch up next");
  return res.json();
}
```

(import `UpNextWidgetData` in the existing type import block).

Create `client/src/features/dashboard/composables/useUpNextWidget.ts`:

```ts
import { onMounted, ref } from "vue";

import type { UpNextWidgetData } from "@bookorbit/types";
import { fetchUpNext } from "../api/dashboard-widget.api";

export function useUpNextWidget() {
  const data = ref<UpNextWidgetData | null>(null);
  const loading = ref(true);
  const error = ref(false);

  async function load() {
    loading.value = true;
    error.value = false;
    try {
      data.value = await fetchUpNext();
    } catch {
      error.value = true;
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
  return { data, loading, error, refresh: load };
}
```

- [ ] **Step 5: Create the widget component (read-only)**

Create `client/src/features/dashboard/components/widgets/UpNextWidget.vue`:

```vue
<script setup lang="ts">
import { RouterLink } from "vue-router";

import { useUpNextWidget } from "../../composables/useUpNextWidget";

const { data, loading, error } = useUpNextWidget();
</script>

<template>
  <div class="rounded-lg border border-border p-4">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="text-sm font-semibold">Up Next</h3>
      <RouterLink
        :to="{ name: 'up-next' }"
        class="text-xs text-primary hover:underline"
        >View all →</RouterLink
      >
    </div>
    <div v-if="loading" class="text-xs text-muted-foreground">Loading…</div>
    <div v-else-if="error" class="text-xs text-destructive">
      Couldn't load queue
    </div>
    <div
      v-else-if="!data || data.items.length === 0"
      class="text-xs text-muted-foreground"
    >
      Your queue is empty.
    </div>
    <ol v-else class="flex flex-col gap-1">
      <li
        v-for="(item, index) in data.items"
        :key="item.book.id"
        class="flex items-center gap-2 text-sm"
      >
        <span class="w-5 text-center font-bold text-muted-foreground">{{
          index + 1
        }}</span>
        <span class="truncate">{{ item.book.title }}</span>
      </li>
    </ol>
  </div>
</template>
```

- [ ] **Step 6: Render it in the widget switch**

In the component that renders widgets by type (find via `grep -rln "currently-reading\|CurrentlyReadingWidget" client/src/features/dashboard/components`), add the `up-next` case rendering `<UpNextWidget />`, mirroring the existing cases.

- [ ] **Step 7: Typecheck + manual check**

Run: `pnpm run typecheck` → PASS.
Run `pnpm dev`, enable the "Up Next" widget in dashboard settings, confirm it lists the top items and "View all" links to `/up-next`.

- [ ] **Step 8: Commit**

```bash
git add packages/types/src/dashboard.ts server/src/modules/dashboard client/src/features/dashboard
git commit -m "feat(reading-queue): add Up Next dashboard widget"
```

---

## Task 15: Full verification

- [ ] **Step 1: Run the full server test suite for the new module**

Run: `cd server && pnpm exec vitest run src/modules/reading-queue src/modules/user-preferences src/modules/dashboard`
Expected: PASS.

- [ ] **Step 2: Run client tests for the feature**

Run: `cd client && pnpm exec vitest run src/features/reading-queue`
Expected: PASS.

- [ ] **Step 3: Typecheck everything**

Run: `pnpm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Architecture boundary test**

Run: `cd server && pnpm exec vitest run src/modules/architecture/architecture-boundaries.test.ts`
Expected: PASS (no new violations introduced by the reading-queue module).

- [ ] **Step 5: Final manual smoke test**

Run `pnpm dev` (Node 22). Verify the full loop: add from detail page + book dock + in-page picker → reorder by drag in both grid and list → toggle persists across reload → remove works → dashboard widget shows top 5 with working "View all".

- [ ] **Step 6: Confirm migration applies cleanly**

Run: `cd server && pnpm db:migrate` against a dev database.
Expected: the `reading_queue_items` migration applies without error.

---

## Notes for the implementer

- **Pre-existing failing tests:** the repo currently has 7 unrelated failing server tests (KoReader/zlib/architecture mocks). Do not try to fix them as part of this work; only ensure you add no _new_ failures.
- **DRY:** the GET/POST/DELETE/PUT endpoints all return the full queue via `getQueue`, so the client can replace state from any mutation response without a second fetch.
- **YAGNI:** no dates, no multiple lists, no auto-advance, no Kobo sync — all explicitly deferred per the spec.
- Verify the exact names flagged inline (`BookCard`, `getAccessibleLibraryIds`, `findLibraryIdByBookId` return shape, `BookCoverImage` props, user-preferences repo method names) before assuming — they are the only spots where this plan depends on names it could not fully confirm.
