// ===== Master Service (Google Sheets Backend) =====

function normalizeMasterRecord(record) {
  var n = {};
  Object.keys(record).forEach(function(k) { if (k !== "_rowIndex") n[k] = record[k]; });
  n.isDeleted = toBoolean(n.isDeleted);
  n.json = safeJsonParse(n.json, {});
  return n;
}

function listMasterByType(entityType, ownerKey, companyId) {
  var records = getRecords("MASTER");
  return records.filter(function(r) {
    if (String(r.entityType) !== entityType) return false;
    if (ownerKey && String(r.ownerKey) !== String(ownerKey)) return false;
    if (toBoolean(r.isDeleted)) return false;
    if (companyId && String(r.companyId) !== String(companyId)) return false;
    return true;
  }).map(normalizeMasterRecord);
}

function listCompanies(ownerKey) {
  return listMasterByType("COMPANY", ownerKey, null);
}

function listCustomers(ownerKey, companyId) {
  return listMasterByType("CUSTOMER", ownerKey, companyId);
}

function listProducts(ownerKey, companyId) {
  return listMasterByType("PRODUCT", ownerKey, companyId);
}

function listSalespersons(ownerKey, companyId) {
  return listMasterByType("SALESPERSON", ownerKey, companyId);
}

function findMasterRecordById(entityId, ownerKey) {
  var rec = findById("MASTER", "entityId", entityId);
  if (rec && ownerKey && String(rec.ownerKey) !== String(ownerKey)) return null;
  return rec;
}

function generateEntityCode(entityType, companyId, ownerKey) {
  var prefix = CODE_PREFIX[entityType] || entityType.substring(0, 2);
  var seqKey = entityType + "." + (companyId || "global");
  var next = getNextSequence(seqKey, ownerKey);
  return prefix + padNumber(next, CODE_PAD_LENGTH);
}

function upsertMasterEntity(entityType, payload) {
  var ownerKey = getOwnerKey();
  var now = nowIso();
  var entityId = payload.entityId || "";
  var companyId = payload.companyId || "";
  var existing = null;

  if (entityId) {
    existing = findById("MASTER", "entityId", entityId);
  }
  if (!existing && payload.code) {
    var allRecs = getRecords("MASTER");
    for (var i = 0; i < allRecs.length; i++) {
      var r = allRecs[i];
      if (String(r.entityType) === entityType && String(r.ownerKey) === String(ownerKey) && String(r.code) === String(payload.code) && !toBoolean(r.isDeleted)) {
        if (!companyId || String(r.companyId) === String(companyId)) {
          existing = r;
          entityId = r.entityId;
          break;
        }
      }
    }
  }
  if (!entityId) entityId = Utilities.getUuid();
  if (entityType === "COMPANY") companyId = entityId;

  var code = payload.code || (existing ? existing.code : "");
  if (!code) code = generateEntityCode(entityType, companyId, ownerKey);

  var record = {
    entityId: entityId,
    entityType: entityType,
    ownerKey: ownerKey,
    companyId: companyId,
    code: code,
    name: safeString(payload.name),
    name2: safeString(payload.name2),
    taxId: safeString(payload.taxId),
    phone: safeString(payload.phone),
    email: safeString(payload.email),
    address: safeString(payload.address),
    tags: safeString(payload.tags),
    status: payload.status || "ACTIVE",
    isDeleted: false,
    json: JSON.stringify(payload.json || (existing ? safeJsonParse(existing.json, {}) : {})),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  upsertRecord("MASTER", "entityId", record);
  return { isNew: !existing, record: normalizeMasterRecord(record) };
}

function hardDeleteEntities(entityType, ids) {
  var ownerKey = getOwnerKey();
  var records = getRecords("MASTER");
  var deleted = [];
  for (var i = records.length - 1; i >= 0; i--) {
    var r = records[i];
    if (String(r.entityType) === entityType && ids.indexOf(String(r.entityId)) !== -1 && String(r.ownerKey) === String(ownerKey)) {
      deleteRow("MASTER", r._rowIndex);
      deleted.push(String(r.entityId));
    }
  }
  return deleted;
}

function updateEntityJson(entityId, updates, entityType) {
  var rec = findById("MASTER", "entityId", entityId);
  if (!rec) throw new Error("Entity not found");
  var json = safeJsonParse(rec.json, {});
  Object.keys(updates).forEach(function(key) { json[key] = updates[key]; });
  rec.json = JSON.stringify(json);
  rec.updatedAt = nowIso();
  upsertRecord("MASTER", "entityId", rec);
  return json;
}

function upsertCompany(payload)     { return upsertMasterEntity("COMPANY", payload); }
function upsertCustomer(payload)    { return upsertMasterEntity("CUSTOMER", payload); }
function upsertProduct(payload)     { return upsertMasterEntity("PRODUCT", payload); }
function upsertSalesperson(payload) { return upsertMasterEntity("SALESPERSON", payload); }
