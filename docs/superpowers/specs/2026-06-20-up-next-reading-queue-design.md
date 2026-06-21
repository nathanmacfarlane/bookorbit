# Up Next — Reading Queue

**Status:** Approved design — ready for implementation planning
**Date:** 2026-06-20

## Summary

A personal, manually-curated **"Up Next" reading queue**: a single per-user ordered
list of books the user plans to read. The user adds library books to the queue and
drags them into the order they intend to read them. The queue is presented on a
dedicated page with a toggle between a numbered **cover grid** and a numbered
**ranked list**, both reorderable by drag-and-drop, plus a compact read-only
**dashboard widget** showing the top few.

## Goals

- Give the user one clear, ordered answer to "what do I read next?"
- Fast reordering via drag-and-drop in either a visual grid or a compact list.
- Surface the top of the queue on the dashboard.

## Non-goals (v1)

The following are intentionally deferred and **out of scope** for this spec:

- Per-book target/start dates and reminders.
- Pace/cadence goals and projected start dates.
- Multiple named planned lists (v1 is a single global queue).
- Wishlist / unowned-book placeholders (queue holds owned library books only).
- Auto-advance behavior tied to reading status (queue is fully manual).
- Kobo sync of the queue.

These are recorded here so the data model and UI leave room for them later, but no
implementation work is done for them now.

## Key decisions

These were settled during brainstorming and are fixed for v1:

1. **One global queue per user** — not multiple named lists, and not ordering layered
   onto Collections. Collections remain unordered groupings; the queue is the single
   sequencing tool. Rationale: keeps Collections clean, matches the "only one next"
   mental model, smallest surface to ship.
2. **Library books only** — the queue references real `books` records.
3. **No dates in v1** — just an ordered, numbered queue.
4. **Fully manual** — reading/finishing a book has no automatic effect on the queue.
   The queue changes only when the user adds, removes, or reorders.
5. **Dedicated page + dashboard widget** — both surfaces.
6. **Two reorderable views with a persisted toggle** — cover grid and ranked list.
7. **Position stored as an integer, rewritten wholesale on reorder** — not fractional
   ranking. Simple and fine at queue scale.
8. **Widget is read-only** — reordering happens only on the page.

## Data model

New table `reading_queue_items`:

| column       | type / notes                                            |
| ------------ | ------------------------------------------------------- |
| `id`         | serial primary key                                      |
| `user_id`    | integer, FK → `users.id`, `on delete cascade`, not null |
| `book_id`    | integer, FK → `books.id`, `on delete cascade`, not null |
| `position`   | integer, not null — order within the user's queue       |
| `created_at` | timestamptz, default now, not null                      |

Indexes:

- Unique index on `(user_id, book_id)` — a book appears in a user's queue at most once.
- Index on `(user_id, position)` — ordered fetch.

Drizzle schema lives in `server/src/db/schema/` and is exported from
`server/src/db/schema/index.ts`, with a generated migration in
`server/src/db/migrations/`.

**View-toggle preference** is _not_ a new table. It is stored in the existing
`user_preferences` table under a new `category` value `reading-queue`, with
`data = { "view": "grid" | "list" }`. This follows the established preference pattern
(one row per `(user_id, category)`).

## Backend — `reading-queue` module

A new NestJS module `server/src/modules/reading-queue/` following the existing
controller / service / repository layout used by other modules (e.g. `collection`).

Shared types go in `packages/types/src/reading-queue.ts` and are re-exported from the
package index.

### Endpoints

All routes are user-scoped via the authenticated user; no library scoping in v1
(the queue is global per user). Books are validated to exist and be accessible to the
user before being added.

| Method & path                   | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `GET /reading-queue`            | Ordered queue items with book details for rendering.               |
| `POST /reading-queue`           | Add a book to the end of the queue. No-op (idempotent) if present. |
| `DELETE /reading-queue/:bookId` | Remove a book from the queue; remaining positions are compacted.   |
| `PUT /reading-queue/reorder`    | Replace ordering. Body is the full ordered array of `bookId`s.     |

### Behavior details

- **GET** returns items ordered by `position`, each enriched with the fields the UI
  needs: book id, title, author(s), cover reference, and current read status (for
  display only — status does not change queue membership). Reuse existing book-detail
  / cover lookups rather than duplicating them.
- **POST** appends with `position = max(position) + 1` for that user. If the book is
  already in the queue, return the existing state without error (idempotent).
- **DELETE** removes the row, then compacts positions so they remain contiguous.
- **PUT reorder** accepts the complete ordered list of the user's queued `bookId`s and
  rewrites every `position` in a single transaction. Reject the request if the set of
  ids does not match the user's current queue membership (guards against stale clients).

### DB-injection allowlist

If the architecture-boundary test enforces an explicit allowlist for services that
inject the DB directly, add the new repository/service appropriately so the boundary
test stays green.

## Frontend

### Dedicated page

- Route `/up-next` registered in `client/src/router/index.ts`, with a sidebar nav
  entry and an appropriate icon.
- Feature folder `client/src/features/reading-queue/` (components, composables, api),
  matching the structure of features like `collection`.
- Page header includes a **segmented grid ⇄ list toggle**. The selected view is
  persisted to `user_preferences` (`reading-queue` category) and restored on load.
- **Grid view (Option A):** responsive wall of book covers, each with a circular
  position badge (1, 2, 3, …) and a remove affordance.
- **List view (Option B):** vertical ranked rows — large position number, small cover
  thumbnail, title/author, drag handle, remove affordance.
- **Both views reorder via drag-and-drop**, reusing the existing
  `useDraggableList` composable (`client/src/features/dashboard/composables/useDraggableList.ts`),
  which already provides HTML5 drag handlers plus `moveUp`/`moveDown` (the latter also
  serve as keyboard/mobile-friendly reordering). On drop/reorder, persist via the
  `PUT /reading-queue/reorder` endpoint. Apply the new order optimistically and
  reconcile/revert on error.
- **Empty state** prompts the user to add books.

If `useDraggableList` needs to be shared between the dashboard and reading-queue
features, move it to a shared composables location and update the dashboard import;
otherwise import it as-is. Decide during planning based on lint/boundary rules.

### Dashboard widget

- New widget type `up-next` added to the dashboard widget system: register in
  `@bookorbit/types` (`WIDGET_TYPES`), add a label in `WIDGET_LABELS`, include it in
  `DEFAULT_WIDGETS`, and add a widget component
  (`client/src/features/dashboard/components/widgets/UpNextWidget.vue`) plus its
  composable.
- The widget is **read-only**: shows the top ~5 queue items with their position
  numbers and a "View all →" link to `/up-next`. No drag-and-drop in the widget.

### Entry points to add books

1. **Book detail page** — an "Add to Up Next" action (toggles to "Remove from Up Next"
   when already queued).
2. **Book dock multi-select** — a bulk "Add to Up Next" action in the selection
   toolbar, reusing the existing shift-click multi-select.
3. **In-page picker** — an "+ Add books" control on the Up Next page to search/select
   library books to append.

## Testing

- **Server:** repository tests (add, remove with position compaction, reorder,
  dedupe/idempotent add, position integrity, membership-mismatch rejection); service
  tests; controller e2e for all four endpoints.
- **Client:** unit tests for the reading-queue composable(s) (ordering, optimistic
  reorder + revert on error) and for view-toggle persistence/restore.

## Future extensions (not implemented)

- Per-book target/start dates and reminders.
- Pace/cadence goal with auto-projected start dates.
- Multiple named planned lists.
- Wishlist / unowned items (integrating with Z-Library search results).
- Optional auto-advance modes (remove on start, or remove on finish).
