// ===== Google Sheets Storage Layer =====
// ใช้ Google Sheets เป็น backend 100%

// ----- Spreadsheet Connection -----

var DEFAULT_SHEETS_ID = "1IFqwsST5j3IxYPQDX6mkFpp4ee7kmWVuvDz8CKnx1xg";

function getSheetsId() {
  var props = getProductProps();
  var storedId = props.getProperty("SHEETS_ID") || "";

  // Check container-bound context for Make a Copy auto-sync
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var containerBoundId = ss.getId();
      // If container is a non-default sheet and user hasn't explicitly set a different one
      if (containerBoundId !== DEFAULT_SHEETS_ID) {
        if (!storedId || storedId === DEFAULT_SHEETS_ID) {
          // Auto-sync: Make a Copy scenario — container changed but stored is still default
          props.setProperty("SHEETS_ID", containerBoundId);
          return containerBoundId;
        }
      }
    }
  } catch(e) { /* not in spreadsheet context (e.g. web app) */ }

  // Use stored ID if user explicitly set one
  if (storedId) return storedId;

  return DEFAULT_SHEETS_ID;
}

function setSheetsId(sheetsId) {
  var props = getProductProps();
  props.setProperty("SHEETS_ID", sheetsId);
}

function isSheetsReady() {
  return !!getSheetsId();
}

function getSpreadsheet() {
  var id = getSheetsId();
  if (!id) return null;
  return SpreadsheetApp.openById(id);
}

// ----- Schema: ชื่อแท็บ + headers -----

var SCHEMA = {
  MASTER:     ["entityId","entityType","ownerKey","companyId","code","name","name2","taxId","phone","email","address","tags","status","isDeleted","json","createdAt","updatedAt"],
  DOCUMENTS:  ["docId","docType","ownerKey","companyId","customerId","docNo","docDate","dueDate","refDocNo","currency","subtotal","discountEnabled","discountType","discountValue","vatEnabled","vatRate","whtEnabled","whtRate","totalBeforeTax","vatAmount","whtAmount","grandTotal","paymentStatus","docStatus","notes","terms","signatureEnabled","pdfFileId","isDeleted","json","createdAt","updatedAt"],
  DOC_LINES:  ["lineId","docId","lineNo","productId","code","name","description","qty","unit","unitPrice","discountType","discountValue","lineTotal","json","createdAt","updatedAt"],
  SETTINGS:   ["key","scopeType","scopeId","value","updatedAt"],
  EVENTS:     ["eventId","ownerKey","companyId","eventType","refType","refId","userEmail","amount","fromStatus","toStatus","note","json","createdAt"],
  FILES:      ["fileId","ownerKey","companyId","refType","refId","mimeType","name","size","url","isDeleted","createdAt","updatedAt"]
};

// ----- Auto-create tabs + headers -----

function ensureSchema(targetId) {
  var id = targetId || getSheetsId();
  if (!id) return false;
  try {
    var ss = SpreadsheetApp.openById(id);
    var sheetNames = ss.getSheets().map(function(s) { return s.getName(); });
    Object.keys(SCHEMA).forEach(function(tabName) {
      var sheet;
      if (sheetNames.indexOf(tabName) === -1) {
        sheet = ss.insertSheet(tabName);
      } else {
        sheet = ss.getSheetByName(tabName);
      }
      var expectedHeaders = SCHEMA[tabName];
      var lastCol = sheet.getLastColumn();
      var lastRow = sheet.getLastRow();

      // Empty sheet → write headers
      if (lastCol === 0 || (lastCol === 1 && sheet.getRange(1,1).getValue() === "")) {
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        return;
      }

      // Sheet has headers → check if they match SCHEMA
      var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
      var headersMatch = currentHeaders.length === expectedHeaders.length &&
        expectedHeaders.every(function(h, idx) { return currentHeaders[idx] === h; });
      if (headersMatch) return;

      // Headers mismatch → reorder data columns to match SCHEMA
      if (lastRow < 2) {
        // Only headers, no data → just overwrite headers
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        if (lastCol > expectedHeaders.length) {
          sheet.deleteColumns(expectedHeaders.length + 1, lastCol - expectedHeaders.length);
        }
        return;
      }

      // Has data → remap columns
      var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      var oldHeaders = allData[0].map(function(h) { return String(h).trim(); });
      var colMap = {};
      oldHeaders.forEach(function(h, idx) { colMap[h] = idx; });

      var newData = [expectedHeaders];
      for (var r = 1; r < allData.length; r++) {
        var newRow = expectedHeaders.map(function(h) {
          return colMap.hasOwnProperty(h) ? allData[r][colMap[h]] : "";
        });
        newData.push(newRow);
      }

      // Clear and rewrite
      sheet.clearContents();
      if (newData.length > 0 && newData[0].length > 0) {
        sheet.getRange(1, 1, newData.length, expectedHeaders.length).setValues(newData);
      }
    });
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    Logger.log("ensureSchema error: " + e.message);
    return false;
  }
}

