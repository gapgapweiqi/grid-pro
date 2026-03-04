function getMasterData(companyId) {
  var ownerKey = getOwnerKey();
  Logger.log("getMasterData called - ownerKey: " + ownerKey + ", companyId: " + companyId);
  try {
    var customers = listCustomers(ownerKey, null);
    var products = listProducts(ownerKey, null);
    var salespersons = listSalespersons(ownerKey, null);
    Logger.log("getMasterData results - customers: " + customers.length + ", products: " + products.length + ", salespersons: " + salespersons.length);
    var result = {
      customers: customers,
      products: products,
      salespersons: salespersons
    };
    // Force clean serialization to avoid google.script.run issues with nested objects
    return JSON.parse(JSON.stringify(result));
  } catch (e) {
    Logger.log("getMasterData ERROR: " + e.message + "\n" + e.stack);
    throw e;
  }
}

function saveCompany(payload) {
  return upsertCompany(payload);
}

function saveCustomer(payload) {
  return upsertCustomer(payload);
}

function saveProduct(payload) {
  return upsertProduct(payload);
}

function saveSalesperson(payload) {
  return upsertSalesperson(payload);
}

function deleteEntities(entityType, ids) {
  return hardDeleteEntities(entityType, ids || []);
}

function getUserSettings() {
  var ownerKey = getOwnerKey();
  return getSettingsMap("USER", ownerKey);
}

function updateUserSettings(settings) {
  var ownerKey = getOwnerKey();
  Object.keys(settings || {}).forEach(function (key) {
    upsertSetting(key, "USER", ownerKey, settings[key]);
  });
  return getSettingsMap("USER", ownerKey);
}

function listCompaniesApi() {
  var ownerKey = getOwnerKey();
  Logger.log("listCompaniesApi - ownerKey: " + ownerKey);
  var companies = listCompanies(ownerKey);
  Logger.log("listCompaniesApi - returning " + companies.length + " companies");
  if (companies.length > 0) {
    companies.forEach(function(c) {
      Logger.log("listCompaniesApi - company: " + c.entityId + ", name: " + c.name + ", ownerKey: " + c.ownerKey);
    });
  }
  return companies;
}

// ===== Document History API =====
function listDocumentsForHistoryApi(companyId) {
  try {
    var result = listDocuments(companyId, null);
    return result;
  } catch (e) {
    Logger.log("listDocumentsForHistoryApi ERROR: " + e.message + "\n" + e.stack);
    throw e;
  }
}

// ===== Payment Tracking API =====
function listPayableDocumentsApi(companyId) {
  try {
    var payableTypes = ["QUO", "INV", "BILL", "TAX", "DO", "PO", "CN", "PV", "PR"];
    var docs = listDocuments(companyId, null);
    var filtered = docs.filter(function(d) {
      return payableTypes.indexOf(safeString(d.docType)) !== -1;
    });
    filtered.sort(function(a, b) {
      var da = a.dueDate || a.docDate || "9999";
      var db = b.dueDate || b.docDate || "9999";
      return da.localeCompare(db);
    });
    return filtered;
  } catch (e) {
    Logger.log("listPayableDocumentsApi ERROR: " + e.message + "\n" + e.stack);
    throw e;
  }
}

function debugDocHistoryApi() {
  var ownerKey = getOwnerKey();
  var sheetsId = getSheetsId();
  var allRecords = isSheetsReady() ? getRecords("DOCUMENTS") : [];
  var companies = isSheetsReady() ? listCompanies(ownerKey) : [];
  var firstCompanyId = companies.length > 0 ? (companies[0].entityId || "") : "";
  
  var matchingRecords = allRecords.filter(function(r) {
    return String(r.ownerKey) === String(ownerKey) && !toBoolean(r.isDeleted);
  });
  
  var docSummary = allRecords.slice(0, 5).map(function(r) {
    return {
      docId: String(r.docId).substring(0, 8),
      docType: r.docType,
      ownerKey: String(r.ownerKey).substring(0, 20),
      companyId: String(r.companyId).substring(0, 8),
      docNo: r.docNo,
      isDeleted: r.isDeleted,
      grandTotal: r.grandTotal
    };
  });
  
  return {
    sheetsId: sheetsId ? sheetsId.substring(0, 10) + "..." : "NOT SET",
    currentOwnerKey: ownerKey,
    currentEmail: getCurrentUserEmail(),
    totalRecordsInSheet: allRecords.length,
    matchingOwnerKey: matchingRecords.length,
    companiesCount: companies.length,
    firstCompanyId: firstCompanyId ? firstCompanyId.substring(0, 8) : "NONE",
    sampleDocs: docSummary
  };
}

function listDocumentsApi(companyId, filters) {
  return listDocuments(companyId, filters);
}

function listAllDocumentsApi() {
  return listDocuments(null, null);
}

function debugDocuments() {
  var ownerKey = getOwnerKey();
  var docs = getRecords("DOCUMENTS");
  var companies = listCompanies(ownerKey);
  return {
    currentOwnerKey: ownerKey,
    currentUserEmail: getCurrentUserEmail(),
    documentsCount: docs.length,
    companiesCount: companies.length,
    storage: "Google Sheets",
    sheetsId: getSheetsId()
  };
}

