import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ReadingQueueItem } from '@bookorbit/types'

import UpNextGrid from '../UpNextGrid.vue'

const items = [
  { position: 1, book: { id: 7, title: 'A', authors: [], updatedAt: null } },
  { position: 2, book: { id: 3, title: 'B', authors: [], updatedAt: null } },
] as unknown as ReadingQueueItem[]

// Stub the dropdown primitives so menu items render synchronously (no teleport/portal).
const stubs = {
  BookCoverImage: true,
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuItem: { template: '<button v-bind="$attrs"><slot /></button>' },
}

function mountGrid() {
  return mount(UpNextGrid, { props: { items }, global: { stubs } })
}

describe('UpNextGrid', () => {
  it('emits open with the bookId when the cover region is clicked', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('[data-testid="upnext-open"]')[0].trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([7])
  })

  it('emits open from the "View details" menu item', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('[data-testid="upnext-view-details"]')[1].trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([3])
  })

  it('emits remove from the "Remove from queue" menu item', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('[data-testid="upnext-remove"]')[0].trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual([7])
  })

  it('clicking the menu trigger does not emit open', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('[data-testid="upnext-menu"]')[0].trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })
})
