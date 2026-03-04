// ===== Context Injection for Library Mode =====
// เมื่อถูกเรียกจาก Product (container-bound script) จะ inject
// PropertiesService ของ Product เข้ามา เพื่อให้ Library อ่าน/เขียน
// properties ของลูกค้า (SHEETS_ID, OWNER_KEY_STABLE, sequences ฯลฯ)
// ถ้าไม่ได้ inject → fallback ไป Library's own properties (standalone mode)

var _productProps = null;

function setProductProps(props) {
  _productProps = props;
}

function getProductProps() {
  return _productProps || PropertiesService.getScriptProperties();
}

function isLibraryMode() {
  return _productProps !== null;
}
