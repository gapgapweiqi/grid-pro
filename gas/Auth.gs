function getCurrentUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (email) return email;
  } catch (e) {}
  try {
    var email2 = Session.getEffectiveUser().getEmail();
    if (email2) return email2;
  } catch (e) {}
  return "";
}

function getOwnerKey() {
  // STABLE ownerKey: always the same for a given script instance.
  // Since each customer gets their own sheet (via Make a Copy),
  // ownerKey must be tied to the SCRIPT, not the user's email
  // (which is unreliable with executeAs:USER_ACCESSING + access:ANYONE).
  var props = getProductProps();
  var stableKey = props.getProperty("OWNER_KEY_STABLE");
  if (stableKey) return stableKey;

  // Generate stable key: prefer email if available, otherwise use scriptId
  var seed = "";
  try { seed = Session.getEffectiveUser().getEmail(); } catch(e) {}
  if (!seed) {
    try { seed = "script:" + ScriptApp.getScriptId(); } catch(e) {}
  }
  if (!seed) seed = "default:" + new Date().getTime();

  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
  stableKey = Utilities.base64EncodeWebSafe(digest);
  props.setProperty("OWNER_KEY_STABLE", stableKey);
  return stableKey;
}
