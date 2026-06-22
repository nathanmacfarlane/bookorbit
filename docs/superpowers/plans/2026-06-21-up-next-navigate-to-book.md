# Navigate to a Book from Up Next Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open a book's full detail view (`/book/:bookId`) from the Up Next grid and list — by clicking the item, and via a per-item 3-dot menu — without breaking drag-to-reorder.

**Architecture:** `UpNextGrid.vue` and `UpNextList.vue` gain a new `open: [number]` emit; a clickable cover/row region emits it, and a `DropdownMenu` (replacing the bare ✕) offers "View details" (emits `open`) and "Remove from queue" (emits `remove`). `UpNextView.vue` handles `@open` by routing to `book-detail`. Components stay presentation-only (emit, don't navigate).

**Tech Stack:** Vue 3 `<script setup>`, `@vue/test-utils` + Vitest, reka-ui dropdown primitives from `@/components/ui/dropdown-menu`, `lucide-vue-next` icons.

---

## Environment note

Use Node 22+ for all commands (hooks fail on Node 18):

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
```

Client tests: `cd client && pnpm exec vitest run <path>`. Typecheck: `pnpm run typecheck`.

## Facts already verified (use as-is)

- Dropdown primitives import from the barrel `@/components/ui/dropdown-menu` (exports `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`). The codebase attaches `@click` directly to `<DropdownMenuItem>` and it works (see `client/src/components/SelectionActionBar.vue`).
- `MoreVertical` is a valid `lucide-vue-next` icon (used in `client/src/components/AppHeader.vue`).
- The full book detail route is `{ name: 'book-detail', params: { bookId } }` (`client/src/router/index.ts`).
- `ReadingQueueItem = { position: number; book: BookCard }`; `BookCard` has `id: number`, `title: string | null`, `authors: string[]`, `updatedAt: string | null`.

## File structure

- Modify: `client/src/features/reading-queue/components/UpNextGrid.vue`
- Modify: `client/src/features/reading-queue/components/UpNextList.vue`
- Modify: `client/src/views/UpNextView.vue`
- Create: `client/src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts`
- Create: `client/src/features/reading-queue/components/__tests__/UpNextList.spec.ts`

---

## Task 1: UpNextGrid — click-to-open + 3-dot menu (TDD)

**Files:**

- Modify: `client/src/features/reading-queue/components/UpNextGrid.vue`
- Create: `client/src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ReadingQueueItem } from "@bookorbit/types";

import UpNextGrid from "../UpNextGrid.vue";

const items = [
  { position: 1, book: { id: 7, title: "A", authors: [], updatedAt: null } },
  { position: 2, book: { id: 3, title: "B", authors: [], updatedAt: null } },
] as unknown as ReadingQueueItem[];

// Stub the dropdown primitives so menu items render synchronously (no teleport/portal).
const stubs = {
  BookCoverImage: true,
  DropdownMenu: { template: "<div><slot /></div>" },
  DropdownMenuTrigger: { template: "<div><slot /></div>" },
  DropdownMenuContent: { template: "<div><slot /></div>" },
  DropdownMenuItem: { template: '<button v-bind="$attrs"><slot /></button>' },
};

function mountGrid() {
  return mount(UpNextGrid, { props: { items }, global: { stubs } });
}

