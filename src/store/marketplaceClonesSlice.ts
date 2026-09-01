import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { ClonedEntryRecord, MarketplaceResource } from '@/features/marketplace/marketplace.types';

/**
 * Session-scoped "what has this session already cloned" tracker — see the
 * web app's `marketplaceClones.slice.ts`. There is no backend endpoint that
 * lists a workspace's skills (`GET /tenant-skills` does not exist), so
 * "already installed" for skills can only be known for entries THIS session
 * cloned; it resets on every app restart. Agents don't need this — they
 * recover "already installed" from `GET /agents`'s `clonedFromMarketplaceId`
 * on every load — but the same slice tracks both for one code path.
 *
 * Kept in Redux rather than component state because the "My skills" /
 * "Marketplace" toggle can mount and unmount the browse panel repeatedly;
 * component state would drop every "Saved" badge on a toggle switch.
 */
interface ResourceClonesState {
  cloned: Record<string, ClonedEntryRecord>;
  vanished: Record<string, true>;
}

type MarketplaceClonesState = Record<MarketplaceResource, ResourceClonesState>;

const emptyResource: ResourceClonesState = { cloned: {}, vanished: {} };

const initialState: MarketplaceClonesState = {
  skill: { ...emptyResource, cloned: {}, vanished: {} },
  agent: { ...emptyResource, cloned: {}, vanished: {} },
};

const marketplaceClonesSlice = createSlice({
  name: 'marketplaceClones',
  initialState,
  reducers: {
    entryCloned(
      state,
      action: PayloadAction<{ resource: MarketplaceResource; catalogueId: string; clone: ClonedEntryRecord }>,
    ) {
      state[action.payload.resource].cloned[action.payload.catalogueId] = action.payload.clone;
    },
    /** A clone attempt 404'd — the catalogue entry was deleted between
     * render and click. Removes the dead card from the list rather than
     * leaving a tile that invites a second click. */
    entryVanished(state, action: PayloadAction<{ resource: MarketplaceResource; catalogueId: string }>) {
      state[action.payload.resource].vanished[action.payload.catalogueId] = true;
    },
  },
});

export const { entryCloned, entryVanished } = marketplaceClonesSlice.actions;
export default marketplaceClonesSlice.reducer;

export function selectClonedEntries(resource: MarketplaceResource) {
  return (state: { marketplaceClones: MarketplaceClonesState }) => state.marketplaceClones[resource].cloned;
}

export function selectVanishedEntries(resource: MarketplaceResource) {
  return (state: { marketplaceClones: MarketplaceClonesState }) => state.marketplaceClones[resource].vanished;
}
