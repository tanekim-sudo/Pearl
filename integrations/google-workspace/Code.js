function onOpen() {
  DocumentApp.getUi().createAddonMenu().addItem("Insert Lens result", "showLensSidebar").addToUi();
}

function onInstall() {
  onOpen();
}

function showLensSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("Lens result");
  DocumentApp.getUi().showSidebar(html);
}

function insertLensResult(text) {
  const value = String(text || "");
  if (!value || value.length > 120000) throw new Error("Paste a Lens result up to 120,000 characters.");
  const cursor = DocumentApp.getActiveDocument().getCursor();
  if (!cursor) throw new Error("Place the cursor in the document first.");
  const inserted = cursor.insertText(value);
  if (!inserted) throw new Error("Google Docs cannot insert at this cursor location.");
  return { inserted: value.length };
}
