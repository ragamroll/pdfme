const fs = require('fs');
const { PDFDocument } = require('@pdfme/pdf-lib');

(async () => {
  for (const pdf of ['singlepage.pdf', 'postcard.pdf', 'multipage.pdf']) {
    try {
      console.log(`\n=== Loading ${pdf} ===`);
      const pdfBytes = fs.readFileSync(pdf);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      console.log(`✓ Loaded successfully`);
      console.log(`  Pages: ${pdfDoc.getPageCount()}`);
      console.log(`  Catalog keys:`, Array.from(pdfDoc.catalog.dict.keys()).map(k => k.name).join(', '));
    } catch (err) {
      console.log(`✗ Error loading ${pdf}:`);
      console.log(`  ${err.message}`);
      console.log(`  Stack:`, err.stack.split('\n').slice(0, 5).join('\n  '));
    }
  }
})();
