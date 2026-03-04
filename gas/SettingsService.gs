// ===== Settings Service (Google Sheets Backend) =====

function getSetting(key, scopeType, scopeId) {
  var map = getSettingsMap(scopeType, scopeId);
  return map[key] !== undefined ? map[key] : null;
}

function getSettingsMap(scopeType, scopeId) {
  var records = getRecords("SETTINGS");
  var map = {};
  records.forEach(function(r) {
    if (String(r.scopeType) === String(scopeType) && String(r.scopeId) === String(scopeId)) {
      map[String(r.key)] = r.value;
    }
  });
  return map;
}

function upsertSetting(key, scopeType, scopeId, value) {
  var records = getRecords("SETTINGS");
  var found = false;
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (String(r.key) === String(key) && String(r.scopeType) === String(scopeType) && String(r.scopeId) === String(scopeId)) {
      r.value = value;
      r.updatedAt = nowIso();
      updateRow("SETTINGS", r._rowIndex, r);
      found = true;
      break;
    }
  }
  if (!found) {
    appendRecord("SETTINGS", {
      key: key,
      scopeType: scopeType,
      scopeId: scopeId,
      value: value,
      updatedAt: nowIso()
    });
  }
  return { success: true };
}
