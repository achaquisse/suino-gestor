import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

// Persisted data is kept for a week so the app works offline after the last sync;
// queries must outlive it in memory or they'd be dropped before being written.
const MAX_AGE = 7 * 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: MAX_AGE, retry: 1, refetchOnWindowFocus: true, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
})

const persister = createAsyncStoragePersister({
  storage: { getItem: get<string>, setItem: set, removeItem: del },
  key: 'porkflow.cache',
  throttleTime: 2000,
})

// Signed storage URLs expire after an hour; never restore them from disk.
const NOT_PERSISTED = new Set(['animal-photo'])

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: MAX_AGE,
  // Bump when the shape of cached rows changes so old caches are discarded.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => q.state.status === 'success' && !NOT_PERSISTED.has(String(q.queryKey[0])),
  },
}

/** Drops every cached row, in memory and on disk (sign-out, expired session). */
export async function clearCache() {
  queryClient.clear()
  await persister.removeClient()
}
