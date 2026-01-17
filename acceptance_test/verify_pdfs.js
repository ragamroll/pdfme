const fs = require('fs');
const { PDFDocument, PDFName, PDFArray } = require('@pdfme/pdf-lib');

(async () => {
  for (const pdf of ['singlepage.pdf', 'postcard.pdf', 'multipage.pdf']) {
    try {
      console.log(`\n=== ${pdf} ===`);
      const pdfBytes = fs.readFileSync(pdf);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Check Catalog contents
      const catalogDict = pdfDoc.catalog;
      console.log('Catalog has DPartRoot:', catalogDict.has(PDFName.of('DPartRoot')));
      console.log('Catalog has OutputIntents:', catalogDict.has(PDFName.of('OutputIntents')));
      console.log('Catalog has Metadata:', catalogDict.has(PDFName.of('Metadata')));
      
      // Try to get OutputIntents
      try {
        const outputIntentsRef = catalogDict.get(PDFName.of('OutputIntents'));
        console.log('OutputIntents value:', outputIntentsRef);
      } catch (e) {
        console.log('OutputIntents lookup error:', e.message);
      }
      
      // Check DPartRoot
      try {
        const dpartRoot = catalogDict.get(PDFName.of('DPartRoot'));
        console.log('DPartRoot value:', dpartRoot);
      } catch (e) {
        console.log('DPartRoot lookup error:', e.message);
      }
      
      // Check pages
      console.log('Total pages:', pdfDoc.getPageCount());
      
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
})();
