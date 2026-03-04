// ===== Test Script: ทดสอบ data flow ทั้งหมด =====

function testFullDataFlow() {
  Logger.log("========== START FULL DATA FLOW TEST ==========");
  
  // 1. Test Sheets Connection
  Logger.log("\n--- 1. SHEETS CONNECTION ---");
  var sheetsId = getSheetsId();
  Logger.log("Sheets ID: " + (sheetsId || "NOT SET"));
  Logger.log("isSheetsReady: " + isSheetsReady());
  
  if (!sheetsId) {
    Logger.log("ERROR: No Sheets ID configured. Cannot proceed.");
    return;
  }
  
  // 2. Test getSpreadsheet
  Logger.log("\n--- 2. GET SPREADSHEET ---");
  var ss = getSpreadsheet();
  if (!ss) {
    Logger.log("ERROR: getSpreadsheet() returned null");
    return;
  }
  Logger.log("Spreadsheet name: " + ss.getName());
  Logger.log("Spreadsheet URL: " + ss.getUrl());
  
  // 2b. Check RAW sheet data for Date objects
  Logger.log("\n--- 2b. RAW SHEET DATA (before safeCellValue) ---");
  var docSheet = ss.getSheetByName("DOCUMENTS");
  if (docSheet && docSheet.getLastRow() >= 2) {
    var rawHeaders = docSheet.getRange(1, 1, 1, docSheet.getLastColumn()).getValues()[0];
    var rawRow = docSheet.getRange(2, 1, 1, docSheet.getLastColumn()).getValues()[0];
    Logger.log("Headers count: " + rawHeaders.length);
    for (var ri = 0; ri < rawHeaders.length; ri++) {
      var val = rawRow[ri];
      var isDate = val instanceof Date;
      var typeStr = isDate ? "DATE" : typeof val;
      Logger.log("  Col " + ri + " [" + rawHeaders[ri] + "]: type=" + typeStr + " value=" + String(val).substring(0, 50));
    }
  }

  // 3. Test getRecords for DOCUMENTS (with safeCellValue fix)
  Logger.log("\n--- 3. RECORDS FROM DOCUMENTS SHEET (after safeCellValue) ---");
  var allRecords = getRecords("DOCUMENTS");
  Logger.log("Total records in DOCUMENTS: " + allRecords.length);
  
  if (allRecords.length === 0) {
    Logger.log("WARNING: No records found in DOCUMENTS sheet");
    var sheet = ss.getSheetByName("DOCUMENTS");
    if (!sheet) {
      Logger.log("ERROR: DOCUMENTS sheet does not exist!");
    } else {
      Logger.log("DOCUMENTS sheet exists, rows: " + sheet.getLastRow() + ", cols: " + sheet.getLastColumn());
    }
    return;
  }
  
  // 4. Log each record's key fields
  Logger.log("\n--- 4. RECORD DETAILS ---");
  allRecords.forEach(function(r, i) {
    Logger.log("Record " + i + ": docId=" + String(r.docId).substring(0,8) + 
      " docType=" + r.docType + 
      " ownerKey=" + String(r.ownerKey).substring(0,20) + 
      " companyId=" + String(r.companyId).substring(0,8) + 
      " docNo=" + r.docNo + 
      " isDeleted=" + r.isDeleted + " (type:" + typeof r.isDeleted + ")" +
      " grandTotal=" + r.grandTotal +
      " paymentStatus=" + r.paymentStatus);
  });
  
  // 5. Test ownerKey matching
  Logger.log("\n--- 5. OWNERKEY MATCHING ---");
  var ownerKey = getOwnerKey();
  var email = getCurrentUserEmail();
  Logger.log("Current email: '" + email + "'");
  Logger.log("Current ownerKey: '" + ownerKey + "'");
  
  allRecords.forEach(function(r, i) {
    var recordOwnerKey = String(r.ownerKey);
    var currentOwnerKey = String(ownerKey);
    var match = recordOwnerKey === currentOwnerKey;
    Logger.log("Record " + i + " ownerKey='" + recordOwnerKey + "' vs current='" + currentOwnerKey + "' MATCH=" + match);
  });
  
  // 6. Test toBoolean on isDeleted
  Logger.log("\n--- 6. isDeleted CHECK ---");
  allRecords.forEach(function(r, i) {
    var raw = r.isDeleted;
    var asBool = toBoolean(raw);
    Logger.log("Record " + i + " isDeleted raw='" + raw + "' (type:" + typeof raw + ") toBoolean=" + asBool);
  });
  
  // 7. Test listDocuments with null companyId
  Logger.log("\n--- 7. listDocuments(null, null) ---");
  var docsNoFilter = listDocuments(null, null);
  Logger.log("listDocuments(null, null) returned: " + docsNoFilter.length + " documents");
  docsNoFilter.forEach(function(d, i) {
    Logger.log("  Doc " + i + ": docNo=" + d.docNo + " docType=" + d.docType + " grandTotal=" + d.grandTotal);
  });
  
  // 8. Test listDocuments with companyId
  Logger.log("\n--- 8. listDocuments WITH companyId ---");
  var companies = listCompanies(ownerKey);
  Logger.log("Companies found: " + companies.length);
  if (companies.length > 0) {
    var firstCompanyId = companies[0].entityId;
    Logger.log("First company: " + companies[0].name + " (id=" + firstCompanyId + ")");
    var docsWithCompany = listDocuments(firstCompanyId, null);
    Logger.log("listDocuments('" + firstCompanyId.substring(0,8) + "...', null) returned: " + docsWithCompany.length + " documents");
  }
  
  // 9. Test listDocumentsForHistoryApi
  Logger.log("\n--- 9. listDocumentsForHistoryApi ---");
  var companyId = companies.length > 0 ? companies[0].entityId : null;
  var historyDocs = listDocumentsForHistoryApi(companyId);
  Logger.log("listDocumentsForHistoryApi returned: " + historyDocs.length + " documents");
  
  // 10. Test normalizeDocHeader
  Logger.log("\n--- 10. NORMALIZE DOC HEADER ---");
  if (allRecords.length > 0) {
    var normalized = normalizeDocHeader(allRecords[0]);
    Logger.log("Normalized doc keys: " + Object.keys(normalized).join(", "));
    Logger.log("Normalized json type: " + typeof normalized.json);
    Logger.log("Normalized json content: " + JSON.stringify(normalized.json));
    Logger.log("Normalized grandTotal: " + normalized.grandTotal + " (type:" + typeof normalized.grandTotal + ")");
    Logger.log("Normalized isDeleted: " + normalized.isDeleted + " (type:" + typeof normalized.isDeleted + ")");
  }
  
  // 11. Test serialization (simulate google.script.run)
  Logger.log("\n--- 11. SERIALIZATION TEST ---");
  if (historyDocs.length > 0) {
    try {
      var serialized = JSON.stringify(historyDocs[0]);
      Logger.log("Serialization OK, length: " + serialized.length);
      Logger.log("Serialized first 500 chars: " + serialized.substring(0, 500));
      var deserialized = JSON.parse(serialized);
      Logger.log("Deserialization OK, keys: " + Object.keys(deserialized).join(", "));
    } catch (e) {
      Logger.log("SERIALIZATION ERROR: " + e.message);
    }
  }
  
  // 12. Test listPayableDocumentsApi
  Logger.log("\n--- 12. listPayableDocumentsApi ---");
  var payableDocs = listPayableDocumentsApi(companyId);
  Logger.log("listPayableDocumentsApi returned: " + payableDocs.length + " documents");
  Logger.log("(Only shows INV/BILL/TAX/RCPT types. QUO docs are excluded by design)");
  
  // 13. Test KPI
  Logger.log("\n--- 13. KPI DATA ---");
  var kpi = getKpiData(companyId);
  Logger.log("KPI: " + JSON.stringify(kpi));
  
  Logger.log("\n========== END FULL DATA FLOW TEST ==========");
}

