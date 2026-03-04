// ===== Document Service (Google Sheets Backend) =====

function normalizeDocHeader(record) {
  var n = {};
  Object.keys(record).forEach(function(k) { if (k !== "_rowIndex") n[k] = record[k]; });
  n.isDeleted = toBoolean(n.isDeleted);
  n.json = safeJsonParse(n.json, {});
  n.grandTotal = Number(n.grandTotal) || 0;
  n.subtotal = Number(n.subtotal) || 0;
  n.vatAmount = Number(n.vatAmount) || 0;
  n.whtAmount = Number(n.whtAmount) || 0;
  return n;
}

function listDocuments(companyId, filters) {
  var ownerKey = getOwnerKey();
  var records = getRecords("DOCUMENTS");
  var filtered = records.filter(function(r) {
    if (toBoolean(r.isDeleted)) return false;
    if (String(r.ownerKey) !== String(ownerKey)) return false;
    if (companyId && String(r.companyId) !== String(companyId)) return false;
    if (filters) {
      if (filters.docType && String(r.docType) !== String(filters.docType)) return false;
      if (filters.paymentStatus && String(r.paymentStatus) !== String(filters.paymentStatus)) return false;
      if (filters.docStatus && String(r.docStatus) !== String(filters.docStatus)) return false;
    }
    return true;
  });
  filtered.sort(function(a, b) {
    return String(b.docDate || b.createdAt || "").localeCompare(String(a.docDate || a.createdAt || ""));
  });
  return filtered.map(normalizeDocHeader);
}

function getDocumentWithDetails(docId) {
  var header = findById("DOCUMENTS", "docId", docId);
  if (!header) return null;
  var lines = getDocumentLines(docId);
  return { header: normalizeDocHeader(header), lines: lines };
}

function createDocument(payload) {
  var ownerKey = getOwnerKey();
  var now = nowIso();
  var docId = Utilities.getUuid();
  var lines = payload.lines || [];
  var jsonData = payload.json || {};

  var subtotal = 0;
  var itemDiscountTotal = 0;
  var processedLines = lines.map(function(item, index) {
    var qty = Number(item.qty) || 1;
    var unitPrice = Number(item.unitPrice) || Number(item.price) || 0;
    var lineGross = roundMoney(qty * unitPrice);
    subtotal += lineGross;

    // Item-level discount
    var itemDiscType = String(item.discountType || "").toUpperCase();
    var itemDiscVal = Number(item.discountValue) || 0;
    var itemDisc = 0;
    if (itemDiscVal > 0) {
      itemDisc = (itemDiscType === "PERCENT") ? roundMoney(lineGross * itemDiscVal / 100) : itemDiscVal;
    }
    itemDiscountTotal += itemDisc;
    var lineTotal = roundMoney(lineGross - itemDisc);

    return {
      lineId: Utilities.getUuid(),
      docId: docId,
      lineNo: item.lineNo || (index + 1),
      productId: item.productId || "",
      code: item.code || "",
      name: item.name || "",
      description: item.description || "",
      qty: qty,
      unit: item.unit || "",
      unitPrice: unitPrice,
      discountType: item.discountType || "",
      discountValue: Number(item.discountValue) || 0,
      lineTotal: lineTotal,
      json: JSON.stringify(item.json || {}),
      createdAt: now,
      updatedAt: now
    };
  });

  subtotal = roundMoney(subtotal);
  var afterItemDiscount = roundMoney(subtotal - itemDiscountTotal);

  var discountEnabled = toBoolean(payload.discountEnabled);
  var discountType = payload.discountType || "AMOUNT";
  var discountValue = Number(payload.discountValue) || 0;
  var discount = 0;
  if (discountEnabled) {
    discount = discountType === "PERCENT" ? roundMoney(afterItemDiscount * discountValue / 100) : discountValue;
  }
  var totalBeforeTax = roundMoney(afterItemDiscount - discount);

  var vatEnabled = toBoolean(payload.vatEnabled);
  var vatRate = Number(payload.vatRate) || 7;
  var vatInclusive = toBoolean(payload.vatInclusive || (jsonData && jsonData.vatInclusive));
  var vatAmount = 0;
  if (vatEnabled) {
    if (vatInclusive) {
      vatAmount = roundMoney(totalBeforeTax - (totalBeforeTax / (1 + vatRate / 100)));
    } else {
      vatAmount = roundMoney(totalBeforeTax * vatRate / 100);
    }
  }

  var whtEnabled = toBoolean(payload.whtEnabled);
  var whtRate = Number(payload.whtRate) || 3;
  var whtAmount = 0;
  if (whtEnabled) {
    var whtBase = totalBeforeTax;
    if (vatEnabled && vatInclusive) {
      whtBase = totalBeforeTax / (1 + vatRate / 100);
    }
    whtAmount = roundMoney(whtBase * whtRate / 100);
  }

  var customFeeEnabled = toBoolean(payload.customFeeEnabled || (jsonData && jsonData.customFeeEnabled));
  var customFeeAmount = customFeeEnabled ? (Number(payload.customFeeAmount || (jsonData && jsonData.customFeeAmount)) || 0) : 0;

  var grandTotal = vatInclusive
    ? roundMoney(totalBeforeTax - whtAmount + customFeeAmount)
    : roundMoney(totalBeforeTax + vatAmount - whtAmount + customFeeAmount);

  var docNo = payload.docNo || "";
  if (!docNo) {
    docNo = generateNextDocNo(payload.docType || "QUO", payload.companyId || "global", ownerKey);
  } else {
    // Check if user-provided docNo already exists
    var allDocs = getRecords("DOCUMENTS");
    for (var i = 0; i < allDocs.length; i++) {
      if (String(allDocs[i].ownerKey) === String(ownerKey) && String(allDocs[i].companyId) === String(payload.companyId || "global")) {
        if ((allDocs[i].docNo || "").trim().toUpperCase() === docNo.trim().toUpperCase()) {
          throw new Error("เลขที่เอกสาร " + docNo + " มีอยู่ในระบบแล้ว กรุณาใช้เลขอื่น");
        }
      }
    }
  }

  var header = {
    docId: docId,
    docType: payload.docType || "QUO",
    ownerKey: ownerKey,
    companyId: payload.companyId || "",
    customerId: payload.customerId || "",
    docNo: docNo,
    docDate: payload.docDate || now.substring(0, 10),
    dueDate: payload.dueDate || "",
    refDocNo: payload.refDocNo || "",
    currency: payload.currency || "THB",
    subtotal: subtotal,
    discountEnabled: discountEnabled,
    discountType: discountType,
    discountValue: discountValue,
    vatEnabled: vatEnabled,
    vatRate: vatRate,
    whtEnabled: whtEnabled,
    whtRate: whtRate,
    totalBeforeTax: totalBeforeTax,
    vatAmount: vatAmount,
    whtAmount: whtAmount,
    grandTotal: grandTotal,
    paymentStatus: payload.paymentStatus || "UNPAID",
    docStatus: payload.docStatus || "DRAFT",
    notes: payload.notes || "",
    terms: payload.terms || "",
    signatureEnabled: payload.signatureEnabled !== false,
    pdfFileId: "",
    isDeleted: false,
    json: JSON.stringify(jsonData),
    createdAt: now,
    updatedAt: now
  };

  appendRecord("DOCUMENTS", header);

  processedLines.forEach(function(line) {
    appendRecord("DOC_LINES", line);
  });

  logEvent(ownerKey, payload.companyId, "DOC_CREATED", "DOC", docId, grandTotal, "", "DRAFT", "");

  return { header: normalizeDocHeader(header), lines: processedLines };
}