// ----- Verify + Setup API (เรียกจาก UI) -----

function verifySheetsConnectionApi(sheetsId) {
  try {
    if (!sheetsId || sheetsId.length < 10) {
      return { success: false, error: "Sheets ID ไม่ถูกต้อง" };
    }
    var ss = SpreadsheetApp.openById(sheetsId);
    var sheetNames = ss.getSheets().map(function(s) { return s.getName(); });
    setSheetsId(sheetsId);
    return {
      success: true,
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      existingSheets: sheetNames
    };
  } catch (e) {
    return { success: false, error: "ไม่สามารถเข้าถึง Spreadsheet: " + e.message };
  }
}

function setupSheetsApi(sheetsId) {
  var verify = verifySheetsConnectionApi(sheetsId);
  if (!verify.success) return verify;
  var ok = ensureSchema(sheetsId);
  if (!ok) return { success: false, error: "ไม่สามารถสร้างแท็บได้" };

  // Reset migration flag so ownerKey migration runs for the new sheet's data
  var props = getProductProps();
  props.deleteProperty("OWNER_MIGRATED");
  var migration = null;
  try { migration = migrateOwnerKeyIfNeeded(); } catch(e) {
    Logger.log("setupSheetsApi migration error: " + e.message);
  }

  return { success: true, message: "เชื่อมต่อและสร้างโครงสร้างเรียบร้อย", migration: migration };
}

function getCurrentSheetsId() {
  return getSheetsId();
}

function getSheetsConnectionInfo() {
  var isContainerBound = false;
  var containerSheetId = null;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      isContainerBound = true;
      containerSheetId = ss.getId();
    }
  } catch(e) {}

  var props = getProductProps();
  var storedId = props.getProperty("SHEETS_ID") || "";

  // Auto-sync for Make a Copy: container changed to non-default, but stored is still default/empty
  if (containerSheetId && containerSheetId !== DEFAULT_SHEETS_ID) {
    if (!storedId || storedId === DEFAULT_SHEETS_ID) {
      props.setProperty("SHEETS_ID", containerSheetId);
      storedId = containerSheetId;
      // Ensure schema exists on the new copy
      try { ensureSchema(containerSheetId); } catch(e) {}
    }
  }

  // Determine active ID: stored (user-set) > container > default
  var activeId = storedId || containerSheetId || DEFAULT_SHEETS_ID;
  var isDefault = (activeId === DEFAULT_SHEETS_ID);

  return {
    isContainerBound: isContainerBound,
    isConnected: !isDefault || isContainerBound,
    isOwnSheet: !isDefault,
    sheetsId: activeId,
    needsSetup: isDefault && !isContainerBound
  };
}

// ----- OwnerKey Migration for Make a Copy -----

