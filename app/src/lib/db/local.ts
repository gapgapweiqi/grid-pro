/**
 * Dexie.js IndexedDB local database for offline-first caching.
 * Mirrors the StorageAdapter data model for local persistence.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { MasterEntity, DocumentHeader, DocLine } from '$lib/types';

export interface LocalSetting {
  key: string;
  value: string;
}

// ===== Dexie Database Definition =====

export class GridProDB extends Dexie {
  master!: EntityTable<MasterEntity, 'entityId'>;
  documents!: EntityTable<DocumentHeader, 'docId'>;
  docLines!: EntityTable<DocLine, 'lineId'>;
  settings!: EntityTable<LocalSetting, 'key'>;
  syncMeta!: EntityTable<SyncMeta, 'id'>;

  constructor() {
    super('gridpro');

    this.version(1).stores({
      master: 'entityId, entityType, companyId, [entityType+companyId], updatedAt',
      documents: 'docId, docType, companyId, [companyId+docType], [companyId+paymentStatus], updatedAt',
      docLines: 'lineId, docId',
      settings: '++id, &key',
      syncMeta: 'id'
    });
  }
}

export interface SyncMeta {
  id: string;
  lastSyncAt: string;
  version: number;
}

export const db = new GridProDB();

// ===== Helper Functions =====

/** Clear all local data (for logout or reset) */
export async function clearLocalDB() {
  await Promise.all([
    db.master.clear(),
    db.documents.clear(),
    db.docLines.clear(),
    db.settings.clear(),
    db.syncMeta.clear()
  ]);
}

/** Seed local DB from in-memory data (for initial offline cache) */
export async function seedLocalDB(data: {
  master: MasterEntity[];
  documents: DocumentHeader[];
  docLines: DocLine[];
}) {
  await db.transaction('rw', [db.master, db.documents, db.docLines], async () => {
    await db.master.bulkPut(data.master);
    await db.documents.bulkPut(data.documents);
    await db.docLines.bulkPut(data.docLines);
  });

  await db.syncMeta.put({
    id: 'last-sync',
    lastSyncAt: new Date().toISOString(),
    version: 1
  });
}

/** Get master entities by type and company */
export async function getLocalMaster<T extends MasterEntity>(
  entityType: string,
  companyId: string
): Promise<T[]> {
  const items = await db.master
    .where({ entityType, companyId })
    .filter((e) => !e.isDeleted)
    .toArray();
  return items as unknown as T[];
}

/** Get a single document with its lines */
export async function getLocalDocWithLines(docId: string) {
  const header = await db.documents.get(docId);
  if (!header) return null;
  const lines = await db.docLines.where('docId').equals(docId).toArray();
  return { header, lines };
}

/** Get documents by company */
export async function getLocalDocs(companyId: string, docType?: string) {
  let query = db.documents.where('companyId').equals(companyId);
  const items = await query.toArray();
  if (docType) return items.filter((d) => d.docType === docType && !d.isDeleted);
  return items.filter((d) => !d.isDeleted);
}

/** Check if local DB has data */
export async function hasLocalData(): Promise<boolean> {
  const count = await db.master.count();
  return count > 0;
}

/** Get last sync timestamp */
export async function getLastSyncTime(): Promise<string | null> {
  const meta = await db.syncMeta.get('last-sync');
  return meta?.lastSyncAt || null;
}