function listInvoicesForBillingApi(companyId, customerId) {
  try {
    return listInvoicesForBilling(companyId, customerId);
  } catch (e) {
    Logger.log("listInvoicesForBillingApi ERROR: " + e.message + "\n" + e.stack);
    throw e;
  }
}

// ===== Document Number API =====
function getNextDocNoApi(docType, companyId) {
  var ownerKey = getOwnerKey();
  return { docNo: generateNextDocNo(docType, companyId, ownerKey) };
}

function peekNextDocNoApi(docType, companyId) {
  var ownerKey = getOwnerKey();
  return { docNo: peekNextDocNo(docType, companyId, ownerKey) };
}

function getDocumentApi(docId) {
  return getDocumentWithDetails(docId);
}

function createDocumentApi(payload) {
  return createDocument(payload);
}

function saveDocument(payload) {
  var ownerKey = getOwnerKey();
  var companyId = payload.companyId;
  
  Logger.log("saveDocument called with companyId: " + companyId);
  
  if (!companyId) {
    var companies = listCompanies(ownerKey);
    if (companies.length > 0) {
      companyId = companies[0].entityId;
      Logger.log("saveDocument auto-selected companyId: " + companyId);
    }
  }
  
  if (!companyId) {
    throw new Error("กรุณาเลือกบริษัทก่อนบันทึกเอกสาร");
  }
  
  var jsonData = payload.json || {};
  var items = jsonData.items || [];
  
  var lines = items.map(function(item, index) {
    var qty = Number(item.qty) || 1;
    var unitPrice = Number(item.price) || 0;
    var discountValue = Number(item.discount) || 0;
    var discountType = item.discountType === "percent" ? "PERCENT" : "AMOUNT";
    
    return {
      lineNo: index + 1,
      productId: item.productId || "",
      code: item.code || "",
      name: item.name || "",
      description: item.description || "",
      qty: qty,
      unit: item.unit || "",
      unitPrice: unitPrice,
      discountType: discountType,
      discountValue: discountValue,
      json: {}
    };
  });
  
  var customerSelect = payload.customerId || "";
  
  var docPayload = {
    companyId: companyId,
    docType: payload.type || payload.docType || "QUO",
    docNo: payload.docNo || "",
    docDate: payload.docDate || "",
    dueDate: payload.dueDate || "",
    customerId: customerSelect,
    notes: jsonData.note || "",
    terms: payload.terms || jsonData.termsText || "",
    discountEnabled: toBoolean(payload.discountEnabled),
    discountType: String(payload.discountType || "PERCENT").toUpperCase(),
    discountValue: Number(payload.discountValue) || 0,
    vatEnabled: toBoolean(payload.vatEnabled),
    vatRate: Number(payload.vatRate) || 7,
    whtEnabled: toBoolean(payload.whtEnabled),
    whtRate: Number(payload.whtRate) || 3,
    signatureEnabled: payload.signatureEnabled !== false,
    lines: lines,
    json: jsonData
  };
  
  var result = createDocument(docPayload);
  Logger.log("saveDocument created document with docId: " + (result && result.header ? result.header.docId : "unknown"));
  return result;
}

function updateDocumentApi(docId, payload) {
  return updateDocument(docId, payload);
}

function updatePaymentStatusApi(docId, status, paymentDate) {
  return updatePaymentStatus(docId, status, paymentDate);
}

function deleteDocumentApi(docId) {
  return hardDeleteDocument(docId);
}

function getKpiDataApi(companyId) {
  return getKpiData(companyId);
}

function getSalesTrendApi(companyId, months) {
  return getSalesTrend(companyId, months);
}

function getTopCustomersApi(companyId, limit) {
  return getTopCustomers(companyId, limit);
}

function getTopProductsApi(companyId, limit) {
  return getTopProducts(companyId, limit);
}

function getUnpaidDocumentsApi(companyId) {
  return getUnpaidDocuments(companyId);
}

function exportCsvApi(entityType, companyId) {
  var csvText = exportCsv(entityType, null);
  if (!csvText) return { content: "", filename: "" };
  var filename = (entityType || "export").toLowerCase() + "_export.csv";
  return { content: csvText, filename: filename };
}

function importCsvApi(entityType, companyId, csvText, options) {
  return importCsv(entityType, null, csvText, options);
}

function fetchImageBase64Api(url) {
  return fetchImageBase64(url);
}

function uploadCompanyLogoDriveApi(base64Data, mimeType, fileName) {
  return uploadCompanyLogoDrive(base64Data, mimeType, fileName);
}

function uploadCompanyLogoApi(companyId, base64, mimeType, fileName) {
  return uploadCompanyLogo(companyId, base64, mimeType, fileName);
}

function uploadProductImageApi(productId, base64, mimeType, fileName) {
  return uploadProductImage(productId, base64, mimeType, fileName);
}
