// ===== Sequence Service (Google Sheets Backend) =====
// Running numbers เก็บใน PropertiesService (เร็วมาก, ไม่ต้องสร้างแท็บแยก)

function getNextSequence(key, ownerKey) {
  var props = getProductProps();
  var seqKey = "seq." + ownerKey + "." + key;
  var current = parseInt(props.getProperty(seqKey) || "0", 10);
  current++;
  props.setProperty(seqKey, String(current));
  return current;
}

function resetSequence(key, ownerKey) {
  var props = getProductProps();
  var seqKey = "seq." + ownerKey + "." + key;
  props.setProperty(seqKey, "0");
  return { success: true };
}

function getCurrentSequence(key, ownerKey) {
  var props = getProductProps();
  var seqKey = "seq." + ownerKey + "." + key;
  return parseInt(props.getProperty(seqKey) || "0", 10);
}

// ===== Document Number Formatting =====

function _getDocNoSettings(ownerKey) {
  var settingsMap = getSettingsMap("USER", ownerKey);
  return {
    pattern: settingsMap["docNo.pattern"] || "A",
    digits: parseInt(settingsMap["docNo.digits"] || "4", 10),
    separator: settingsMap["docNo.separator"] || "-",
    prefixes: {
      QUO: settingsMap["docNo.prefix.QUO"] || "QUO",
      INV: settingsMap["docNo.prefix.INV"] || "INV",
      BILL: settingsMap["docNo.prefix.BILL"] || "BN",
      TAX: settingsMap["docNo.prefix.TAX"] || "TAX",
      RCPT: settingsMap["docNo.prefix.RCPT"] || "RCP",
      DO: settingsMap["docNo.prefix.DO"] || "DO",
      PO: settingsMap["docNo.prefix.PO"] || "PO",
      CN: settingsMap["docNo.prefix.CN"] || "CN",
      PV: settingsMap["docNo.prefix.PV"] || "PV",
      PR: settingsMap["docNo.prefix.PR"] || "PR"
    }
  };
}

function _buildDatePart(pattern) {
  var now = new Date();
  var bYear = now.getFullYear() + 543;
  var cYear = now.getFullYear();
  var mm = ("0" + (now.getMonth() + 1)).slice(-2);
  switch (pattern) {
    case "A": return String(bYear).slice(-2) + mm;
    case "B": return String(bYear).slice(-2);
    case "C": return String(bYear);
    case "D": return String(cYear).slice(-2) + mm;
    case "E": return String(cYear);
    default:  return String(bYear).slice(-2) + mm;
  }
}

function _buildPeriodKey(pattern) {
  var now = new Date();
  var bYear = now.getFullYear() + 543;
  var cYear = now.getFullYear();
  var mm = ("0" + (now.getMonth() + 1)).slice(-2);
  switch (pattern) {
    case "A": return String(bYear).slice(-2) + mm;
    case "B": return String(bYear).slice(-2);
    case "C": return String(bYear);
    case "D": return String(cYear).slice(-2) + mm;
    case "E": return String(cYear);
    default:  return String(bYear).slice(-2) + mm;
  }
}

function generateNextDocNo(docType, companyId, ownerKey) {
  var cfg = _getDocNoSettings(ownerKey);
  var prefix = cfg.prefixes[docType] || docType;
  var datePart = _buildDatePart(cfg.pattern);
  var periodKey = _buildPeriodKey(cfg.pattern);
  var seqKey = "doc." + docType + "." + (companyId || "global") + "." + periodKey;
  
  var props = getProductProps();
  var seq = parseInt(props.getProperty("seq." + ownerKey + "." + seqKey) || "0", 10) + 1;
  var candidateDocNo = prefix + datePart + cfg.separator + padNumber(seq, cfg.digits);
  
  // Check against actual documents to avoid reusing deleted or existing numbers
  var allDocs = getRecords("DOCUMENTS");
  var existingMap = {};
  for (var i = 0; i < allDocs.length; i++) {
    if (String(allDocs[i].ownerKey) === String(ownerKey) && String(allDocs[i].companyId) === String(companyId || "global")) {
      var no = (allDocs[i].docNo || "").trim().toUpperCase();
      if (no) existingMap[no] = true;
    }
  }
  
  while (existingMap[candidateDocNo.toUpperCase()]) {
    seq++;
    candidateDocNo = prefix + datePart + cfg.separator + padNumber(seq, cfg.digits);
  }
  
  props.setProperty("seq." + ownerKey + "." + seqKey, String(seq));
  return candidateDocNo;
}

function peekNextDocNo(docType, companyId, ownerKey) {
  var cfg = _getDocNoSettings(ownerKey);
  var prefix = cfg.prefixes[docType] || docType;
  var datePart = _buildDatePart(cfg.pattern);
  var periodKey = _buildPeriodKey(cfg.pattern);
  var seqKey = "doc." + docType + "." + (companyId || "global") + "." + periodKey;
  
  var props = getProductProps();
  var seq = parseInt(props.getProperty("seq." + ownerKey + "." + seqKey) || "0", 10) + 1;
  var candidateDocNo = prefix + datePart + cfg.separator + padNumber(seq, cfg.digits);
  
  // Check against actual documents to avoid reusing deleted or existing numbers
  var allDocs = getRecords("DOCUMENTS");
  var existingMap = {};
  for (var i = 0; i < allDocs.length; i++) {
    if (String(allDocs[i].ownerKey) === String(ownerKey) && String(allDocs[i].companyId) === String(companyId || "global")) {
      var no = (allDocs[i].docNo || "").trim().toUpperCase();
      if (no) existingMap[no] = true;
    }
  }
  
  while (existingMap[candidateDocNo.toUpperCase()]) {
    seq++;
    candidateDocNo = prefix + datePart + cfg.separator + padNumber(seq, cfg.digits);
  }
  
  return candidateDocNo;
}