describe("UpNextGrid", () => {
  it("emits open with the bookId when the cover region is clicked", async () => {
    const wrapper = mountGrid();
    await wrapper.findAll('[data-testid="upnext-open"]')[0].trigger("click");
    expect(wrapper.emitted("open")?.[0]).toEqual([7]);
  });

  it('emits open from the "View details" menu item', async () => {
    const wrapper = mountGrid();
    await wrapper
      .findAll('[data-testid="upnext-view-details"]')[1]
      .trigger("click");
    expect(wrapper.emitted("open")?.[0]).toEqual([3]);
  });

  it('emits remove from the "Remove from queue" menu item', async () => {
    const wrapper = mountGrid();
    await wrapper.findAll('[data-testid="upnext-remove"]')[0].trigger("click");
    expect(wrapper.emitted("remove")?.[0]).toEqual([7]);
  });

  it("clicking the menu trigger does not emit open", async () => {
    const wrapper = mountGrid();
    await wrapper.findAll('[data-testid="upnext-menu"]')[0].trigger("click");
    expect(wrapper.emitted("open")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts`
Expected: FAIL — `[data-testid="upnext-open"]` / `upnext-view-details` not found (current component has no open region or menu).

- [ ] **Step 3: Replace the component with the new version**

Overwrite `client/src/features/reading-queue/components/UpNextGrid.vue` with:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { MoreVertical } from "lucide-vue-next";
import type { ReadingQueueItem } from "@bookorbit/types";
import BookCoverImage from "@/features/book/components/BookCoverImage.vue";
import { useDraggableList } from "@/features/dashboard/composables/useDraggableList";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const props = defineProps<{
  items: ReadingQueueItem[];
}>();

const emit = defineEmits<{
  reorder: [items: ReadingQueueItem[]];
  remove: [bookId: number];
  open: [bookId: number];
}>();

const local = ref<ReadingQueueItem[]>([...props.items]);

watch(
  () => props.items,
  (next) => {
    local.value = [...next];
  },
);

const { onDragStart, onDragOver, onDrop, onDragEnd, dragOverIndex } =
  useDraggableList(local);

function handleDrop(index: number) {
  onDrop(index);
  emit("reorder", [...local.value]);
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
    <div
      v-for="(item, index) in local"
      :key="item.book.id"
      draggable="true"
      class="relative group cursor-grab active:cursor-grabbing rounded-lg overflow-hidden border border-border transition-opacity"
      :class="{ 'opacity-50': dragOverIndex === index }"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <!-- Clickable open region (cover + title) -->
      <div
        data-testid="upnext-open"
        class="cursor-pointer"
        @click="emit('open', item.book.id)"
      >
        <BookCoverImage
          :book-id="item.book.id"
          type="thumbnail"
          :version="item.book.updatedAt"
          :alt="item.book.title ?? ''"
          class="w-full aspect-[2/3] object-cover bg-muted"
        />
        <div
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <p class="text-xs text-white font-medium truncate">
            {{ item.book.title ?? "Untitled" }}
          </p>
        </div>
      </div>

      <!-- Position badge -->
      <span
        class="pointer-events-none absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow"
      >
        {{ index + 1 }}
      </span>

      <!-- 3-dot menu (visible on hover) -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            data-testid="upnext-menu"
            class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow"
            title="Actions"
            @click.stop
          >
            <MoreVertical class="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            data-testid="upnext-view-details"
            @click="emit('open', item.book.id)"
            >View details</DropdownMenuItem
          >
          <DropdownMenuItem
            data-testid="upnext-remove"
            @click="emit('remove', item.book.id)"
            >Remove from queue</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: exit 0 (ignore unrelated pre-existing failures elsewhere).

- [ ] **Step 6: Commit**

```bash
git add client/src/features/reading-queue/components/UpNextGrid.vue client/src/features/reading-queue/components/__tests__/UpNextGrid.spec.ts
git commit -m "feat(reading-queue): open book from Up Next grid (click + 3-dot menu)"
```

---

## Task 2: UpNextList — click-to-open + 3-dot menu (TDD)

**Files:**

- Modify: `client/src/features/reading-queue/components/UpNextList.vue`
- Create: `client/src/features/reading-queue/components/__tests__/UpNextList.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/reading-queue/components/__tests__/UpNextList.spec.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ReadingQueueItem } from "@bookorbit/types";

import UpNextList from "../UpNextList.vue";

const items = [
  {
    position: 1,
    book: { id: 7, title: "A", authors: ["Author A"], updatedAt: null },
  },
  { position: 2, book: { id: 3, title: "B", authors: [], updatedAt: null } },
] as unknown as ReadingQueueItem[];

const stubs = {
  BookCoverImage: true,
  DropdownMenu: { template: "<div><slot /></div>" },
  DropdownMenuTrigger: { template: "<div><slot /></div>" },
  DropdownMenuContent: { template: "<div><slot /></div>" },
  DropdownMenuItem: { template: '<button v-bind="$attrs"><slot /></button>' },
};

function mountList() {
  return mount(UpNextList, { props: { items }, global: { stubs } });
}

describe("UpNextList", () => {
  it("emits open with the bookId when the row body is clicked", async () => {
    const wrapper = mountList();
    await wrapper.findAll('[data-testid="upnext-open"]')[0].trigger("click");
    expect(wrapper.emitted("open")?.[0]).toEqual([7]);
  });

  it('emits open from the "View details" menu item', async () => {
    const wrapper = mountList();
    await wrapper
      .findAll('[data-testid="upnext-view-details"]')[1]
      .trigger("click");
    expect(wrapper.emitted("open")?.[0]).toEqual([3]);
  });

  it('emits remove from the "Remove from queue" menu item', async () => {
    const wrapper = mountList();
    await wrapper.findAll('[data-testid="upnext-remove"]')[0].trigger("click");
    expect(wrapper.emitted("remove")?.[0]).toEqual([7]);
  });

  it("clicking the menu trigger does not emit open", async () => {
    const wrapper = mountList();
    await wrapper.findAll('[data-testid="upnext-menu"]')[0].trigger("click");
    expect(wrapper.emitted("open")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/components/__tests__/UpNextList.spec.ts`
Expected: FAIL — testids not found.

- [ ] **Step 3: Replace the component with the new version**

Overwrite `client/src/features/reading-queue/components/UpNextList.vue` with:

```vue
<script setup lang="ts">
import { ref, watch } from "vue";
import { MoreVertical } from "lucide-vue-next";
import type { ReadingQueueItem } from "@bookorbit/types";
import BookCoverImage from "@/features/book/components/BookCoverImage.vue";
import { useDraggableList } from "@/features/dashboard/composables/useDraggableList";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const props = defineProps<{
  items: ReadingQueueItem[];
}>();

const emit = defineEmits<{
  reorder: [items: ReadingQueueItem[]];
  remove: [bookId: number];
  open: [bookId: number];
}>();

const local = ref<ReadingQueueItem[]>([...props.items]);

watch(
  () => props.items,
  (next) => {
    local.value = [...next];
  },
);

const { onDragStart, onDragOver, onDrop, onDragEnd, dragOverIndex } =
  useDraggableList(local);

function handleDrop(index: number) {
  onDrop(index);
  emit("reorder", [...local.value]);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="(item, index) in local"
      :key="item.book.id"
      draggable="true"
      class="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors cursor-grab active:cursor-grabbing"
      :class="{ 'opacity-50': dragOverIndex === index }"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <!-- Position number -->
      <span
        class="w-7 shrink-0 text-center text-lg font-bold text-muted-foreground"
      >
        {{ index + 1 }}
      </span>

      <!-- Clickable open region (cover + title/authors) -->
      <div
        data-testid="upnext-open"
        class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        @click="emit('open', item.book.id)"
      >
        <BookCoverImage
          :book-id="item.book.id"
          type="thumbnail"
          :version="item.book.updatedAt"
          :alt="item.book.title ?? ''"
          class="h-14 w-10 object-cover rounded shrink-0 bg-muted"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-foreground truncate">
            {{ item.book.title ?? "Untitled" }}
          </p>
          <p
            v-if="item.book.authors.length"
            class="text-xs text-muted-foreground truncate mt-0.5"
          >
            {{ item.book.authors.join(", ") }}
          </p>
        </div>
      </div>

      <!-- Drag handle affordance -->
      <span
        class="shrink-0 text-muted-foreground/50 cursor-grab"
        title="Drag to reorder"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>

      <!-- 3-dot menu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            data-testid="upnext-menu"
            class="shrink-0 flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Actions"
            @click.stop
          >
            <MoreVertical class="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            data-testid="upnext-view-details"
            @click="emit('open', item.book.id)"
            >View details</DropdownMenuItem
          >
          <DropdownMenuItem
            data-testid="upnext-remove"
            @click="emit('remove', item.book.id)"
            >Remove from queue</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && pnpm exec vitest run src/features/reading-queue/components/__tests__/UpNextList.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/reading-queue/components/UpNextList.vue client/src/features/reading-queue/components/__tests__/UpNextList.spec.ts
git commit -m "feat(reading-queue): open book from Up Next list (click + 3-dot menu)"
```

---

## Task 3: UpNextView — route to book detail on open

**Files:**

- Modify: `client/src/views/UpNextView.vue`

- [ ] **Step 1: Wire the `open` event to navigation**

In `client/src/views/UpNextView.vue`:

1. Add `useRouter` to the existing `vue-router`-free script — add this import near the other imports:

```ts
import { useRouter } from "vue-router";
```

2. After the existing `const { view, load: loadView, setView } = useReadingQueueView()` line, add:

```ts
const router = useRouter();

function onOpen(bookId: number) {
  router.push({ name: "book-detail", params: { bookId } });
}
```

3. In the template, add `@open="onOpen"` to BOTH component usages so they read:

```vue
<UpNextGrid
  v-if="view === 'grid'"
  :items="items"
  @reorder="onReorder"
  @remove="remove"
  @open="onOpen"
/>
<UpNextList
  v-else
  :items="items"
  @reorder="onReorder"
  @remove="remove"
  @open="onOpen"
/>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: exit 0. (TypeScript will error if `@open` isn't declared on the child emits — confirms wiring.)

- [ ] **Step 3: Run all reading-queue tests**

Run: `cd client && pnpm exec vitest run src/features/reading-queue`
Expected: PASS (the two new component specs + existing composable specs).

- [ ] **Step 4: Run oxlint on the client (matches the pre-push gate)**

Run: `cd client && pnpm run lint:oxlint:check`
Expected: 0 errors. (The pre-push hook runs this; fixing here avoids a blocked push.)

- [ ] **Step 5: Commit**

```bash
git add client/src/views/UpNextView.vue
git commit -m "feat(reading-queue): navigate to book detail from Up Next"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Run the app and verify**

Run `pnpm dev` (Node 22). On `/up-next` with at least one queued book:

- Grid view: clicking a cover opens `/book/:id`; the 3-dot menu shows "View details" (opens detail) and "Remove from queue" (removes); dragging still reorders.
- List view: same behaviors on the row body and its 3-dot menu.
- Confirm the 3-dot menu opens without navigating, and removing an item still works.

---

## Notes for the implementer

- **Why stub the dropdown in tests:** reka-ui's `DropdownMenuContent` renders via a portal/teleport only when open, which is brittle in jsdom. Stubbing the four dropdown components to render their slots makes the menu items synchronously present and clickable; `@click` falls through to the stubbed `<button>` via `inheritAttrs`, exercising the real emit wiring.
- **Click vs. drag:** leaving `draggable="true"` on the outer item while putting `@click` on an inner region is intentional — HTML5 drag and `click` are distinct events, so a click opens and a drag reorders. Do not add manual mousedown/threshold logic.
- **No backend, no type, no router changes** beyond what's listed. The `book-detail` route already exists.
