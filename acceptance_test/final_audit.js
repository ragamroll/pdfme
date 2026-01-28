const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFRawStream, PDFString } = require('@pdfme/pdf-lib');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.pdf'));
  let allTestsPassed = true;
  const summary = [];

  // Helper function to detect color space in PDF content streams
  const detectColorSpace = (pdfDoc) => {
    let foundCMYK = false;
    let foundRGB = false;

    for (let pageIndex = 0; pageIndex < pdfDoc.getPageCount(); pageIndex++) {
      try {
        const page = pdfDoc.getPage(pageIndex);
        const contents = page.node.get(PDFName.of('Contents'));
        if (!contents) continue;

        const context = pdfDoc.context;
        const resolved = context.lookup(contents);
        
        const streamList = resolved instanceof PDFArray 
          ? Array.from({length: resolved.size()}, (_, i) => context.lookup(resolved.get(i)))
          : [resolved];

        for (const stream of streamList) {
          if (!(stream instanceof PDFRawStream)) continue;
          
          let contentBytes = stream.getContents();
          let contentText = '';
          
          // Try to decompress if FlateDecode
          try {
            contentText = zlib.inflateSync(contentBytes).toString('latin1');
          } catch (e) {
            // If decompression fails, treat as raw
            contentText = Buffer.from(contentBytes).toString('latin1');
          }
          
          // Look for CMYK 'k' operator: pattern like "0 0 0 1 k"
          // The key is finding the 'k' byte (0x6B) or 'K' byte (0x4B) preceded by 4 numbers/decimals
          if (/0[\s\n]+0[\s\n]+0[\s\n]+1[\s\n]+[kK][\s\n]/.test(contentText) || 
              /[0-9][\s\n]+[0-9][\s\n]+[0-9][\s\n]+[0-9][\s\n]+[kK][\s\n]/.test(contentText)) {
            foundCMYK = true;
          }
          
          // Look for RGB 'rg' operator: pattern like "0 0 0 rg"
          if (/0[\s\n]+0[\s\n]+0[\s\n]+[rR][gG][\s\n]/.test(contentText)) {
            foundRGB = true;
          }
        }
      } catch (err) {
        // Skip pages that can't be read
      }
    }

    // If CMYK is found in any content stream, report CMYK (it's the primary color space for text/graphics)
    // RGB in images doesn't override the color space setting
    if (foundCMYK) return 'CMYK';
    if (foundRGB) return 'RGB';
    return 'UNKNOWN';
  };

  for (const pdfFile of files) {
    try {
      const testName = path.basename(pdfFile, '.pdf');
      const pdfPath = path.join(__dirname, pdfFile);
      const inputPath = path.join(__dirname, testName, 'inputs.json');
      const templatePath = path.join(__dirname, testName, 'template.json');

      let expectedCount = 0;
      if (fs.existsSync(inputPath)) {
        const inputs = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
        expectedCount = Array.isArray(inputs) ? inputs.length : 1;
      }

      let requestedColorSpace = 'RGB'; // Default to RGB
      if (fs.existsSync(templatePath)) {
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        if (template.dpartOptions?.colorSpace) {
          requestedColorSpace = template.dpartOptions.colorSpace;
        }
      }

      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const catalog = pdfDoc.catalog;
      const context = pdfDoc.context;
      
      const actualColorSpace = detectColorSpace(pdfDoc);
      
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

      // 4. Color Space Validation
      const colorSpaceMatch = actualColorSpace === requestedColorSpace;

      // 5. Compliance Logic
      const pdfxPass = !!(hasOI && hasOIDict && hasValidFormat && catalogHasXmpX);
      const vtPass = !!(dPartRootRef && catalogHasXmpVT && recordCount === expectedCount && recordsWithMetadata === recordCount);
      const colorSpacePass = colorSpaceMatch;
      const isPass = pdfxPass && vtPass && colorSpacePass;
      
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

      console.log('\nColor Space:');
      console.log(`  ✓ Requested:                   ${requestedColorSpace}`);
      console.log(`  ✓ Actual (detected):           ${actualColorSpace}`);
      console.log(`  ✓ Match:                       ${colorSpacePass ? '✅' : '❌'}`);
      
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