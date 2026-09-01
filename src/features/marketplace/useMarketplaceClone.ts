import { useMemo, useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';

import { useGetAgentsQuery } from '@/features/company-agents/companyAgentsApi';
import { MARKETPLACE_PERMISSIONS } from '@/permissions/slugs';
import { usePermission } from '@/permissions/usePermission';
import { getErrorMessage } from '@/services/apiErrorMessage';
import type { ApiQueryError } from '@/store/baseQuery';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { entryCloned, entryVanished, selectClonedEntries, selectVanishedEntries } from '@/store/marketplaceClonesSlice';

import { CLONE_COPY } from './marketplaceRules';
import { useCloneAgentMutation, useCloneSkillMutation } from './marketplaceApi';
import type { ClonedEntryRecord, MarketplaceResource } from './marketplace.types';
import { useToast } from '@/components/ui';

/**
 * The clone/install action, shared by the browse grid and the entry detail
 * screen — ported from web's `useMarketplaceClone`. `pending` is per-card
 * (not one shared flag) so cloning one entry never disables another.
 */
export function useMarketplaceClone(resource: MarketplaceResource) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const canClone = usePermission(MARKETPLACE_PERMISSIONS.INSTALL);
  const cloned = useAppSelector(selectClonedEntries(resource));
  const vanished = useAppSelector(selectVanishedEntries(resource));
  const [cloneSkill] = useCloneSkillMutation();
  const [cloneAgent] = useCloneAgentMutation();

  // Agents recover "already installed" from GET /agents on every load —
  // skills have no equivalent endpoint, so `installedIds` stays empty for
  // them (see marketplace.types.ts's ClonedEntryRecord doc comment).
  const { data: agents } = useGetAgentsQuery(undefined, { skip: resource !== 'agent' });
  const installedIds = useMemo(() => {
    if (resource !== 'agent') return {};
    const ids: Record<string, true> = {};
    for (const agent of agents ?? []) {
      if (agent.clonedFromMarketplaceId) ids[agent.clonedFromMarketplaceId] = true;
    }
    return ids;
  }, [agents, resource]);

  const [pending, setPending] = useState<Record<string, true>>({});
  const copy = CLONE_COPY[resource];

  const cloneEntry = async (id: string, name: string) => {
    if (!canClone) {
      toast.show(copy.noPermission, { tone: 'warning' });
      return;
    }
    if (pending[id] || cloned[id] || installedIds[id]) return;

    setPending((p) => ({ ...p, [id]: true }));
    try {
      const saved = resource === 'skill' ? await cloneSkill(id).unwrap() : await cloneAgent(id).unwrap();
      const record: ClonedEntryRecord = { cloneId: saved.id, name, savedAt: saved.createdAt, origin: 'installed' };
      dispatch(entryCloned({ resource, catalogueId: id, clone: record }));
      toast.show(copy.success(name), { tone: 'success' });
    } catch (err) {
      const apiErr = err as ApiQueryError | SerializedError;
      if ('status' in apiErr && apiErr.status === 404) {
        dispatch(entryVanished({ resource, catalogueId: id }));
        toast.show(copy.vanished(name), { tone: 'error' });
      } else {
        toast.show(getErrorMessage(apiErr, copy.fallbackError), { tone: 'error' });
      }
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };

  return { canClone, cloneEntry, pending, cloned, vanished, installedIds };
}