function migrateOwnerKeyIfNeeded() {
  var props = getProductProps();
  var currentOwnerKey = getOwnerKey();
  if (!currentOwnerKey || currentOwnerKey === "anonymous") {
    return { migrated: false, reason: "no_stable_key" };
  }

  // Check if already migrated with this exact stable key
  var migratedTo = props.getProperty("OWNER_MIGRATED") || "";
  if (migratedTo === currentOwnerKey) {
    return { migrated: false, reason: "already_done" };
  }

  var ss = getSpreadsheet();
  if (!ss) return { migrated: false, reason: "no_spreadsheet" };

  // Scan MASTER tab for any non-matching ownerKeys
  var masterSheet = ss.getSheetByName("MASTER");
  if (!masterSheet || masterSheet.getLastRow() < 2) {
    props.setProperty("OWNER_MIGRATED", currentOwnerKey);
    return { migrated: false, reason: "no_data" };
  }

  var masterData = masterSheet.getDataRange().getValues();
  var masterHeaders = masterData[0].map(function(h) { return String(h).trim(); });
  var ownerKeyCol = masterHeaders.indexOf("ownerKey");
  if (ownerKeyCol === -1) {
    props.setProperty("OWNER_MIGRATED", currentOwnerKey);
    return { migrated: false, reason: "no_ownerKey_column" };
  }

  // Count how many rows need migration
  var foreignKeys = {};
  var needsMigration = 0;
  for (var i = 1; i < masterData.length; i++) {
    var ok = String(masterData[i][ownerKeyCol]).trim();
    if (!ok) continue;
    if (ok !== currentOwnerKey) {
      needsMigration++;
      foreignKeys[ok] = (foreignKeys[ok] || 0) + 1;
    }
  }

  // All data already matches stable key
  if (needsMigration === 0) {
    props.setProperty("OWNER_MIGRATED", currentOwnerKey);
    return { migrated: false, reason: "all_data_matches" };
  }

  // Migrate ALL non-matching ownerKeys to the stable key
  var oldOwnerKeys = Object.keys(foreignKeys);
  var migratedCount = { MASTER: 0, DOCUMENTS: 0, EVENTS: 0, FILES: 0, SETTINGS: 0 };

  var tabsWithOwnerKey = ["MASTER", "DOCUMENTS", "EVENTS", "FILES"];
  tabsWithOwnerKey.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var col = headers.indexOf("ownerKey");
    if (col === -1) return;

    for (var r = 1; r < data.length; r++) {
      var val = String(data[r][col]).trim();
      if (val && val !== currentOwnerKey) {
        sheet.getRange(r + 1, col + 1).setValue(currentOwnerKey);
        migratedCount[tabName]++;
      }
    }
  });

  // Migrate SETTINGS: scopeId stores ownerKey
  var settingsSheet = ss.getSheetByName("SETTINGS");
  if (settingsSheet && settingsSheet.getLastRow() >= 2) {
    var settingsData = settingsSheet.getDataRange().getValues();
    var settingsHeaders = settingsData[0].map(function(h) { return String(h).trim(); });
    var scopeIdCol = settingsHeaders.indexOf("scopeId");
    if (scopeIdCol !== -1) {
      for (var s = 1; s < settingsData.length; s++) {
        var scopeVal = String(settingsData[s][scopeIdCol]).trim();
        if (scopeVal && scopeVal !== currentOwnerKey) {
          settingsSheet.getRange(s + 1, scopeIdCol + 1).setValue(currentOwnerKey);
          migratedCount.SETTINGS++;
        }
      }
    }
  }

  SpreadsheetApp.flush();

  // Migrate sequences in PropertiesService
  var allProps = props.getProperties();
  var seqMigrated = 0;
  oldOwnerKeys.forEach(function(oldKey) {
    Object.keys(allProps).forEach(function(propKey) {
      if (propKey.indexOf("seq." + oldKey + ".") === 0) {
        var newPropKey = propKey.replace("seq." + oldKey + ".", "seq." + currentOwnerKey + ".");
        props.setProperty(newPropKey, allProps[propKey]);
        props.deleteProperty(propKey);
        seqMigrated++;
      }
    });
  });

  // Clean up old fallback properties
  props.deleteProperty("OWNER_KEY_FALLBACK");

  props.setProperty("OWNER_MIGRATED", currentOwnerKey);

  return {
    migrated: true,
    fromKeys: oldOwnerKeys.map(function(k) { return k.substring(0, 12) + "..."; }),
    to: currentOwnerKey.substring(0, 12) + "...",
    counts: migratedCount,
    sequencesMigrated: seqMigrated
  };
}

