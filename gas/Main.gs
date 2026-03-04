function doGet(e) {
  if (e && e.parameter && e.parameter.debug === "1") {
    var payload = debugEvaluateIndex();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debugDocs === "1") {
    var payload = debugDocuments();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debugMaster === "1") {
    var payload = diagnoseMasterData();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ensureSchema();
  var template = HtmlService.createTemplateFromFile("index");
  template.bootstrap = encodeURIComponent(JSON.stringify(getBootstrapData()));
  return template
    .evaluate()
    .setTitle("Business Docs")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getBootstrapData() {
  var connectionInfo = {};
  try { connectionInfo = getSheetsConnectionInfo(); } catch(e) {}

  // Auto-migrate ownerKey for Make a Copy scenario (must run BEFORE data queries)
  var migrationResult = null;
  try { migrationResult = migrateOwnerKeyIfNeeded(); } catch(e) {
    Logger.log("Migration error: " + e.message);
  }

  var ownerKey = getOwnerKey();
  var sheetsId = getSheetsId();
  var settings = {};
  var companies = [];
  if (sheetsId) {
    try {
      settings = getSettingsMap("USER", ownerKey);
      companies = listCompanies(ownerKey);
    } catch (e) {
      Logger.log("Bootstrap error (Sheets not ready): " + e.message);
    }
  }

  return {
    user: {
      email: getCurrentUserEmail(),
      ownerKey: ownerKey
    },
    config: getUiConfig(),
    settings: settings,
    companies: companies,
    sheetsId: sheetsId,
    sheetsConnection: connectionInfo,
    migration: migrationResult
  };
}

// ===== Library Entry Point =====
// Product script calls this after injecting its PropertiesService via setProductProps()
function serveWebApp(e) {
  if (e && e.parameter && e.parameter.debug === "1") {
    var payload = debugEvaluateIndex();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debugDocs === "1") {
    var payload = debugDocuments();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debugMaster === "1") {
    var payload = diagnoseMasterData();
    return ContentService
      .createTextOutput(JSON.stringify(payload, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ensureSchema();
  var template = HtmlService.createTemplateFromFile("index");
  template.bootstrap = encodeURIComponent(JSON.stringify(getBootstrapData()));
  return template
    .evaluate()
    .setTitle("Business Docs")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function debugEvaluateIndex() {
  var template = HtmlService.createTemplateFromFile("index");
  template.bootstrap = encodeURIComponent("{}");
  var html = template.evaluate().getContent();

  var initIndex = html.indexOf("function init()");
  var domLoadedIndex = html.indexOf("DOMContentLoaded");

  return {
    length: html.length,
    hasCssTag: html.indexOf("<style") !== -1,
    hasScriptTag: html.indexOf("<script") !== -1,
    hasInit: initIndex !== -1,
    hasDOMContentLoaded: domLoadedIndex !== -1,
    initIndex: initIndex,
    domLoadedIndex: domLoadedIndex,
    tail: html.slice(Math.max(0, html.length - 200))
  };
}