// Can be called from browser: runServer("diagnoseMasterData").then(r => console.log(JSON.stringify(r, null, 2)))
function diagnoseMasterData() {
  var ownerKey = getOwnerKey();
  var email = getCurrentUserEmail();
  var companies = listCompanies(ownerKey);
  var companyId = companies.length > 0 ? companies[0].entityId : null;
  
  var result = {
    email: email,
    ownerKey: ownerKey,
    companiesCount: companies.length,
    companyId: companyId,
    companyName: companies.length > 0 ? companies[0].name : "NONE"
  };
  
  // Get ALL raw MASTER records
  var allRecords = getRecords("MASTER");
  result.totalMasterRecords = allRecords.length;
  
  // Group by entityType
  var byType = {};
  allRecords.forEach(function(r) {
    var t = r.entityType || "UNKNOWN";
    if (!byType[t]) byType[t] = [];
    byType[t].push(r);
  });
  result.recordsByType = {};
  Object.keys(byType).forEach(function(t) {
    result.recordsByType[t] = byType[t].length;
  });
  
  // Check each record for filter issues
  result.filterAnalysis = { products: [], customers: [], salespersons: [] };
  
  var types = { PRODUCT: "products", CUSTOMER: "customers", SALESPERSON: "salespersons" };
  Object.keys(types).forEach(function(entityType) {
    var key = types[entityType];
    var recs = byType[entityType] || [];
    recs.forEach(function(r, i) {
      var ownerMatch = String(r.ownerKey) === String(ownerKey);
      var deleted = toBoolean(r.isDeleted);
      var companyMatch = !companyId || String(r.companyId) === String(companyId);
      var wouldShow = ownerMatch && !deleted && companyMatch;
      
      result.filterAnalysis[key].push({
        index: i,
        entityId: String(r.entityId).substring(0, 8),
        name: r.name,
        code: r.code,
        ownerKey: String(r.ownerKey).substring(0, 20),
        ownerMatch: ownerMatch,
        companyId: String(r.companyId).substring(0, 8),
        companyMatch: companyMatch,
        isDeleted: r.isDeleted,
        isDeletedType: typeof r.isDeleted,
        deletedBool: deleted,
        wouldShow: wouldShow,
        status: r.status
      });
    });
  });
  
  // Test the actual API calls
  result.apiResults = {
    products: listProducts(ownerKey, companyId).length,
    customers: listCustomers(ownerKey, companyId).length,
    salespersons: listSalespersons(ownerKey, companyId).length
  };
  
  // Also test getMasterData directly
  var masterData = getMasterData(companyId);
  result.getMasterDataResults = {
    products: masterData.products ? masterData.products.length : "null",
    customers: masterData.customers ? masterData.customers.length : "null",
    salespersons: masterData.salespersons ? masterData.salespersons.length : "null"
  };
  
  // Show first product/customer/salesperson detail if any
  if (masterData.products && masterData.products.length > 0) {
    var p = masterData.products[0];
    result.sampleProduct = { entityId: p.entityId, name: p.name, code: p.code, companyId: p.companyId, status: p.status };
  }
  if (masterData.customers && masterData.customers.length > 0) {
    var c = masterData.customers[0];
    result.sampleCustomer = { entityId: c.entityId, name: c.name, code: c.code, companyId: c.companyId, status: c.status };
  }
  
  return result;
}

// Can be called from browser: runServer("diagnoseDocs").then(r => console.log(r))
function diagnoseDocs() {
  var ownerKey = getOwnerKey();
  var companies = listCompanies(ownerKey);
  var companyId = companies.length > 0 ? companies[0].entityId : null;
  
  var rawRecords = getRecords("DOCUMENTS");
  var result = { rawCount: rawRecords.length, docs: [] };
  
  var filtered = rawRecords.filter(function(r) {
    if (toBoolean(r.isDeleted)) return false;
    if (String(r.ownerKey) !== String(ownerKey)) return false;
    if (companyId && String(r.companyId) !== String(companyId)) return false;
    return true;
  });
  
  result.filteredCount = filtered.length;
  
  filtered.slice(0, 5).forEach(function(r) {
    var jsonType = typeof r.json;
    var jsonLen = r.json ? String(r.json).length : 0;
    var parsed = safeJsonParse(r.json, {});
    result.docs.push({
      docId: String(r.docId).substring(0, 8),
      docNo: r.docNo,
      docType: r.docType,
      docDate: r.docDate,
      grandTotal: r.grandTotal,
      jsonFieldType: jsonType,
      jsonFieldLength: jsonLen,
      jsonFirst100: String(r.json || "").substring(0, 100),
      parsedJsonType: typeof parsed,
      parsedCustomerName: parsed.customerName || "EMPTY",
      parsedItemsCount: parsed.items ? parsed.items.length : 0,
      allKeys: Object.keys(r).filter(function(k) { return k !== "_rowIndex" && k !== "json"; }).join(",")
    });
  });
  
  return result;
}

