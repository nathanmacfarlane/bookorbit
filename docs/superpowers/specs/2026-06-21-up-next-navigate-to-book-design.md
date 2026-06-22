# Navigate to a Book from Up Next

**Status:** Approved design — ready for implementation planning
**Date:** 2026-06-21

## Summary

Let users open a book's full detail view (`/book/:bookId`) from the Up Next queue, in
both the grid and list views, via two paths: clicking the item directly, and a per-item
3-dot menu. Drag-to-reorder continues to work unchanged.

## Goals

- Click a queue item's cover (grid) or row body (list) → open the full book detail
  route (`{ name: 'book-detail', params: { bookId } }`).
- Provide a 3-dot menu per item with "View details" and "Remove from queue".
- Do not break drag-to-reorder.

## Non-goals

- No change to the global `thumbnailClickAction` preference or other book surfaces
  (the user can flip that setting themselves; out of scope here).
- No backend changes.

## Design

### Components

Changes are limited to:

- `client/src/features/reading-queue/components/UpNextGrid.vue`
- `client/src/features/reading-queue/components/UpNextList.vue`
- `client/src/views/UpNextView.vue`

### Interaction

- **Click to open.** The cover (grid) / row body (list) gets a click handler that emits
  a new `open: [number]` event carrying the `bookId`. `UpNextView` handles it by calling
  `router.push({ name: 'book-detail', params: { bookId } })`.
- **3-dot menu replaces the bare ✕.** Using the existing dropdown UI primitives
  (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`) and a
  `MoreVertical` icon from `lucide-vue-next`, each item gets a menu with:
  - **View details** → emits `open` with the bookId.
  - **Remove from queue** → emits `remove` with the bookId (existing behavior, relocated
    from the standalone ✕ button into the menu).
- **No click/drag/menu conflicts.**
  - HTML5 drag-and-drop and `click` fire distinct events on the same element, so a plain
    click opens the book while a drag reorders. (On touch, where HTML5 DnD is unreliable,
    click-to-open still works; reordering is a separate concern not changed here.)
  - The 3-dot trigger and its menu items use `@click.stop` so interacting with the menu
    never triggers card navigation.

### Emit vs. navigate-in-component

The components emit `open(bookId)` rather than navigating internally, keeping them
presentation-only and consistent with their existing `remove`/`reorder` emits.
`UpNextView` owns navigation (adds `useRouter()` + an `onOpen` handler). This differs
intentionally from `BookCoverCard.vue` (which navigates internally) because the Up Next
components are already built around emitting events to the page.

### Events (after change)

Both `UpNextGrid` and `UpNextList`:

- `reorder: [ReadingQueueItem[]]` (unchanged)
- `remove: [number]` (now triggered from the menu instead of the ✕ button)
- `open: [number]` (new)

## Testing

Lightweight component tests (mount each component with a couple of items):

- Clicking the item's cover/row emits `open` with the correct `bookId`.
- The menu's "View details" emits `open` with the correct `bookId`.
- The menu's "Remove from queue" emits `remove` with the correct `bookId`.

`UpNextView`: the `open` handler calls `router.push` with `{ name: 'book-detail',
params: { bookId } }` (can be verified via a mocked router, mirroring existing view
tests if present; otherwise rely on the component tests + typecheck).
