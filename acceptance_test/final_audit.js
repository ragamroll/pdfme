const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, PDFString } = require('@pdfme/pdf-lib');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.pdf'));
  let allTestsPassed = true;
  const summary = [];

  for (const pdfFile of files) {
    try {
      const testName = path.basename(pdfFile, '.pdf');
      const pdfPath = path.join(__dirname, pdfFile);
      const inputPath = path.join(__dirname, testName, 'inputs.json');

      let expectedCount = 0;
      if (fs.existsSync(inputPath)) {
        const inputs = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
        expectedCount = Array.isArray(inputs) ? inputs.length : 1;
      }

      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const catalog = pdfDoc.catalog;
      const context = pdfDoc.context;
      
      console.log(`\n📄 Auditing: ${pdfFile}`);
      console.log('─'.repeat(60));

      // 1. PDF/X Output Intent
      const oiRef = catalog.get(PDFName.of('OutputIntents'));
      const oiArray = oiRef ? context.lookup(oiRef) : null;
      const hasOI = oiArray instanceof PDFArray && oiArray.size() > 0;
      let hasOIDict = false, hasValidFormat = false;

      if (hasOI) {
        const intent = context.lookup(oiArray.get(0));
        if (intent instanceof PDFDict) {
          hasOIDict = intent.get(PDFName.of('S')) === PDFName.of('GTS_PDFX');
          hasValidFormat = intent.get(PDFName.of('OutputConditionIdentifier')) instanceof PDFString;
        }
      }

      // 2. Catalog Metadata
      const globalMetaRef = catalog.get(PDFName.of('Metadata'));
      let catalogHasXmpX = false;
      let catalogHasXmpVT = false;

      if (globalMetaRef) {
        const stream = context.lookup(globalMetaRef);
        if (stream instanceof PDFRawStream) {
          const text = new TextDecoder('utf-8').decode(stream.getContents());
          catalogHasXmpX = text.includes('GTS_PDFX') || text.includes('pdfx');
          catalogHasXmpVT = text.includes('GTS_PDFVT');
        }
      }

      // 3. DPart Tree Traversal (With Metadata Inheritance Check)
      let recordCount = 0;
      let recordsWithMetadata = 0;

      const traverse = (node, parentHasMeta = false) => {
        const resolvedNode = context.lookup(node);
        if (!(resolvedNode instanceof PDFDict)) return;

        const hasLocalMeta = resolvedNode.has(PDFName.of('Metadata'));
        const effectiveMeta = hasLocalMeta || parentHasMeta;

        // DPart tree uses /DParts exclusively (not /Children)
        const children = resolvedNode.get(PDFName.of('DParts'));
        
        if (children) {
          const res = context.lookup(children);
          if (res instanceof PDFArray) {
            for (let i = 0; i < res.size(); i++) traverse(res.get(i), effectiveMeta);
          }
        } else {
          recordCount++;
          if (effectiveMeta) recordsWithMetadata++;
        }
      };

      const dPartRootRef = catalog.get(PDFName.of('DPartRoot'));
      if (dPartRootRef) traverse(dPartRootRef);

      // 4. Compliance Logic
      const pdfxPass = !!(hasOI && hasOIDict && hasValidFormat && catalogHasXmpX);
      const vtPass = !!(dPartRootRef && catalogHasXmpVT && recordCount === expectedCount && recordsWithMetadata === recordCount);
      const isPass = pdfxPass && vtPass;
      
      if (!isPass) allTestsPassed = false;

      console.log('PDF/X-4 (Object-Level):');
      console.log(`  ✓ Catalog -> OutputIntents:    ${hasOI ? '✅' : '❌'}`);
      console.log(`  ✓ Catalog -> Metadata (PDF/X): ${catalogHasXmpX ? '✅' : '❌'}`);
      console.log(`  ✓ Intent Dictionary Valid:     ${hasOIDict ? '✅' : '❌'}`);
      
      console.log('\nPDF/VT-1 (Object-Level):');
      console.log(`  ✓ Catalog -> DPartRoot:        ${!!dPartRootRef ? '✅' : '❌'}`);
      console.log(`  ✓ Catalog -> Metadata (VT):    ${catalogHasXmpVT ? '✅' : '❌'}`);
      console.log(`  ✓ DPart Tree Record Count:     ${recordCount === expectedCount ? '✅' : '❌'} (${recordCount}/${expectedCount})`);
      console.log(`  ✓ Record-Level Metadata:       ${recordsWithMetadata === recordCount ? '✅' : '❌'} (${recordsWithMetadata}/${recordCount} records)`);
      
      console.log(`\nCompliance: [${isPass ? '✅ FULLY COMPLIANT' : '❌ NON-COMPLIANT'}]`);
      summary.push(`${pdfFile}: ${isPass ? '✅' : '❌'}`);

    } catch (err) {
      console.error(`❌ Audit Error [${pdfFile}]:`, err.message);
      allTestsPassed = false;
    }
  }

  console.log('\n' + '═'.repeat(60) + '\nSUMMARY:');
  summary.forEach(line => console.log(`  ${line}`));
  process.exit(allTestsPassed ? 0 : 1);
})();