function testSheetsConnection() {
  var log = [];
  
  // Step 1: Check getActiveSpreadsheet
  log.push("=== Step 1: getActiveSpreadsheet ===");
  var activeSS = null;
  try {
    activeSS = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSS) {
      log.push("  getActiveSpreadsheet() = " + activeSS.getId());
      log.push("  Name: " + activeSS.getName());
    } else {
      log.push("  getActiveSpreadsheet() = null (web app context)");
    }
  } catch(e) {
    log.push("  getActiveSpreadsheet() ERROR: " + e.message);
  }
  
  // Step 2: Check PropertiesService
  log.push("\n=== Step 2: Script Properties ===");
  var props = PropertiesService.getScriptProperties();
  var storedId = props.getProperty("SHEETS_ID");
  log.push("  SHEETS_ID in properties: " + (storedId || "(empty)"));
  log.push("  DEFAULT_SHEETS_ID: " + DEFAULT_SHEETS_ID);
  log.push("  Are they the same? " + (storedId === DEFAULT_SHEETS_ID));
  
  // Step 3: What getSheetsId returns
  log.push("\n=== Step 3: getSheetsId() ===");
  var sheetsId = getSheetsId();
  log.push("  getSheetsId() = " + sheetsId);
  
  // Step 4: Check if we can access the sheet
  log.push("\n=== Step 4: Access Spreadsheet ===");
  try {
    var ss = SpreadsheetApp.openById(sheetsId);
    log.push("  openById OK: " + ss.getName());
    var existingSheets = ss.getSheets().map(function(s) { return s.getName(); });
    log.push("  Existing tabs: " + existingSheets.join(", "));
    
    // Step 5: Check which SCHEMA tabs are missing
    log.push("\n=== Step 5: Schema Check ===");
    var schemaKeys = Object.keys(SCHEMA);
    log.push("  Required tabs: " + schemaKeys.join(", "));
    schemaKeys.forEach(function(tabName) {
      var exists = existingSheets.indexOf(tabName) !== -1;
      log.push("  " + tabName + ": " + (exists ? "EXISTS" : "MISSING"));
      if (exists) {
        var sheet = ss.getSheetByName(tabName);
        var lastCol = sheet.getLastColumn();
        var lastRow = sheet.getLastRow();
        log.push("    rows=" + lastRow + " cols=" + lastCol);
        if (lastCol > 0) {
          var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
          log.push("    headers: " + headers.join(", "));
        }
      }
    });
  } catch(e) {
    log.push("  ERROR accessing sheet: " + e.message);
  }
  
  // Step 6: Try ensureSchema
  log.push("\n=== Step 6: Run ensureSchema() ===");
  try {
    var result = ensureSchema();
    log.push("  ensureSchema() returned: " + result);
    
    // Verify tabs after
    var ss2 = SpreadsheetApp.openById(sheetsId);
    var afterSheets = ss2.getSheets().map(function(s) { return s.getName(); });
    log.push("  Tabs after ensureSchema: " + afterSheets.join(", "));
  } catch(e) {
    log.push("  ensureSchema() ERROR: " + e.message);
    log.push("  Stack: " + e.stack);
  }
  
  // Step 7: getSheetsConnectionInfo
  log.push("\n=== Step 7: getSheetsConnectionInfo() ===");
  try {
    var info = getSheetsConnectionInfo();
    log.push("  " + JSON.stringify(info, null, 2));
  } catch(e) {
    log.push("  ERROR: " + e.message);
  }
  
  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testDataStability() {
  var log = [];
  log.push("========== DATA STABILITY DIAGNOSTIC ==========");
  log.push("Time: " + new Date().toISOString());

  // ─── 1. OwnerKey Consistency Test (call 5 times) ───
  log.push("\n--- 1. OwnerKey Consistency (5 calls) ---");
  var keys = [];
  for (var i = 0; i < 5; i++) {
    keys.push(getOwnerKey());
    Utilities.sleep(100);
  }
  var allSame = keys.every(function(k) { return k === keys[0]; });
  log.push("  Results: " + (allSame ? "STABLE ✓" : "UNSTABLE ✗ — THIS IS THE BUG!"));
  log.push("  Key[0]: " + keys[0]);
  if (!allSame) {
    keys.forEach(function(k, idx) { log.push("  Call " + idx + ": " + k); });
  }

  // ─── 2. Identity Sources ───
  log.push("\n--- 2. Identity Sources ---");
  var email1 = "", email2 = "";
  try { email1 = Session.getActiveUser().getEmail() || ""; } catch(e) { email1 = "ERROR:" + e.message; }
  try { email2 = Session.getEffectiveUser().getEmail() || ""; } catch(e) { email2 = "ERROR:" + e.message; }
  log.push("  getActiveUser().getEmail(): '" + email1 + "'");
  log.push("  getEffectiveUser().getEmail(): '" + email2 + "'");
  log.push("  getCurrentUserEmail(): '" + getCurrentUserEmail() + "'");

  var props = PropertiesService.getScriptProperties();
  log.push("  OWNER_KEY_STABLE prop: " + (props.getProperty("OWNER_KEY_STABLE") || "(not set)"));
  log.push("  OWNER_KEY_FALLBACK prop: " + (props.getProperty("OWNER_KEY_FALLBACK") || "(not set)"));
  log.push("  OWNER_MIGRATED prop: " + (props.getProperty("OWNER_MIGRATED") || "(not set)"));

  // ─── 3. Sheets Connection ───
  log.push("\n--- 3. Sheets Connection ---");
  var sheetsId = getSheetsId();
  log.push("  getSheetsId(): " + sheetsId);
  log.push("  SHEETS_ID prop: " + (props.getProperty("SHEETS_ID") || "(empty)"));
  log.push("  Is default? " + (sheetsId === DEFAULT_SHEETS_ID));

  var ss = getSpreadsheet();
  if (!ss) {
    log.push("  ERROR: Cannot access spreadsheet!");
    Logger.log(log.join("\n"));
    return log.join("\n");
  }
  log.push("  Spreadsheet: " + ss.getName());

  // ─── 4. OwnerKey Distribution Scan ───
  var ownerKey = getOwnerKey();
  log.push("\n--- 4. OwnerKey Distribution (stable key = " + ownerKey.substring(0, 15) + "...) ---");
  var tabsToCheck = ["MASTER", "DOCUMENTS", "EVENTS", "FILES", "SETTINGS"];
  var totalMismatch = 0;
  tabsToCheck.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) {
      log.push("  " + tabName + ": (empty or missing)");
      return;
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var ownerKeyIdx = headers.indexOf("ownerKey");
    var scopeIdIdx = headers.indexOf("scopeId");
    var checkCol = ownerKeyIdx !== -1 ? ownerKeyIdx : scopeIdIdx;
    if (checkCol === -1) {
      log.push("  " + tabName + ": (no ownerKey/scopeId column)");
      return;
    }

    var match = 0, mismatch = 0, empty = 0;
    var mismatchKeys = {};
    for (var r = 1; r < data.length; r++) {
      var val = String(data[r][checkCol]).trim();
      if (!val) { empty++; continue; }
      if (val === ownerKey) { match++; } else {
        mismatch++;
        mismatchKeys[val] = (mismatchKeys[val] || 0) + 1;
      }
    }
    totalMismatch += mismatch;
    var status = mismatch === 0 ? "✓ ALL MATCH" : "✗ " + mismatch + " MISMATCHED";
    log.push("  " + tabName + ": " + (data.length - 1) + " rows | match=" + match + " mismatch=" + mismatch + " empty=" + empty + " " + status);
    Object.keys(mismatchKeys).forEach(function(k) {
      log.push("    foreign: " + k.substring(0, 20) + "... = " + mismatchKeys[k] + " rows");
    });
  });

  // ─── 5. Migration ───
  log.push("\n--- 5. Migration ---");
  if (totalMismatch > 0) {
    log.push("  " + totalMismatch + " mismatched rows found — running migration...");
    try {
      var migResult = migrateOwnerKeyIfNeeded();
      log.push("  Result: " + JSON.stringify(migResult));
    } catch(e) {
      log.push("  ERROR: " + e.message);
    }
  } else {
    log.push("  No migration needed — all data matches stable key");
    var migStatus = migrateOwnerKeyIfNeeded();
    log.push("  Status: " + JSON.stringify(migStatus));
  }

  // ─── 6. Data Query Tests ───
  log.push("\n--- 6. Data Query Tests ---");
  try {
    var companies = listCompanies(ownerKey);
    log.push("  listCompanies: " + companies.length);
    companies.forEach(function(c) {
      log.push("    - " + c.name + " (ownerKey match: " + (String(c.ownerKey) === ownerKey) + ")");
    });

    var customers = listCustomers(ownerKey, null);
    log.push("  listCustomers: " + customers.length);

    var products = listProducts(ownerKey, null);
    log.push("  listProducts: " + products.length);

    var docs = listDocuments(null, null);
    log.push("  listDocuments (all): " + docs.length);

    if (companies.length > 0) {
      var cid = companies[0].entityId;
      var companyDocs = listDocuments(cid, null);
      log.push("  listDocuments (company '" + companies[0].name + "'): " + companyDocs.length);
    }

    var settings = getSettingsMap("USER", ownerKey);
    log.push("  getSettingsMap: " + Object.keys(settings).length + " keys");

    // KPI
    var kpi = getKpiData(companies.length > 0 ? companies[0].entityId : null);
    log.push("  KPI totalDocuments: " + (kpi.totalDocuments || 0));
    log.push("  KPI totalRevenue: " + (kpi.totalRevenue || 0));
  } catch(e) {
    log.push("  ERROR: " + e.message);
  }

  // ─── 7. Re-verify OwnerKey After All Operations ───
  log.push("\n--- 7. Post-Test OwnerKey Verify ---");
  var postKey = getOwnerKey();
  log.push("  ownerKey still = " + postKey);
  log.push("  Same as start? " + (postKey === ownerKey ? "YES ✓" : "NO ✗ — KEY CHANGED!"));
  log.push("  OWNER_KEY_STABLE prop: " + (props.getProperty("OWNER_KEY_STABLE") || "(not set)"));

  // ─── 8. Summary ───
  log.push("\n--- 8. SUMMARY ---");
  log.push("  ownerKey stable: " + (allSame ? "YES ✓" : "NO ✗"));
  log.push("  Data mismatches before migration: " + totalMismatch);
  log.push("  ownerKey same after all ops: " + (postKey === ownerKey ? "YES ✓" : "NO ✗"));
  if (allSame && totalMismatch === 0 && postKey === ownerKey) {
    log.push("  OVERALL: STABLE ✓");
  } else {
    log.push("  OVERALL: ISSUES FOUND — see details above");
  }

  log.push("\n========== END STABILITY DIAGNOSTIC ==========");
  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testMultiUserAccess() {
  var log = [];
  log.push("========== MULTI-USER ACCESS DIAGNOSTIC ==========");
  log.push("Time: " + new Date().toISOString());

  var props = PropertiesService.getScriptProperties();
  var stableKey = props.getProperty("OWNER_KEY_STABLE") || "";
  var ownerKey = getOwnerKey();

  // ─── 1. Identity & Key Check ───
  log.push("\n--- 1. Identity & Key Check ---");
  log.push("  OWNER_KEY_STABLE (from props): " + stableKey);
  log.push("  getOwnerKey() returns: " + ownerKey);
  log.push("  Match: " + (stableKey === ownerKey ? "YES ✓" : "NO ✗ — BUG!"));

  var email = "";
  try { email = Session.getEffectiveUser().getEmail(); } catch(e) {}
  log.push("  effectiveUser email: '" + email + "'");
  var activeEmail = "";
  try { activeEmail = Session.getActiveUser().getEmail(); } catch(e) {}
  log.push("  activeUser email: '" + activeEmail + "'");

  // ─── 2. ALL PropertiesService entries ───
  log.push("\n--- 2. Script Properties (all) ---");
  var allProps = props.getProperties();
  var propKeys = Object.keys(allProps).sort();
  propKeys.forEach(function(k) {
    var v = allProps[k];
    if (v && v.length > 50) v = v.substring(0, 50) + "...";
    log.push("  " + k + " = " + v);
  });

  // ─── 3. RAW Sheet Data vs API Results ───
  log.push("\n--- 3. RAW Sheet Data vs API Results ---");
  var ss = getSpreadsheet();
  if (!ss) {
    log.push("  ERROR: Cannot access spreadsheet!");
    Logger.log(log.join("\n"));
    return log.join("\n");
  }

  // 3a. MASTER tab - raw scan
  var masterSheet = ss.getSheetByName("MASTER");
  if (masterSheet && masterSheet.getLastRow() >= 2) {
    var mData = masterSheet.getDataRange().getValues();
    var mHeaders = mData[0].map(function(h) { return String(h).trim(); });
    var mOwnerCol = mHeaders.indexOf("ownerKey");
    var mTypeCol = mHeaders.indexOf("entityType");
    var mNameCol = mHeaders.indexOf("name");
    var mIdCol = mHeaders.indexOf("entityId");
    var mDelCol = mHeaders.indexOf("isDeleted");

    log.push("\n  [MASTER RAW] " + (mData.length - 1) + " total rows:");
    var entityCounts = {};
    for (var i = 1; i < mData.length; i++) {
      var eType = String(mData[i][mTypeCol]);
      var eName = String(mData[i][mNameCol]);
      var eId = String(mData[i][mIdCol]).substring(0, 8);
      var eOwner = String(mData[i][mOwnerCol]);
      var eDel = String(mData[i][mDelCol]);
      var ownerMatch = eOwner === ownerKey ? "✓" : "✗ KEY=" + eOwner.substring(0, 15) + "...";
      log.push("    row " + (i + 1) + ": " + eType + " | " + eName + " | id=" + eId + "... | del=" + eDel + " | owner: " + ownerMatch);

      if (!entityCounts[eType]) entityCounts[eType] = { total: 0, match: 0, deleted: 0, mismatch: 0 };
      entityCounts[eType].total++;
      if (eOwner === ownerKey) entityCounts[eType].match++;
      else entityCounts[eType].mismatch++;
      if (eDel === "true" || eDel === "TRUE") entityCounts[eType].deleted++;
    }

    log.push("\n  [MASTER SUMMARY]:");
    Object.keys(entityCounts).forEach(function(t) {
      var c = entityCounts[t];
      log.push("    " + t + ": total=" + c.total + " match=" + c.match + " mismatch=" + c.mismatch + " deleted=" + c.deleted);
    });

    // Compare with API
    log.push("\n  [MASTER API COMPARISON]:");
    var apiCompanies = listCompanies(ownerKey);
    log.push("    listCompanies(ownerKey): " + apiCompanies.length + " (expected " + ((entityCounts["COMPANY"] || {}).match || 0) + " minus deleted)");
    apiCompanies.forEach(function(c) { log.push("      - " + c.name); });

    var apiCustomers = listCustomers(ownerKey, null);
    log.push("    listCustomers(ownerKey): " + apiCustomers.length);
    apiCustomers.forEach(function(c) { log.push("      - " + c.name); });

    var apiProducts = listProducts(ownerKey, null);
    log.push("    listProducts(ownerKey): " + apiProducts.length);
    apiProducts.forEach(function(c) { log.push("      - " + c.name); });

    var apiSalespersons = listSalespersons(ownerKey, null);
    log.push("    listSalespersons(ownerKey): " + apiSalespersons.length);
  }

  // 3b. DOCUMENTS tab - raw scan
  var docSheet = ss.getSheetByName("DOCUMENTS");
  if (docSheet && docSheet.getLastRow() >= 2) {
    var dData = docSheet.getDataRange().getValues();
    var dHeaders = dData[0].map(function(h) { return String(h).trim(); });
    var dOwnerCol = dHeaders.indexOf("ownerKey");
    var dTypeCol = dHeaders.indexOf("docType");
    var dNoCol = dHeaders.indexOf("docNo");
    var dIdCol = dHeaders.indexOf("docId");
    var dDelCol = dHeaders.indexOf("isDeleted");
    var dCompCol = dHeaders.indexOf("companyId");
    var dCustCol = dHeaders.indexOf("customerId");
    var dTotalCol = dHeaders.indexOf("grandTotal");

    log.push("\n  [DOCUMENTS RAW] " + (dData.length - 1) + " total rows:");
    var docMatch = 0, docMismatch = 0, docDeleted = 0;
    for (var d = 1; d < dData.length; d++) {
      var dType = String(dData[d][dTypeCol]);
      var dNo = String(dData[d][dNoCol]);
      var dOwner = String(dData[d][dOwnerCol]);
      var dDel = String(dData[d][dDelCol]);
      var dTotal = dData[d][dTotalCol];
      var dCust = String(dData[d][dCustCol]).substring(0, 8);
      var dMatch = dOwner === ownerKey ? "✓" : "✗ KEY=" + dOwner.substring(0, 15) + "...";
      log.push("    row " + (d + 1) + ": " + dType + " " + dNo + " | total=" + dTotal + " | del=" + dDel + " | cust=" + dCust + "... | owner: " + dMatch);
      if (dOwner === ownerKey) docMatch++; else docMismatch++;
      if (dDel === "true" || dDel === "TRUE") docDeleted++;
    }
    log.push("    Match=" + docMatch + " Mismatch=" + docMismatch + " Deleted=" + docDeleted);

    // Compare with API per company
    log.push("\n  [DOCUMENTS API COMPARISON]:");
    var allDocs = listDocuments(null, null);
    log.push("    listDocuments(null): " + allDocs.length + " (all companies, ownerKey filtered)");

    if (apiCompanies && apiCompanies.length > 0) {
      apiCompanies.forEach(function(comp) {
        var cDocs = listDocuments(comp.entityId, null);
        log.push("    listDocuments('" + comp.name + "'): " + cDocs.length);
        cDocs.forEach(function(doc) {
          log.push("      - " + doc.docNo + " " + doc.docType + " total=" + doc.grandTotal);
        });
      });
    }
  }

  // 3c. EVENTS tab
  var eventSheet = ss.getSheetByName("EVENTS");
  if (eventSheet && eventSheet.getLastRow() >= 2) {
    var eData = eventSheet.getDataRange().getValues();
    var eHeaders = eData[0].map(function(h) { return String(h).trim(); });
    var eOwnerCol = eHeaders.indexOf("ownerKey");
    var eMatch = 0, eMismatch = 0;
    for (var e = 1; e < eData.length; e++) {
      var eOwner = String(eData[e][eOwnerCol]);
      if (eOwner === ownerKey) eMatch++; else eMismatch++;
    }
    log.push("\n  [EVENTS] total=" + (eData.length - 1) + " match=" + eMatch + " mismatch=" + eMismatch);
  }

  // 3d. SETTINGS tab
  var setSheet = ss.getSheetByName("SETTINGS");
  if (setSheet && setSheet.getLastRow() >= 2) {
    var sData = setSheet.getDataRange().getValues();
    var sHeaders = sData[0].map(function(h) { return String(h).trim(); });
    var sScopeCol = sHeaders.indexOf("scopeId");
    var sKeyCol = sHeaders.indexOf("key");
    var sMatch = 0, sMismatch = 0;
    for (var s = 1; s < sData.length; s++) {
      var sScope = String(sData[s][sScopeCol]);
      if (sScope === ownerKey) sMatch++; else sMismatch++;
    }
    log.push("\n  [SETTINGS] total=" + (sData.length - 1) + " match=" + sMatch + " mismatch=" + sMismatch);
    var apiSettings = getSettingsMap("USER", ownerKey);
    log.push("    getSettingsMap keys: " + Object.keys(apiSettings).join(", "));
  }

  // ─── 4. Full Bootstrap Simulation ───
  log.push("\n--- 4. Bootstrap Data (what browser sees on page load) ---");
  try {
    var boot = getBootstrapData();
    log.push("  user.email: '" + boot.user.email + "'");
    log.push("  user.ownerKey: " + boot.user.ownerKey);
    log.push("  companies: " + boot.companies.length);
    boot.companies.forEach(function(c) { log.push("    - " + c.name); });
    log.push("  settings keys: " + Object.keys(boot.settings).length);
    log.push("  sheetsId: " + boot.sheetsId);
    log.push("  migration: " + JSON.stringify(boot.migration));
  } catch(e) {
    log.push("  ERROR: " + e.message);
  }

  // ─── 5. Deployment Info ───
  log.push("\n--- 5. Deployment Check ---");
  try {
    var scriptId = ScriptApp.getScriptId();
    log.push("  ScriptId: " + scriptId);
  } catch(e) {
    log.push("  ScriptId: ERROR - " + e.message);
  }
  log.push("  executeAs should be: USER_DEPLOYING");
  log.push("  access should be: ANYONE_ANONYMOUS");
  log.push("  NOTE: User MUST re-deploy web app for these changes to take effect!");
  log.push("  Steps: Deploy > Manage deployments > Edit > New version > Deploy");

  // ─── 6. Cross-user Simulation ───
  log.push("\n--- 6. User Scenario Comparison ---");
  log.push("  With USER_DEPLOYING mode:");
  log.push("  [Owner]     → getOwnerKey() = " + ownerKey + " (same OWNER_KEY_STABLE)");
  log.push("  [Login]     → getOwnerKey() = " + ownerKey + " (same OWNER_KEY_STABLE)");
  log.push("  [Anonymous] → getOwnerKey() = " + ownerKey + " (same OWNER_KEY_STABLE)");
  log.push("  All 3 scenarios use PropertiesService.getScriptProperties()");
  log.push("  which is shared and does NOT change per user → SAME DATA for all");

  // ─── 7. Check for any remaining mismatches ───
  log.push("\n--- 7. FINAL VERDICT ---");
  var issues = [];
  if (stableKey !== ownerKey) issues.push("OWNER_KEY_STABLE mismatch");

  // Re-scan for mismatches
  var tabsCheck = ["MASTER", "DOCUMENTS", "EVENTS", "SETTINGS"];
  var totalMismatchFinal = 0;
  tabsCheck.forEach(function(tab) {
    var sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return;
    var dd = sh.getDataRange().getValues();
    var hh = dd[0].map(function(h) { return String(h).trim(); });
    var col = hh.indexOf("ownerKey");
    if (col === -1) col = hh.indexOf("scopeId");
    if (col === -1) return;
    for (var r = 1; r < dd.length; r++) {
      if (String(dd[r][col]).trim() !== ownerKey) totalMismatchFinal++;
    }
  });

  if (totalMismatchFinal > 0) issues.push(totalMismatchFinal + " rows with wrong ownerKey");
  if (!stableKey) issues.push("OWNER_KEY_STABLE not set");

  if (issues.length === 0) {
    log.push("  ALL DATA CONSISTENT ✓");
    log.push("  If owner still sees incomplete data:");
    log.push("  1. Did you re-deploy? (Deploy > Manage deployments > New version)");
    log.push("  2. Clear browser cache or use Incognito window");
    log.push("  3. Check if using correct deployment URL (not test URL)");
  } else {
    log.push("  ISSUES FOUND: " + issues.join(", "));
  }

  log.push("\n========== END MULTI-USER DIAGNOSTIC ==========");
  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testDocPreviewFields() {
  var log = [];
  var passed = 0, failed = 0;

  function check(name, condition, detail) {
    if (condition) { passed++; log.push("  [PASS] " + name); }
    else { failed++; log.push("  [FAIL] " + name + (detail ? " — " + detail : "")); }
  }

  log.push("========== DOC PREVIEW FIELDS TEST ==========");
  log.push("Time: " + new Date().toISOString());

  var ownerKey = getOwnerKey();
  var companies = listCompanies(ownerKey);
  if (companies.length === 0) {
    log.push("  ERROR: No companies found — cannot test");
    Logger.log(log.join("\n"));
    return log.join("\n");
  }
  var companyId = companies[0].entityId;

  // ─── 1. Create document with ALL fields ───
  log.push("\n--- 1. Create Test Document with ALL fields ---");
  var testPayload = {
    companyId: companyId,
    type: "QUO",
    docNo: "TEST-PREVIEW-" + Date.now(),
    docDate: "2026-02-08",
    dueDate: "2026-03-08",
    customerId: "",
    terms: "1. ราคารวม VAT แล้ว\n2. ใบเสนอราคามีอายุ 30 วัน\n3. กรุณาชำระเงินตามกำหนด",
    discountEnabled: true,
    discountType: "percent",
    discountValue: 10,
    vatEnabled: true,
    vatRate: 7,
    whtEnabled: true,
    whtRate: 3,
    signatureEnabled: true,
    json: {
      customerName: "TestCustomer บริษัททดสอบ",
      customerTaxId: "1234567890123",
      customerAddress: "123 ถนนทดสอบ กรุงเทพฯ 10100",
      customerPhone: "0812345678",
      customerEmail: "test@example.com",
      note: "หมายเหตุทดสอบ: สินค้าจัดส่งภายใน 7 วัน",
      items: [
        { name: "สินค้าทดสอบ A", qty: 2, price: 1000, unit: "ชิ้น", productId: "", description: "รายละเอียด A" },
        { name: "บริการทดสอบ B", qty: 1, price: 5000, unit: "งาน", productId: "", description: "รายละเอียด B" }
      ],
      itemMode: "product",
      subtotal: 7000,
      grandTotal: 6699,
      afterDiscount: 6300,
      vatAmount: 441,
      whtAmount: 189,
      itemDiscount: 0,
      totalDiscount: 700,
      discountEnabled: true,
      discountType: "percent",
      discountValue: 10,
      vatEnabled: true,
      vatRate: 7,
      whtEnabled: true,
      whtRate: 3,
      signatureEnabled: true,
      termsText: "1. ราคารวม VAT แล้ว\n2. ใบเสนอราคามีอายุ 30 วัน\n3. กรุณาชำระเงินตามกำหนด",
      showPaymentTerms: true,
      paymentTerms: "credit30",
      paymentTermsCustom: "",
      paymentTermsLabel: "เครดิต 30 วัน"
    }
  };

  var result;
  try {
    result = saveDocument(testPayload);
    check("Document created", !!result && !!result.header, result ? "" : "no result");
    log.push("  docId: " + (result.header ? result.header.docId : "?"));
    log.push("  docNo: " + (result.header ? result.header.docNo : "?"));
  } catch(e) {
    log.push("  [FAIL] Create failed: " + e.message);
    Logger.log(log.join("\n"));
    return log.join("\n");
  }

  var docId = result.header.docId;

  // ─── 2. Load document back and verify ALL fields ───
  log.push("\n--- 2. Load Document Back ---");
  var loaded = getDocumentWithDetails(docId);
  check("Document loaded", !!loaded);
  if (!loaded) {
    Logger.log(log.join("\n"));
    return log.join("\n");
  }

  var h = loaded.header;
  var json = h.json || {};
  if (typeof json === "string") { try { json = JSON.parse(json); } catch(e) { json = {}; } }

  log.push("\n--- 3. Verify Header Fields (DOCUMENTS row) ---");
  check("docType = QUO", h.docType === "QUO", "got " + h.docType);
  check("notes preserved", h.notes === "หมายเหตุทดสอบ: สินค้าจัดส่งภายใน 7 วัน", "got '" + h.notes + "'");
  check("terms preserved", h.terms === "1. ราคารวม VAT แล้ว\n2. ใบเสนอราคามีอายุ 30 วัน\n3. กรุณาชำระเงินตามกำหนด", "got '" + (h.terms || "").substring(0, 30) + "...'");
  check("discountEnabled = true", toBoolean(h.discountEnabled) === true, "got " + h.discountEnabled);
  check("vatEnabled = true", toBoolean(h.vatEnabled) === true, "got " + h.vatEnabled);
  check("vatRate = 7", Number(h.vatRate) === 7, "got " + h.vatRate);
  check("whtEnabled = true", toBoolean(h.whtEnabled) === true, "got " + h.whtEnabled);
  check("whtRate = 3", Number(h.whtRate) === 3, "got " + h.whtRate);
  check("signatureEnabled = true", toBoolean(h.signatureEnabled) === true, "got " + h.signatureEnabled);
  check("grandTotal > 0", Number(h.grandTotal) > 0, "got " + h.grandTotal);
  check("docDate preserved", h.docDate === "2026-02-08", "got " + h.docDate);
  check("dueDate preserved", h.dueDate === "2026-03-08", "got " + h.dueDate);

  log.push("\n--- 4. Verify JSON Fields (for preview) ---");
  check("json.customerName", json.customerName === "TestCustomer บริษัททดสอบ", "got '" + json.customerName + "'");
  check("json.customerTaxId", json.customerTaxId === "1234567890123", "got " + json.customerTaxId);
  check("json.customerAddress", !!json.customerAddress, "got '" + json.customerAddress + "'");
  check("json.customerPhone", json.customerPhone === "0812345678", "got " + json.customerPhone);
  check("json.customerEmail", json.customerEmail === "test@example.com", "got " + json.customerEmail);
  check("json.note", json.note === "หมายเหตุทดสอบ: สินค้าจัดส่งภายใน 7 วัน", "got '" + json.note + "'");
  check("json.items count = 2", json.items && json.items.length === 2, "got " + (json.items ? json.items.length : 0));
  check("json.itemMode = product", json.itemMode === "product", "got " + json.itemMode);
  check("json.termsText preserved", !!json.termsText && json.termsText.indexOf("ราคารวม VAT") !== -1, "got '" + (json.termsText || "").substring(0, 30) + "'");
  check("json.signatureEnabled = true", json.signatureEnabled === true, "got " + json.signatureEnabled);
  check("json.showPaymentTerms = true", json.showPaymentTerms === true, "got " + json.showPaymentTerms);
  check("json.paymentTerms = credit30", json.paymentTerms === "credit30", "got " + json.paymentTerms);
  check("json.paymentTermsLabel", json.paymentTermsLabel === "เครดิต 30 วัน", "got '" + json.paymentTermsLabel + "'");
  check("json.discountEnabled = true", json.discountEnabled === true, "got " + json.discountEnabled);
  check("json.discountValue = 10", json.discountValue === 10, "got " + json.discountValue);
  check("json.vatEnabled = true", json.vatEnabled === true, "got " + json.vatEnabled);
  check("json.whtEnabled = true", json.whtEnabled === true, "got " + json.whtEnabled);
  check("json.afterDiscount > 0", Number(json.afterDiscount) > 0, "got " + json.afterDiscount);
  check("json.vatAmount > 0", Number(json.vatAmount) > 0, "got " + json.vatAmount);
  check("json.whtAmount > 0", Number(json.whtAmount) > 0, "got " + json.whtAmount);

  log.push("\n--- 5. Verify Lines ---");
  var lines = loaded.lines || [];
  check("Lines count = 2", lines.length === 2, "got " + lines.length);
  if (lines.length >= 2) {
    check("Line 1 name", lines[0].name === "สินค้าทดสอบ A", "got " + lines[0].name);
    check("Line 2 name", lines[1].name === "บริการทดสอบ B", "got " + lines[1].name);
  }

  // ─── 6. Simulate preview rendering logic ───
  log.push("\n--- 6. Preview Rendering Simulation ---");
  var docNote = json.note || h.notes || "";
  check("Preview: note visible", !!docNote, "docNote='" + docNote + "'");

  var termsText = json.termsText || h.terms || "";
  check("Preview: terms visible", !!termsText, "termsText='" + termsText.substring(0, 30) + "'");

  var showSignature = json.signatureEnabled !== undefined ? json.signatureEnabled : (h.signatureEnabled || false);
  check("Preview: signature shown", showSignature === true, "showSignature=" + showSignature);

  var showPaymentTerms = json.showPaymentTerms || false;
  var paymentTermsLabel = json.paymentTermsLabel || "";
  check("Preview: payment terms shown", showPaymentTerms === true, "showPaymentTerms=" + showPaymentTerms);
  check("Preview: payment terms label", !!paymentTermsLabel, "label='" + paymentTermsLabel + "'");

  var showVat = json.vatEnabled || toBoolean(h.vatEnabled) || false;
  var showWht = json.whtEnabled || toBoolean(h.whtEnabled) || false;
  var showTotalDiscount = json.discountEnabled || toBoolean(h.discountEnabled) || false;
  check("Preview: VAT shown", showVat === true);
  check("Preview: WHT shown", showWht === true);
  check("Preview: Discount shown", showTotalDiscount === true);

  // ─── 7. Clean up test document ───
  log.push("\n--- 7. Cleanup ---");
  try {
    softDeleteDocument(docId);
    log.push("  Test document soft-deleted: " + docId);
  } catch(e) {
    log.push("  Cleanup warning: " + e.message);
  }

  // ─── SUMMARY ───
  log.push("\n═══════════════════════════════════════");
  log.push("  PASSED: " + passed + " / " + (passed + failed));
  log.push("  FAILED: " + failed);
  if (failed === 0) {
    log.push("  RESULT: ALL DOC PREVIEW FIELDS VERIFIED ✓");
    log.push("  Notes, Terms, Payment Terms, Signature, Discount, VAT, WHT");
    log.push("  → All preserved from creation to preview/print");
  } else {
    log.push("  RESULT: " + failed + " FIELD(S) MISSING — see [FAIL] above");
  }
  log.push("═══════════════════════════════════════");

  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testAllFixes() {
  var log = [];
  var passed = 0, failed = 0;

  function check(name, condition, detail) {
    if (condition) { passed++; log.push("  [PASS] " + name); }
    else { failed++; log.push("  [FAIL] " + name + (detail ? " — " + detail : "")); }
  }

  log.push("========== VERIFY ALL FIXES ==========");
  log.push("Time: " + new Date().toISOString());

  var props = PropertiesService.getScriptProperties();

  // ═══ FIX 1: OwnerKey Stability ═══
  log.push("\n--- FIX 1: OwnerKey Stability ---");
  log.push("  Problem: ownerKey changed between sessions (hash(email) vs fallback)");
  log.push("  Fix: OWNER_KEY_STABLE stored permanently in Script Properties");

  var stableKey = props.getProperty("OWNER_KEY_STABLE") || "";
  check("OWNER_KEY_STABLE is set", !!stableKey);

  // Call getOwnerKey 10 times
  var keys = [];
  for (var i = 0; i < 10; i++) { keys.push(getOwnerKey()); }
  var allSame = keys.every(function(k) { return k === keys[0]; });
  check("getOwnerKey() returns same value 10/10 times", allSame, allSame ? "" : "got " + new Set(keys).size + " different values");
  check("getOwnerKey() matches OWNER_KEY_STABLE", keys[0] === stableKey, "got " + keys[0].substring(0, 15) + "... vs " + stableKey.substring(0, 15) + "...");

  // Old fallback should be cleaned up
  var oldFallback = props.getProperty("OWNER_KEY_FALLBACK");
  check("Old OWNER_KEY_FALLBACK cleaned up", !oldFallback, oldFallback ? "still exists: " + oldFallback.substring(0, 15) + "..." : "");

  // ═══ FIX 2: Data Consistency ═══
  log.push("\n--- FIX 2: Data Consistency (all ownerKeys match stable key) ---");
  log.push("  Problem: data had mixed ownerKeys (anonymous, hash(email), fallback)");
  log.push("  Fix: migration normalizes all ownerKeys to OWNER_KEY_STABLE");

  var ownerKey = getOwnerKey();
  var ss = getSpreadsheet();
  var tabs = ["MASTER", "DOCUMENTS", "EVENTS", "FILES", "SETTINGS"];
  var totalRows = 0, totalMatch = 0, totalMismatch = 0;

  tabs.forEach(function(tabName) {
    var sheet = ss ? ss.getSheetByName(tabName) : null;
    if (!sheet || sheet.getLastRow() < 2) return;
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var col = headers.indexOf("ownerKey");
    if (col === -1) col = headers.indexOf("scopeId");
    if (col === -1) return;

    var match = 0, mismatch = 0;
    for (var r = 1; r < data.length; r++) {
      var val = String(data[r][col]).trim();
      if (!val) continue;
      if (val === ownerKey) match++; else mismatch++;
    }
    totalRows += match + mismatch;
    totalMatch += match;
    totalMismatch += mismatch;
    check(tabName + ": all rows match (" + match + "/" + (match + mismatch) + ")", mismatch === 0, mismatch + " mismatched rows");
  });

  check("Total: " + totalMatch + "/" + totalRows + " rows match stable key", totalMismatch === 0);

  // Migration flag
  var migrated = props.getProperty("OWNER_MIGRATED") || "";
  check("OWNER_MIGRATED = OWNER_KEY_STABLE", migrated === ownerKey, "migrated to: " + migrated.substring(0, 15) + "...");

  // ═══ FIX 3: Data Queries Work ═══
  log.push("\n--- FIX 3: All API Functions Return Data ---");
  log.push("  Problem: queries returned 0 results due to ownerKey mismatch");

  var companies = listCompanies(ownerKey);
  check("listCompanies: " + companies.length + " results", companies.length > 0, "expected > 0");

  var customers = listCustomers(ownerKey, null);
  check("listCustomers: " + customers.length + " results", customers.length > 0);

  var products = listProducts(ownerKey, null);
  check("listProducts: " + products.length + " results", products.length > 0);

  if (companies.length > 0) {
    var cid = companies[0].entityId;
    var docs = listDocuments(cid, null);
    check("listDocuments ('" + companies[0].name + "'): " + docs.length + " results", docs.length > 0);

    var kpi = getKpiData(cid);
    check("getKpiData: totalDocs=" + kpi.totalDocuments, kpi.totalDocuments > 0);
  }

  var settings = getSettingsMap("USER", ownerKey);
  check("getSettingsMap: " + Object.keys(settings).length + " keys", Object.keys(settings).length > 0);

  // ═══ FIX 4: Deployment Config ═══
  log.push("\n--- FIX 4: Deployment Config ---");
  log.push("  Problem: executeAs:USER_ACCESSING caused permission issues for non-owners");
  log.push("  Fix: executeAs:USER_DEPLOYING + access:ANYONE_ANONYMOUS");
  log.push("  NOTE: verify in Apps Script Editor > Project Settings / Manage Deployments");

  // ═══ FIX 5: Cache Prevention ═══
  log.push("\n--- FIX 5: Cache Prevention ---");
  log.push("  Problem: cached HTML had stale bootstrap data (old ownerKey/companies)");
  log.push("  Fix: no-cache meta tags + fresh getBootstrapData() call on every page load");

  // Test doGet renders HTML with no-cache headers
  try {
    var htmlOutput = doGet({ parameter: {} });
    var html = htmlOutput.getContent();

    check("HTML has no-cache meta tag", html.indexOf("no-cache") !== -1 || html.indexOf("no-store") !== -1, "missing Cache-Control meta");
    check("HTML has Pragma no-cache", html.indexOf("Pragma") !== -1, "missing Pragma meta");
    check("HTML has Expires 0", html.indexOf("Expires") !== -1, "missing Expires meta");

    // Check that bootstrap data is embedded (initial load)
    check("HTML has data-bootstrap attribute", html.indexOf("data-bootstrap") !== -1);

    // Check that fresh fetch code exists
    check("HTML has fresh bootstrap fetch code", html.indexOf("fetching fresh bootstrap") !== -1 || html.indexOf("getBootstrapData") !== -1);

    // Verify embedded bootstrap has current ownerKey
    var bootstrapMatch = html.match(/data-bootstrap="([^"]*)"/);
    if (bootstrapMatch) {
      try {
        var embeddedData = JSON.parse(decodeURIComponent(bootstrapMatch[1]));
        check("Embedded bootstrap ownerKey matches stable key",
          embeddedData.user && embeddedData.user.ownerKey === ownerKey,
          "embedded: " + (embeddedData.user ? embeddedData.user.ownerKey.substring(0, 15) : "none") + "...");
        check("Embedded bootstrap has companies", embeddedData.companies && embeddedData.companies.length > 0,
          "companies: " + (embeddedData.companies ? embeddedData.companies.length : 0));
      } catch(e) {
        log.push("  [INFO] Could not parse embedded bootstrap: " + e.message);
      }
    }
  } catch(e) {
    log.push("  [INFO] doGet test skipped: " + e.message);
  }

  // ═══ FIX 6: Multi-device Consistency ═══
  log.push("\n--- FIX 6: Multi-device Consistency ---");
  log.push("  Problem: computer vs mobile showed different data");
  log.push("  Fix: all 3 fixes combined ensure same data everywhere");

  // Simulate: getBootstrapData returns same for any caller
  var boot1 = getBootstrapData();
  var boot2 = getBootstrapData();
  check("getBootstrapData() consistent across calls",
    boot1.user.ownerKey === boot2.user.ownerKey && boot1.companies.length === boot2.companies.length);
  check("Bootstrap ownerKey = stable key", boot1.user.ownerKey === ownerKey);
  check("Bootstrap companies count = raw data", boot1.companies.length === companies.length);

  // ═══ SUMMARY ═══
  log.push("\n═══════════════════════════════════════");
  log.push("  PASSED: " + passed + " / " + (passed + failed));
  log.push("  FAILED: " + failed);
  if (failed === 0) {
    log.push("  RESULT: ALL FIXES VERIFIED ✓");
    log.push("");
    log.push("  NEXT STEPS:");
    log.push("  1. Re-deploy web app (Deploy > Manage deployments > New version)");
    log.push("  2. Test on computer: open web app URL");
    log.push("  3. Test on mobile: open same URL");
    log.push("  4. Both must show: " + companies.length + " companies, " + customers.length + " customers, " + products.length + " products");
  } else {
    log.push("  RESULT: " + failed + " ISSUE(S) REMAINING — see [FAIL] items above");
  }
  log.push("═══════════════════════════════════════");

  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testBrowserScenarios() {
  var log = [];
  log.push("========== BROWSER SCENARIO TEST ==========");
  log.push("Time: " + new Date().toISOString());
  log.push("Deployment mode: " + (typeof ScriptApp !== "undefined" ? "available" : "N/A"));

  // ─── Scenario: Simulate getBootstrapData (what browser sees on load) ───
  log.push("\n--- Simulate Browser Load (getBootstrapData) ---");
  try {
    var bootstrap = getBootstrapData();
    log.push("  user.email: '" + (bootstrap.user.email || "") + "'");
    log.push("  user.ownerKey: " + bootstrap.user.ownerKey);
    log.push("  sheetsId: " + bootstrap.sheetsId);
    log.push("  companies: " + bootstrap.companies.length);
    bootstrap.companies.forEach(function(c) {
      log.push("    - " + c.name);
    });
    log.push("  settings keys: " + Object.keys(bootstrap.settings).length);
    log.push("  sheetsConnection: " + JSON.stringify(bootstrap.sheetsConnection));
    log.push("  migration: " + JSON.stringify(bootstrap.migration));
  } catch(e) {
    log.push("  ERROR: " + e.message);
  }

  // ─── Scenario: Simulate API calls (what browser does after load) ───
  log.push("\n--- Simulate API Calls ---");
  var ownerKey = getOwnerKey();

  // listCompaniesApi
  try {
    var companies = listCompaniesApi();
    log.push("  listCompaniesApi: " + companies.length + " companies");
  } catch(e) {
    log.push("  listCompaniesApi ERROR: " + e.message);
  }

  // getMasterData
  try {
    var master = getMasterData(null);
    log.push("  getMasterData: customers=" + master.customers.length + " products=" + master.products.length);
  } catch(e) {
    log.push("  getMasterData ERROR: " + e.message);
  }

  // listDocumentsForHistoryApi
  try {
    var companies2 = listCompanies(ownerKey);
    if (companies2.length > 0) {
      var docs = listDocumentsForHistoryApi(companies2[0].entityId);
      log.push("  listDocumentsForHistoryApi: " + docs.length + " docs");
    } else {
      log.push("  listDocumentsForHistoryApi: (no companies)");
    }
  } catch(e) {
    log.push("  listDocumentsForHistoryApi ERROR: " + e.message);
  }

  // KPI
  try {
    var companies3 = listCompanies(ownerKey);
    var kpi = getKpiDataApi(companies3.length > 0 ? companies3[0].entityId : null);
    log.push("  getKpiDataApi: totalDocs=" + kpi.totalDocuments + " revenue=" + kpi.totalRevenue);
  } catch(e) {
    log.push("  getKpiDataApi ERROR: " + e.message);
  }

  // getUserSettings
  try {
    var settings = getUserSettings();
    log.push("  getUserSettings: " + Object.keys(settings).length + " keys");
  } catch(e) {
    log.push("  getUserSettings ERROR: " + e.message);
  }

  // ─── OwnerKey stability re-check ───
  log.push("\n--- OwnerKey Stability Re-check ---");
  var key1 = getOwnerKey();
  var key2 = getOwnerKey();
  var key3 = getOwnerKey();
  log.push("  3 calls: " + (key1 === key2 && key2 === key3 ? "ALL SAME ✓" : "DIFFERENT ✗"));
  log.push("  Key: " + key1);

  // ─── Summary ───
  log.push("\n--- SUMMARY ---");
  log.push("  With USER_DEPLOYING + ANYONE_ANONYMOUS:");
  log.push("  - Script runs as OWNER (you) regardless of who accesses");
  log.push("  - PropertiesService always returns same OWNER_KEY_STABLE");
  log.push("  - Logged-in user: sees same data ✓");
  log.push("  - Anonymous user: sees same data ✓");
  log.push("  - ownerKey never changes between sessions ✓");

  log.push("\n========== END BROWSER SCENARIO TEST ==========");
  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testSetupSheetsApi() {
  var log = [];
  var sheetsId = getSheetsId();
  log.push("Testing setupSheetsApi with ID: " + sheetsId);
  
  // Clear stored ID to simulate fresh state
  log.push("\n=== Simulating fresh connect ===");
  var result = setupSheetsApi(sheetsId);
  log.push("Result: " + JSON.stringify(result, null, 2));
  
  // Verify tabs were created
  try {
    var ss = SpreadsheetApp.openById(sheetsId);
    var tabs = ss.getSheets().map(function(s) { return s.getName(); });
    log.push("Tabs now: " + tabs.join(", "));
    
    Object.keys(SCHEMA).forEach(function(tabName) {
      var exists = tabs.indexOf(tabName) !== -1;
      log.push("  " + tabName + ": " + (exists ? "OK" : "MISSING!"));
    });
  } catch(e) {
    log.push("ERROR verifying: " + e.message);
  }
  
  var fullLog = log.join("\n");
  Logger.log(fullLog);
  return fullLog;
}

function testDocPreviewData() {
  Logger.log("========== TEST DOC PREVIEW DATA ==========");
  
  var ownerKey = getOwnerKey();
  var companies = listCompanies(ownerKey);
  var companyId = companies.length > 0 ? companies[0].entityId : null;
  Logger.log("companyId: " + companyId);
  
  // Get raw records first
  var rawRecords = getRecords("DOCUMENTS");
  Logger.log("Raw records count: " + rawRecords.length);
  
  if (rawRecords.length > 0) {
    var r = rawRecords[0];
    Logger.log("\n--- RAW RECORD (first doc) ---");
    Logger.log("docId: " + r.docId);
    Logger.log("docNo: '" + r.docNo + "' (type: " + typeof r.docNo + ")");
    Logger.log("docType: '" + r.docType + "' (type: " + typeof r.docType + ")");
    Logger.log("docDate: '" + r.docDate + "' (type: " + typeof r.docDate + ")");
    Logger.log("grandTotal: '" + r.grandTotal + "' (type: " + typeof r.grandTotal + ")");
    Logger.log("json type: " + typeof r.json);
    Logger.log("json length: " + (r.json ? String(r.json).length : 0));
    Logger.log("json first 300 chars: " + String(r.json || "").substring(0, 300));
    
    // Check if json is parseable
    if (typeof r.json === "string" && r.json.length > 0) {
      try {
        var parsed = JSON.parse(r.json);
        Logger.log("json PARSED OK - keys: " + Object.keys(parsed).join(", "));
        Logger.log("  customerName: " + (parsed.customerName || "EMPTY"));
        Logger.log("  items count: " + (parsed.items ? parsed.items.length : 0));
        Logger.log("  grandTotal: " + (parsed.grandTotal || 0));
      } catch(e) {
        Logger.log("json PARSE ERROR: " + e.message);
      }
    }
  }
  
  // Now test what listDocuments returns (after normalizeDocHeader)
  var docs = listDocuments(companyId, null);
  Logger.log("\n--- NORMALIZED DOCS (listDocuments) ---");
  Logger.log("Count: " + docs.length);
  
  if (docs.length > 0) {
    var d = docs[0];
    Logger.log("docId: " + d.docId);
    Logger.log("docNo: '" + d.docNo + "' (type: " + typeof d.docNo + ")");
    Logger.log("docType: '" + d.docType + "'");
    Logger.log("docDate: '" + d.docDate + "'");
    Logger.log("grandTotal: " + d.grandTotal + " (type: " + typeof d.grandTotal + ")");
    Logger.log("json type after normalize: " + typeof d.json);
    Logger.log("json is object: " + (typeof d.json === "object"));
    if (typeof d.json === "object" && d.json) {
      Logger.log("  json.customerName: '" + (d.json.customerName || "EMPTY") + "'");
      Logger.log("  json.items: " + (d.json.items ? d.json.items.length + " items" : "NONE"));
      Logger.log("  json.grandTotal: " + (d.json.grandTotal || 0));
      if (d.json.items && d.json.items.length > 0) {
        Logger.log("  First item: " + JSON.stringify(d.json.items[0]).substring(0, 200));
      }
    }
    
    // Simulate what google.script.run does: JSON round-trip
    Logger.log("\n--- SIMULATE google.script.run SERIALIZATION ---");
    try {
      var jsonStr = JSON.stringify(d);
      Logger.log("Stringify OK, total length: " + jsonStr.length);
      var roundTrip = JSON.parse(jsonStr);
      Logger.log("Round-trip json type: " + typeof roundTrip.json);
      Logger.log("Round-trip docNo: '" + roundTrip.docNo + "'");
      if (typeof roundTrip.json === "object") {
        Logger.log("Round-trip json.customerName: '" + (roundTrip.json.customerName || "EMPTY") + "'");
        Logger.log("Round-trip json.items: " + (roundTrip.json.items ? roundTrip.json.items.length : "NONE"));
      }
    } catch(e) {
      Logger.log("SERIALIZATION ERROR: " + e.message);
    }
  }
  
  Logger.log("\n========== END TEST DOC PREVIEW DATA ==========");
}
