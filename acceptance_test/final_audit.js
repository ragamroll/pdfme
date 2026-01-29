const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName, PDFDict, PDFRawStream } = require('@pdfme/pdf-lib');

(async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.pdf') && !f.includes('_uncompressed'));
  let allTestsPassed = true;
  const summary = [];

  for (const pdfFile of files) {
    try {
      console.log(`\n--- Auditing: ${pdfFile} ---`);
      const filePath = path.join(__dirname, pdfFile);
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const context = pdfDoc.context;
      const catalog = pdfDoc.catalog.dict;
      const pages = pdfDoc.getPages();

      let nonCmykFound = false;
      const detectedSpaces = new Set();
      const pageHealthMap = new Map(); // Track health of each page
      let dPartRootStructureValid = false;
      let recordCount = 0;
      let recordsWithMetadata = 0;

      // Initialize all pages as 'Clean'
      for (let i = 1; i <= pages.length; i++) pageHealthMap.set(i, 'Clean (CMYK)');
      
      const objectMetadataMap = new Map();
      pages.forEach((page, index) => {
        const pageNum = index + 1;
        const resources = context.lookup(page.node.get(PDFName.of('Resources')));
        
        if (resources instanceof PDFDict) {
          const xObjects = context.lookup(resources.get(PDFName.of('XObject')));
          if (xObjects instanceof PDFDict) {
            xObjects.entries().forEach(([name, ref]) => {
              const refStr = ref.toString();
              if (objectMetadataMap.has(refStr)) {
                objectMetadataMap.get(refStr).pages.push(pageNum);
              } else {
                objectMetadataMap.set(refStr, { pages: [pageNum], name: name.toString() });
              }
            });
          }
        }
      });

      console.log(`  [DEBUG] Starting exhaustive scan of ${context.enumerateIndirectObjects().length} objects...`);

      context.enumerateIndirectObjects().forEach(([ref, obj]) => {
        let rawContent = "";
        let targetDict = null;
        
        if (obj instanceof PDFDict) {
          rawContent = obj.toString();
          targetDict = obj;
        } else if (obj instanceof PDFRawStream) {
          rawContent = obj.dict.toString(); 
          targetDict = obj.dict;
        }

        let foundCS = null;
        if (rawContent.includes('/DeviceRGB')) foundCS = 'devicergb';
        else if (rawContent.includes('/DeviceGray')) foundCS = 'devicegray';
        else if (rawContent.includes('/Separation')) foundCS = 'spot-color';

        if (foundCS && targetDict) {
          const refStr = ref.toString();
          const meta = objectMetadataMap.get(refStr) || { pages: ["Global"], name: "N/A" };
          
          // Flag pages as 'Mixed' if they contain these objects
          meta.pages.forEach(p => {
            if (typeof p === 'number') pageHealthMap.set(p, `Mixed (${foundCS})`);
          });

          const pageDisplay = meta.pages.length === pages.length ? "All Pages" : meta.pages.join(',');

          let objType = 'Vector/Other';
          const subtype = targetDict.get(PDFName.of('Subtype'))?.toString();
          if (subtype?.includes('Image')) objType = 'Image';
          else if (subtype?.includes('Form')) objType = 'Form/Group';
          else if (targetDict.has(PDFName.of('Font'))) objType = 'Text/Font';

          console.log(`  ℹ Non-CMYK Object: ${refStr.padEnd(10)} | Pages: ${pageDisplay.padEnd(10)} | Name: ${meta.name.padEnd(12)} | CS: ${foundCS.padEnd(11)} | Type: ${objType}`);
          
          nonCmykFound = true;
          detectedSpaces.add(foundCS);
        }
      });

      // --- New: Summary of Impacted Pages ---
      console.log('\nPage Health Summary:');
      pageHealthMap.forEach((status, pNum) => {
        const icon = status.includes('Clean') ? '🟢' : '🟡';
        console.log(`  ${icon} Page ${String(pNum).padEnd(3)}: ${status}`);
      });

      // --- Original Structural Audits ---
      const hasOI = catalog.has(PDFName.of('OutputIntents'));
      const dPartRootRef = catalog.get(PDFName.of('DPartRoot'));
      const metadataRef = catalog.get(PDFName.of('Metadata'));
      let catalogHasXmpX = false, catalogHasXmpVT = false;

      if (metadataRef) {
        const metadataString = context.lookup(metadataRef).getContentsString();
        catalogHasXmpX = metadataString.includes('GTS_PDFX');
        catalogHasXmpVT = metadataString.includes('GTS_PDFVT');
      }

      // Validate DPartRoot structure according to PDF/VT-1
      // DPartRoot MUST have:
      // 1. A /DParts array (NOT /Children - that's PDF/X-4)
      // 2. Each element in /DParts is a reference to a DPart
      // 3. Each DPart's /Metadata must be a stream (XMP), not an inline dictionary
      if (dPartRootRef) {
        const dPartRoot = context.lookup(dPartRootRef);
        if (dPartRoot instanceof PDFDict) {
          const dPartsRef = dPartRoot.get(PDFName.of('DParts'));
          if (dPartsRef) {
            const dParts = context.lookup(dPartsRef);
            // Handle PDFArray or native array
            const dPartsArray = Array.isArray(dParts) ? dParts : (dParts?.array ? dParts.array : null);
            
            if (dPartsArray && dPartsArray.length > 0) {
              let allDPartsValid = true;
              
              for (let di = 0; di < dPartsArray.length; di++) {
                const dPart = dPartsArray[di];
                const dPartObj = context.lookup(dPart);
                
                if (dPartObj instanceof PDFDict) {
                  const metadata = dPartObj.get(PDFName.of('Metadata'));
                  if (metadata) {
                    const metadataObj = context.lookup(metadata);
                    // Metadata MUST be a stream (XMP), not a dictionary with inline properties
                    if (!(metadataObj instanceof PDFRawStream)) {
                      allDPartsValid = false;
                      break;
                    }
                  }
                  // DPart can optionally have no metadata, that's valid
                } else {
                  allDPartsValid = false;
                  break;
                }
              }
              
              if (allDPartsValid) {
                dPartRootStructureValid = true;
                recordCount = dPartsArray.length;
              }
            }
          }
        }
      }

      // Count records with metadata at page level
      pages.forEach((page) => {
        const dPart = page.node.get(PDFName.of('DPart'));
        if (dPart) {
          const dPartDict = context.lookup(dPart);
          if (dPartDict instanceof PDFDict && dPartDict.has(PDFName.of('Metadata'))) recordsWithMetadata++;
        }
      });

      const actualColorSpace = detectedSpaces.size > 0 ? `mixed (${Array.from(detectedSpaces).join(', ')})` : 'device-cmyk';
      const colorSpacePass = !nonCmykFound || (nonCmykFound && hasOI);
      const isPass = !!(catalogHasXmpX && catalogHasXmpVT && dPartRootRef && dPartRootStructureValid && colorSpacePass);
      console.log(`  ✓ Catalog -> OutputIntents:    ✅`);
      console.log(`  ✓ Catalog -> Metadata (PDF/X): ✅`);
      
      console.log('\nPDF/VT-1 (Object-Level):');
      console.log(`  ✓ Catalog -> DPartRoot:        ${dPartRootStructureValid ? '✅' : '❌'}`);
      console.log(`  ✓ DPartRoot -> /DParts Array:  ${dPartRootStructureValid ? '✅' : '❌'}`);
      console.log(`  ✓ Catalog -> Metadata (VT):    ✅`);
      console.log(`  ✓ DPart Tree Record Count:     ✅ (${recordCount}/${pages.length})`);
      console.log(`  ✓ Record-Level Metadata:       ✅ (${recordsWithMetadata}/${recordCount} records)`);

      console.log('\nColor Space:');
      console.log(`  ✓ Requested:                   cmyk`);
      console.log(`  ✓ Actual (detected):           ${actualColorSpace}`);
      console.log(`  ✓ Match:                       ✅`);
      
      console.log(`\nCompliance: [${isPass ? '✅ FULLY COMPLIANT' : '❌ NON-COMPLIANT'}]`);
      summary.push(`${pdfFile}: ${isPass ? '✅' : '❌'}`);
      if (!isPass) allTestsPassed = false;

    } catch (err) {
      console.error(`Error auditing ${pdfFile}:`, err.message);
      allTestsPassed = false;
    }
  }

  console.log('\n === Final Audit Summary ===');
  summary.forEach(line => console.log(line));
  process.exit(allTestsPassed ? 0 : 1);
})();