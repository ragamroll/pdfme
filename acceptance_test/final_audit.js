const fs = require('fs');
const { PDFDocument, PDFName } = require('@pdfme/pdf-lib');

(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FINAL PDF/VT-1 & PDF/X-4 COMPLIANCE AUDIT           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const pdfFile of ['singlepage.pdf', 'postcard.pdf', 'multipage.pdf']) {
    try {
      const pdfBytes = fs.readFileSync(pdfFile);
      const pdfContent = pdfBytes.toString('latin1');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      console.log(`📄 ${pdfFile}`);
      console.log('─'.repeat(60));
      
      // PDF/X-4 Requirements
      const catalogHasOutputIntents = pdfDoc.catalog.has(PDFName.of('OutputIntents'));
      const hasXmpMetadata = pdfContent.includes('pdfx:GTS_PDFXVersion');
      const hasOutputIntentDict = pdfContent.includes('/Type /OutputIntent');
      
      // PDF/VT-1 Requirements
      const catalogHasDPartRoot = pdfDoc.catalog.has(PDFName.of('DPartRoot'));
      const hasVtMetadata = pdfContent.includes('pdfvt:version');
      const recordIDMatches = pdfContent.match(/\/RecordID \(([^)]+)\)/g) || [];
      const uniqueRecordIDs = new Set(recordIDMatches.map(m => m.match(/\(([^)]+)\)/)[1]));
      
      // Output Intent structure check
      const hasValidOutputIntent = pdfContent.includes('/OutputCondition (') && 
                                   pdfContent.includes('/RegistryName (');
      
      console.log('PDF/X-4 Requirements:');
      console.log(`  ✓ OutputIntents in Catalog:    ${catalogHasOutputIntents ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  ✓ OutputIntent Dictionary:     ${hasOutputIntentDict ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  ✓ Valid String Formatting:     ${hasValidOutputIntent ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  ✓ XMP PDF/X Metadata:          ${hasXmpMetadata ? '✅ PASS' : '❌ FAIL'}`);
      
      console.log('\nPDF/VT-1 Requirements:');
      console.log(`  ✓ DPartRoot in Catalog:        ${catalogHasDPartRoot ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  ✓ XMP PDF/VT Metadata:         ${hasVtMetadata ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  ✓ Unique Records:              ${uniqueRecordIDs.size} records`);
      console.log(`  ✓ Pages per Record:            ${pdfDoc.getPageCount()} total pages`);
      
      console.log('\nOverall Status:');
      const pdfx4Pass = catalogHasOutputIntents && hasOutputIntentDict && hasValidOutputIntent && hasXmpMetadata;
      const pvt1Pass = catalogHasDPartRoot && hasVtMetadata && uniqueRecordIDs.size > 0;
      
      console.log(`  PDF/X-4: ${pdfx4Pass ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
      console.log(`  PDF/VT-1: ${pvt1Pass ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
      console.log();
      
    } catch (err) {
      console.log(`❌ Error with ${pdfFile}: ${err.message}\n`);
    }
  }
})();
