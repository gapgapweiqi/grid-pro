// ===== KPI Service (Google Sheets Backend) =====

function getKpiData(companyId) {
  var ownerKey = getOwnerKey();
  var docs = getRecords("DOCUMENTS");
  var now = new Date();
  var currentYearMonth = now.getFullYear() + "-" + padNumber(now.getMonth() + 1, 2);
  var monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var periodLabel = monthNames[now.getMonth()] + " " + (now.getFullYear() + 543).toString().substring(2);

  var salesThisMonth = 0, paidThisMonth = 0, unpaidTotal = 0, vatOutputThisMonth = 0;
  var totalRevenue = 0, totalDocuments = 0;

  docs.forEach(function(d) {
    if (toBoolean(d.isDeleted)) return;
    if (String(d.ownerKey) !== String(ownerKey)) return;
    if (companyId && String(d.companyId) !== String(companyId)) return;
    totalDocuments++;
    var gt = Number(d.grandTotal) || 0;
    var vatAmt = Number(d.vatAmount) || 0;
    totalRevenue += gt;

    var isRcpt = String(d.docType) === "RCPT";
    if (!isRcpt && String(d.paymentStatus) !== "PAID") {
      unpaidTotal += gt;
    }

    var docYearMonth = String(d.docDate || d.createdAt || "").substring(0, 7);
    if (docYearMonth === currentYearMonth) {
      salesThisMonth += gt;
      vatOutputThisMonth += vatAmt;
      if (isRcpt || String(d.paymentStatus) === "PAID") {
        paidThisMonth += gt;
      }
    }
  });

  return {
    salesThisMonth: roundMoney(salesThisMonth),
    unpaidTotal: roundMoney(unpaidTotal),
    paidThisMonth: roundMoney(paidThisMonth),
    vatOutputThisMonth: roundMoney(vatOutputThisMonth),
    totalRevenue: roundMoney(totalRevenue),
    totalDocuments: totalDocuments,
    period: periodLabel
  };
}

function getUnpaidDocuments(companyId) {
  var ownerKey = getOwnerKey();
  var docs = getRecords("DOCUMENTS");
  var unpaid = docs.filter(function(d) {
    if (toBoolean(d.isDeleted)) return false;
    if (String(d.ownerKey) !== String(ownerKey)) return false;
    if (companyId && String(d.companyId) !== String(companyId)) return false;
    if (String(d.docType) === "RCPT") return false;
    return String(d.paymentStatus) !== "PAID";
  });
  unpaid.sort(function(a, b) {
    return String(a.dueDate || a.docDate || "9999").localeCompare(String(b.dueDate || b.docDate || "9999"));
  });
  return unpaid.map(normalizeDocHeader);
}

function getSalesTrend(companyId, months) {
  var ownerKey = getOwnerKey();
  var docs = getRecords("DOCUMENTS");
  var now = new Date();
  var numMonths = months || 6;
  var result = [];

  for (var m = numMonths - 1; m >= 0; m--) {
    var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    var yearMonth = d.getFullYear() + "-" + padNumber(d.getMonth() + 1, 2);
    var monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    var label = monthNames[d.getMonth()] + " " + (d.getFullYear() + 543).toString().substring(2);
    var total = 0, count = 0;

    docs.forEach(function(doc) {
      if (toBoolean(doc.isDeleted)) return;
      if (String(doc.ownerKey) !== String(ownerKey)) return;
      if (companyId && String(doc.companyId) !== String(companyId)) return;
      if (String(doc.docDate).substring(0, 7) === yearMonth) {
        total += Number(doc.grandTotal) || 0;
        count++;
      }
    });

    result.push({ month: label, label: label, total: roundMoney(total), sales: roundMoney(total), count: count });
  }
  return result;
}

function getTopCustomers(companyId, limit) {
  var ownerKey = getOwnerKey();
  var docs = getRecords("DOCUMENTS");
  var map = {};
  docs.forEach(function(d) {
    if (toBoolean(d.isDeleted)) return;
    if (String(d.ownerKey) !== String(ownerKey)) return;
    if (companyId && String(d.companyId) !== String(companyId)) return;
    var cid = String(d.customerId);
    if (!cid) return;
    
    var json = safeJsonParse(d.json, {});
    var cname = json.customerName || json.vendorName || cid;
    
    if (!map[cid]) {
      map[cid] = { customerId: cid, customerName: cname, total: 0, count: 0 };
    } else {
      // Update with valid name if we previously only had UUID
      if (map[cid].customerName === cid && cname !== cid) {
        map[cid].customerName = cname;
      }
    }
    
    map[cid].total += Number(d.grandTotal) || 0;
    map[cid].count++;
  });
  
  var arr = Object.keys(map).map(function(k) { return map[k]; });
  arr.sort(function(a, b) { return b.total - a.total; });
  
  var customers = listCustomers(ownerKey, null);
  var custMap = {};
  customers.forEach(function(c) { custMap[String(c.entityId)] = c; });
  
  return arr.slice(0, limit || 5).map(function(item) {
    var cust = custMap[item.customerId];
    if (cust && cust.name) {
      item.customerName = cust.name;
    } else if (cust && cust.json) {
      var cjson = safeJsonParse(cust.json, {});
      if (cjson.name) item.customerName = cjson.name;
    }
    item.total = roundMoney(item.total);
    return item;
  });
}

function getTopProducts(companyId, limit) {
  var ownerKey = getOwnerKey();
  var lines = getRecords("DOC_LINES");
  var docs = getRecords("DOCUMENTS");
  var docMap = {};
  docs.forEach(function(d) { docMap[d.docId] = d; });
  var map = {};
  lines.forEach(function(l) {
    var doc = docMap[l.docId];
    if (!doc || toBoolean(doc.isDeleted)) return;
    if (String(doc.ownerKey) !== String(ownerKey)) return;
    if (companyId && String(doc.companyId) !== String(companyId)) return;
    var pid = String(l.productId) || String(l.name);
    if (!pid) return;
    if (!map[pid]) map[pid] = { productId: pid, name: l.name || pid, total: 0, qty: 0 };
    map[pid].total += Number(l.lineTotal) || 0;
    map[pid].qty += Number(l.qty) || 0;
  });
  var arr = Object.keys(map).map(function(k) { return map[k]; });
  arr.sort(function(a, b) { return b.total - a.total; });
  return arr.slice(0, limit || 5).map(function(item) {
    item.total = roundMoney(item.total);
    return item;
  });
}
