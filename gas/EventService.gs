// ===== Event Service (Google Sheets Backend) =====

function logEvent(ownerKey, companyId, eventType, refType, refId, amount, fromStatus, toStatus, note) {
  var now = nowIso();
  var record = {
    eventId: Utilities.getUuid(),
    ownerKey: ownerKey,
    companyId: companyId || "",
    eventType: eventType || "",
    refType: refType || "",
    refId: refId || "",
    userEmail: getCurrentUserEmail(),
    amount: Number(amount) || 0,
    fromStatus: fromStatus || "",
    toStatus: toStatus || "",
    note: note || "",
    json: "{}",
    createdAt: now
  };
  appendRecord("EVENTS", record);
  return record;
}

function listEvents(companyId, refType, refId, limit) {
  var ownerKey = getOwnerKey();
  var events = getRecords("EVENTS");
  var filtered = events.filter(function(e) {
    if (String(e.ownerKey) !== String(ownerKey)) return false;
    if (companyId && String(e.companyId) !== String(companyId)) return false;
    if (refType && String(e.refType) !== String(refType)) return false;
    if (refId && String(e.refId) !== String(refId)) return false;
    return true;
  });
  filtered.sort(function(a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  return filtered.slice(0, limit || 50);
}