// ----- Generic Read/Write -----

function getSheet(tabName) {
  var ss = getSpreadsheet();
  if (!ss) return null;
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    if (SCHEMA[tabName]) {
      sheet.getRange(1, 1, 1, SCHEMA[tabName].length).setValues([SCHEMA[tabName]]);
    }
  }
  return sheet;
}

function safeCellValue(val) {
  if (val instanceof Date) {
    return val.toISOString();
  }
  return val;
}

function getRecords(tabName) {
  var sheet = getSheet(tabName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var record = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      record[headers[c]] = safeCellValue(row[c]);
      if (String(row[c]).trim() !== "") hasData = true;
    }
    if (hasData) {
      record._rowIndex = i + 1;
      records.push(record);
    }
  }
  return records;
}

var TEXT_COLUMNS = {
  MASTER: ["code", "taxId", "phone"],
  DOCUMENTS: ["docNo", "refDocNo"]
};

function appendRecord(tabName, record) {
  var sheet = getSheet(tabName);
  if (!sheet) return record;
  var headers = SCHEMA[tabName];
  if (!headers) {
    var data = sheet.getDataRange().getValues();
    headers = data[0].map(function(h) { return String(h).trim(); });
  }
  var textCols = TEXT_COLUMNS[tabName] || [];
  var row = headers.map(function(h) {
    var val = record[h];
    if (val === undefined || val === null) return "";
    if (textCols.indexOf(h) >= 0) return String(val);
    return val;
  });
  var newRow = sheet.getLastRow() + 1;
  textCols.forEach(function(colName) {
    var idx = headers.indexOf(colName);
    if (idx >= 0) sheet.getRange(newRow, idx + 1).setNumberFormat('@');
  });
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
  return record;
}

function updateRow(tabName, rowIndex, record) {
  var sheet = getSheet(tabName);
  if (!sheet) return record;
  var headers = SCHEMA[tabName];
  if (!headers) {
    var data = sheet.getDataRange().getValues();
    headers = data[0].map(function(h) { return String(h).trim(); });
  }
  var textCols = TEXT_COLUMNS[tabName] || [];
  var row = headers.map(function(h) {
    var val = record[h];
    if (val === undefined || val === null) return "";
    if (textCols.indexOf(h) >= 0) return String(val);
    return val;
  });
  textCols.forEach(function(colName) {
    var idx = headers.indexOf(colName);
    if (idx >= 0) sheet.getRange(rowIndex, idx + 1).setNumberFormat('@');
  });
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  SpreadsheetApp.flush();
  return record;
}

function deleteRow(tabName, rowIndex) {
  var sheet = getSheet(tabName);
  if (!sheet) return;
  sheet.deleteRow(rowIndex);
}

// ----- CRUD Helpers (ใช้ idField เป็น key) -----

function findById(tabName, idField, id) {
  var records = getRecords(tabName);
  for (var i = 0; i < records.length; i++) {
    if (String(records[i][idField]) === String(id)) return records[i];
  }
  return null;
}

function upsertRecord(tabName, idField, record) {
  var records = getRecords(tabName);
  var id = String(record[idField]);
  for (var i = 0; i < records.length; i++) {
    if (String(records[i][idField]) === id) {
      updateRow(tabName, records[i]._rowIndex, record);
      return record;
    }
  }
  appendRecord(tabName, record);
  return record;
}

function deleteRecord(tabName, idField, id) {
  var records = getRecords(tabName);
  for (var i = 0; i < records.length; i++) {
    if (String(records[i][idField]) === String(id)) {
      deleteRow(tabName, records[i]._rowIndex);
      return true;
    }
  }
  return false;
}