function updateDocument(docId, payload) {
  var ownerKey = getOwnerKey();
  var rec = findById("DOCUMENTS", "docId", docId);
  if (!rec) throw new Error("Document not found: " + docId);
  
  // Check docNo uniqueness if it's being updated
  var newDocNo = payload.docNo || "";
  if (newDocNo && newDocNo.trim().toUpperCase() !== (rec.docNo || "").trim().toUpperCase()) {
    var allDocs = getRecords("DOCUMENTS");
    for (var i = 0; i < allDocs.length; i++) {
      if (String(allDocs[i].ownerKey) === String(ownerKey) && String(allDocs[i].companyId) === String(rec.companyId || "global")) {
        if ((allDocs[i].docNo || "").trim().toUpperCase() === newDocNo.trim().toUpperCase()) {
          throw new Error("เลขที่เอกสาร " + newDocNo + " มีอยู่ในระบบแล้ว กรุณาใช้เลขอื่น");
        }
      }
    }
  }

  Object.keys(payload).forEach(function(key) {
    if (key !== "docId" && key !== "ownerKey" && key !== "createdAt" && key !== "_rowIndex") {
      rec[key] = payload[key];
    }
  });
  rec.updatedAt = nowIso();
  updateRow("DOCUMENTS", rec._rowIndex, rec);
  return { success: true, header: normalizeDocHeader(rec) };
}

function updatePaymentStatus(docId, status, paymentDate) {
  var rec = findById("DOCUMENTS", "docId", docId);
  if (!rec) throw new Error("Document not found: " + docId);
  var oldStatus = rec.paymentStatus;
  rec.paymentStatus = status;
  rec.updatedAt = nowIso();
  var json = safeJsonParse(rec.json, {});
  if (paymentDate) json.paymentDate = paymentDate;
  rec.json = JSON.stringify(json);
  updateRow("DOCUMENTS", rec._rowIndex, rec);
  var ownerKey = getOwnerKey();
  logEvent(ownerKey, rec.companyId, "PAYMENT_UPDATED", "DOC", docId, rec.grandTotal, oldStatus, status, paymentDate || "");
  return { success: true, docId: docId, status: status };
}

