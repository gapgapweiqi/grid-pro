// ===== File Service (Google Sheets Backend) =====

function uploadFile(payload) {
  var ownerKey = getOwnerKey();
  var fileId = Utilities.getUuid();
  var now = nowIso();
  var record = {
    fileId: fileId,
    ownerKey: ownerKey,
    companyId: payload.companyId || "",
    refType: payload.refType || "",
    refId: payload.refId || "",
    mimeType: payload.mimeType || "",
    name: payload.name || "",
    size: payload.size || 0,
    url: payload.url || payload.data || "",
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  };
  appendRecord("FILES", record);
  return { success: true, fileId: fileId };
}

function getFileById(fileId) {
  return findById("FILES", "fileId", fileId);
}

function listFiles(refType, refId) {
  var ownerKey = getOwnerKey();
  var records = getRecords("FILES");
  return records.filter(function(r) {
    if (toBoolean(r.isDeleted)) return false;
    if (String(r.ownerKey) !== String(ownerKey)) return false;
    if (refType && String(r.refType) !== String(refType)) return false;
    if (refId && String(r.refId) !== String(refId)) return false;
    return true;
  });
}

// ===== Drive Upload =====

function getOrCreateAssetsFolder_() {
  var folderName = "thai-business-docs-assets";
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  var folder = DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function uploadImageToDrive(base64Data, mimeType, fileName) {
  if (!base64Data) throw new Error("No image data provided");
  // Strip data URI prefix if present
  var raw = base64Data;
  var commaIdx = raw.indexOf(",");
  if (commaIdx !== -1) {
    var header = raw.substring(0, commaIdx);
    // Extract mimeType from header if not provided
    if (!mimeType) {
      var m = header.match(/data:([^;]+)/);
      if (m) mimeType = m[1];
    }
    raw = raw.substring(commaIdx + 1);
  }
  mimeType = mimeType || "image/png";
  fileName = fileName || ("logo_" + Date.now() + ".png");

  var decoded = Utilities.base64Decode(raw);
  var blob = Utilities.newBlob(decoded, mimeType, fileName);

  var folder = getOrCreateAssetsFolder_();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  var url = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400";
  return { success: true, driveFileId: fileId, url: url };
}

function fetchImageBase64(url) {
  if (!url) return "";
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() !== 200) return "";
    var blob = response.getBlob();
    var mimeType = blob.getContentType() || "image/png";
    var base64 = Utilities.base64Encode(blob.getBytes());
    return "data:" + mimeType + ";base64," + base64;
  } catch (e) {
    Logger.log("fetchImageBase64 error: " + e.message);
    return "";
  }
}

function uploadCompanyLogoDrive(base64Data, mimeType, fileName) {
  var result = uploadImageToDrive(base64Data, mimeType, fileName);
  return result;
}

function uploadCompanyLogo(companyId, base64, mimeType, fileName) {
  var result = uploadFile({
    companyId: companyId,
    refType: "COMPANY_LOGO",
    refId: companyId,
    mimeType: mimeType || "image/png",
    name: fileName || "logo",
    url: base64 || ""
  });
  if (result.success) {
    updateEntityJson(companyId, { logoFileId: result.fileId }, "COMPANY");
  }
  return result;
}

function uploadProductImage(productId, base64, mimeType, fileName) {
  var result = uploadFile({
    refType: "PRODUCT_IMAGE",
    refId: productId,
    mimeType: mimeType || "image/png",
    name: fileName || "product",
    url: base64 || ""
  });
  if (result.success) {
    updateEntityJson(productId, { imageFileId: result.fileId }, "PRODUCT");
  }
  return result;
}
