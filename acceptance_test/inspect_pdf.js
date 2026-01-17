const fs = require('fs');
const { PDFDocument, PDFName } = require('@pdfme/pdf-lib');

(async () => {
  const pdfBytes = fs.readFileSync('postcard.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const dpartRoot = pdfDoc.catalog.get(PDFName.of('DPartRoot'));
  
  console.log('Total Pages:', pages.length);
  console.log('DPartRoot exists:', !!dpartRoot);
  console.log('');
  
  pages.forEach((page, idx) => {
    const pageDict = page.node;
    try {
      // Just check if the node has DPart by looking at the raw dictionary
      const hasDPart = pageDict.has && pageDict.has(PDFName.of('DPart'));
      console.log(`Page ${idx}: DPart=${hasDPart ? 'YES' : 'NO'}`);
    } catch (e) {
      console.log(`Page ${idx}: Error checking DPart`);
    }
  });
})();
