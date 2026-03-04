/**
 * Sync engine — manages data flow between API service and IndexedDB.
 * Currently seeds IndexedDB from in-memory adapter on bootstrap.
 * Will later support incremental sync with remote backend.
 */
import { db, seedLocalDB, hasLocalData, getLastSyncTime } from '$lib/db/local';
import { memoryAdapter } from './memory-adapter';
import type { MasterEntity, DocumentHeader, DocLine } from '$lib/types';

/** Sync all data from the active adapter into IndexedDB (only if no local data yet) */
export async function syncToLocal(): Promise<void> {
  try {
    // Skip if IndexedDB already has data (mutations are persisted individually)
    const hasData = await hasLocalData();
    if (hasData) return;

    // Get all master data from in-memory store
    const masterTypes = ['COMPANY', 'CUSTOMER', 'PRODUCT', 'SALESPERSON'] as const;
    const allMaster: MasterEntity[] = [];

    for (const entityType of masterTypes) {
      const result = await memoryAdapter.masterList(entityType, { companyId: '' });
      if (result.ok) {
        allMaster.push(...result.data.items);
      }
    }

    // Get all documents
    const docResult = await memoryAdapter.docQuery({ companyId: '' });
    const allDocs: DocumentHeader[] = docResult.ok ? docResult.data.items : [];

    // Get all doc lines
    const allLines: DocLine[] = [];
    for (const doc of allDocs) {
      const docWithLines = await memoryAdapter.docGet(doc.docId);
      if (docWithLines.ok) {
        allLines.push(...docWithLines.data.lines);
      }
    }

    await seedLocalDB({
      master: allMaster,
      documents: allDocs,
      docLines: allLines
    });

    console.log(`[sync] Seeded IndexedDB: ${allMaster.length} master, ${allDocs.length} docs, ${allLines.length} lines`);
  } catch (err) {
    console.error('[sync] Failed to sync to IndexedDB:', err);
  }
}

/** Check if we need initial sync */
export async function checkAndSync(): Promise<void> {
  const hasData = await hasLocalData();
  if (!hasData) {
    await syncToLocal();
  }
}

/** Get sync status info */
export async function getSyncStatus() {
  const lastSync = await getLastSyncTime();
  const hasData = await hasLocalData();
  return { lastSync, hasData };
}
