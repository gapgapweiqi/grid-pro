function nowIso() {
  return new Date().toISOString();
}

function safeString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function toBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  var text = safeString(value).toLowerCase().trim();
  return text === "true" || text === "1" || text === "yes" || text === "on";
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback || null;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback || null;
  }
}

function roundMoney(value) {
  var numeric = Number(value || 0);
  return Math.round(numeric * 100) / 100;
}

function padNumber(value, length) {
  var text = safeString(value);
  while (text.length < length) {
    text = "0" + text;
  }
  return text;
}

function csvEscape(value) {
  var text = safeString(value);
  if (text.indexOf('"') !== -1) {
    text = text.replace(/"/g, '""');
  }
  if (/[",\n]/.test(text)) {
    text = '"' + text + '"';
  }
  return text;
}