function softDeleteDocument(docId) {
  var rec = findById("DOCUMENTS", "docId", docId);
  if (!rec) return { success: false };
  rec.isDeleted = true;
  rec.updatedAt = nowIso();
  updateRow("DOCUMENTS", rec._rowIndex, rec);
  return { success: true, docId: docId };
}

function hardDeleteDocument(docId) {
  var ownerKey = getOwnerKey();
  var rec = findById("DOCUMENTS", "docId", docId);
  if (!rec) return { success: false };
  if (String(rec.ownerKey) !== String(ownerKey)) return { success: false };

  // Delete DOC_LINES first (reverse order to preserve row indices)
  var allLines = getRecords("DOC_LINES");
  var lineRows = [];
  for (var i = 0; i < allLines.length; i++) {
    if (String(allLines[i].docId) === String(docId)) {
      lineRows.push(allLines[i]._rowIndex);
    }
  }
  lineRows.sort(function(a, b) { return b - a; }); // descending
  for (var j = 0; j < lineRows.length; j++) {
    deleteRow("DOC_LINES", lineRows[j]);
  }

  // Delete DOCUMENTS row
  deleteRow("DOCUMENTS", rec._rowIndex);

  logEvent(ownerKey, rec.companyId, "DOC_DELETED", "DOC", docId, Number(rec.grandTotal) || 0, "", "", "");
  return { success: true, docId: docId };
}

function listInvoicesForBilling(companyId, customerId) {
  var ownerKey = getOwnerKey();
  var allDocs = getRecords("DOCUMENTS");

  // Get UNPAID INV documents for this customer
  var invoices = allDocs.filter(function(r) {
    if (toBoolean(r.isDeleted)) return false;
    if (String(r.ownerKey) !== String(ownerKey)) return false;
    if (companyId && String(r.companyId) !== String(companyId)) return false;
    if (String(r.docType) !== "INV") return false;
    if (String(r.customerId) !== String(customerId)) return false;
    if (String(r.paymentStatus) !== "UNPAID") return false;
    return true;
  });

  // Find all existing BILL documents (non-deleted) to check which invoices are already used
  var billDocs = allDocs.filter(function(r) {
    return !toBoolean(r.isDeleted) &&
      String(r.ownerKey) === String(ownerKey) &&
      String(r.docType) === "BILL";
  });
  var billDocIds = billDocs.map(function(b) { return String(b.docId); });
  var billDocNoMap = {};
  billDocs.forEach(function(b) { billDocNoMap[String(b.docId)] = b.docNo || ""; });

  // Scan DOC_LINES for BILL documents to find used invoice references
  var allLines = getRecords("DOC_LINES");
  var usedInvoiceMap = {}; // invDocId -> billDocNo
  allLines.forEach(function(line) {
    var lineDocId = String(line.docId);
    if (billDocIds.indexOf(lineDocId) !== -1 && line.productId) {
      usedInvoiceMap[String(line.productId)] = billDocNoMap[lineDocId] || lineDocId;
    }
  });

  // Build result with usedInBill flag and financial details
  var result = invoices.map(function(inv) {
    var invId = String(inv.docId);
    var used = usedInvoiceMap.hasOwnProperty(invId);
    var subtotal = Number(inv.subtotal) || 0;
    var totalBeforeTax = Number(inv.totalBeforeTax) || 0;
    var discountEnabled = toBoolean(inv.discountEnabled);
    var discountValue = Number(inv.discountValue) || 0;
    var discountType = inv.discountType || "AMOUNT";
    var discountAmount = 0;
    if (discountEnabled && discountValue > 0) {
      discountAmount = (String(discountType).toUpperCase() === "PERCENT") ? roundMoney(subtotal * discountValue / 100) : discountValue;
    }
    return {
      docId: invId,
      docNo: inv.docNo || "",
      docDate: inv.docDate || "",
      dueDate: inv.dueDate || "",
      grandTotal: Number(inv.grandTotal) || 0,
      subtotal: subtotal,
      discountAmount: discountAmount,
      totalBeforeTax: totalBeforeTax || roundMoney(subtotal - discountAmount),
      vatEnabled: toBoolean(inv.vatEnabled),
      vatRate: Number(inv.vatRate) || 0,
      vatAmount: Number(inv.vatAmount) || 0,
      whtEnabled: toBoolean(inv.whtEnabled),
      whtRate: Number(inv.whtRate) || 0,
      whtAmount: Number(inv.whtAmount) || 0,
      usedInBill: used,
      billDocNo: used ? usedInvoiceMap[invId] : ""
    };
  });

  result.sort(function(a, b) {
    return String(b.docDate).localeCompare(String(a.docDate));
  });

  return result;
}

function getDocumentLines(docId) {
  var allLines = getRecords("DOC_LINES");
  return allLines.filter(function(l) {
    return String(l.docId) === String(docId);
  }).map(function(l) {
    var n = {};
    Object.keys(l).forEach(function(k) { if (k !== "_rowIndex") n[k] = l[k]; });
    n.json = safeJsonParse(n.json, {});
    return n;
  });
}
