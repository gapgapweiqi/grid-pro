// ===== CSV Service (Google Sheets Backend) =====

function exportCsv(entityType, companyId) {
  var ownerKey = getOwnerKey();
  var records = listMasterByType(entityType, ownerKey, companyId);

  if (records.length === 0) return "";

  var fields = ["code", "name", "name2", "taxId", "phone", "email", "address", "tags", "status"];
  if (entityType === "PRODUCT") {
    fields = ["code", "name", "status"];
    if (records[0].json && records[0].json.unit !== undefined) fields.push("unit");
    if (records[0].json && records[0].json.price !== undefined) fields.push("price");
    if (records[0].json && records[0].json.category !== undefined) fields.push("category");
  }

  var header = fields.map(csvEscape).join(",");
  var rows = records.map(function(r) {
    var json = r.json || {};
    return fields.map(function(f) {
      var val = r[f] !== undefined ? r[f] : (json[f] !== undefined ? json[f] : "");
      return csvEscape(safeString(val));
    }).join(",");
  });

  return header + "\n" + rows.join("\n");
}

function importCsv(entityType, companyId, csvText, options) {
  if (!csvText) return { success: false, inserted: 0, updated: 0, errors: [{ row: 0, message: "No CSV data" }] };

  var lines = csvText.split("\n").filter(function(l) { return l.trim() !== ""; });
  if (lines.length < 2) return { success: false, inserted: 0, updated: 0, errors: [{ row: 0, message: "No data rows" }] };

  var headers = parseCsvLine(lines[0]);
  var inserted = 0;
  var updated = 0;
  var errors = [];

  for (var i = 1; i < lines.length; i++) {
    try {
      var values = parseCsvLine(lines[i]);
      var payload = {};
      var jsonFields = {};

      for (var c = 0; c < headers.length; c++) {
        var field = headers[c].trim().toLowerCase();
        var val = values[c] || "";
        if (["code", "name", "name2", "taxid", "phone", "email", "address", "tags", "status"].indexOf(field) !== -1) {
          payload[field === "taxid" ? "taxId" : field] = val;
        } else {
          jsonFields[field] = val;
        }
      }

      if (Object.keys(jsonFields).length > 0) payload.json = jsonFields;

      if (!payload.name) {
        errors.push({ row: i + 1, message: "ไม่มีชื่อ (name)" });
        continue;
      }

      var result = upsertMasterEntity(entityType, payload);
      if (result && result.isNew === false) {
        updated++;
      } else {
        inserted++;
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e.message });
    }
  }

  return { success: true, inserted: inserted, updated: updated, errors: errors };
}

function parseCsvLine(line) {
  var result = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
