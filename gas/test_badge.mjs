import { JSDOM } from "jsdom";

// Create a DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <div id="docPreviewPrint">
        <!-- Simulate Page 1 -->
        <div class="doc-page">
          <div class="doc-badge"><span>สำเนา</span></div>
          <div class="doc-content">Page 1 Content</div>
        </div>
        <!-- Simulate Page 2 -->
        <div class="doc-page">
          <div class="doc-badge"><span>สำเนา</span></div>
          <div class="doc-content">Page 2 Content</div>
        </div>
        <!-- Simulate Page 3 (Shrunk) -->
        <div class="doc-page">
          <div class="doc-shrink-inner">
            <div class="doc-badge"><span>สำเนา</span></div>
            <div class="doc-content">Page 3 Content</div>
          </div>
        </div>
      </div>
    </body>
  </html>
`);

global.document = dom.window.document;

// Mock the pruning function used in prepareDocNode
global._pruneBlankTrailingPages = function() {};

// The actual function from js_preview.html
function prepareDocNode(choice) {
  var printContent = document.getElementById("docPreviewPrint");
  if (!printContent) return null;
  var printNode = printContent.cloneNode(true);
  printNode.style.transform = "none";
  printNode.style.transformOrigin = "top left";
  _pruneBlankTrailingPages(printNode);
  
  // Update all badges in the document to reflect "Original" or "Copy"
  var badges = printNode.querySelectorAll(".doc-badge");
  for (var i = 0; i < badges.length; i++) {
    if (choice === "original") {
      badges[i].innerHTML = '<span style="background: #dbeafe; color: #1e40af;">ต้นฉบับ</span>';
    } else {
      badges[i].innerHTML = '<span>สำเนา</span>';
    }
  }
  
  return printNode;
}

// Run Test
console.log("--- Testing 'original' choice ---");
let resultNode = prepareDocNode("original");
let badges = resultNode.querySelectorAll(".doc-badge");
let allPass = true;
badges.forEach((b, i) => {
  let text = b.textContent.trim();
  console.log(`Badge ${i + 1} text: "${text}"`);
  if (text !== "ต้นฉบับ") allPass = false;
});
console.log("Result: " + (allPass ? "PASS ✅" : "FAIL ❌"));

console.log("\n--- Testing 'copy' choice ---");
let resultNode2 = prepareDocNode("copy");
let badges2 = resultNode2.querySelectorAll(".doc-badge");
let allPass2 = true;
badges2.forEach((b, i) => {
  let text = b.textContent.trim();
  console.log(`Badge ${i + 1} text: "${text}"`);
  if (text !== "สำเนา") allPass2 = false;
});
console.log("Result: " + (allPass2 ? "PASS ✅" : "FAIL ❌"));

