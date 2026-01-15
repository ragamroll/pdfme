import fs from 'fs';
import path from 'path';
import generateSource from '../packages/generator/src/generate.ts';
import textSource from '../packages/schemas/src/text/index.ts';
import imageSource from '../packages/schemas/src/graphics/image.ts';
import * as barcodes from '../packages/schemas/src/barcodes/index.ts';

async function main() {
  // 1. Resolve Generator & Plugins
  // We handle both default and named exports to be safe in the monorepo
  const generate = typeof generateSource === 'function' ? generateSource : generateSource.default;
  
// Drill through the nested default exports
  let barcodeBundle = barcodes.default || barcodes;
  while (barcodeBundle.default && Object.keys(barcodeBundle).length === 1) {
    barcodeBundle = barcodeBundle.default;
  }

  // In some versions of pdfme, the barcode index exports 
  // an object where the key IS 'qrcode', in others it's 'barcodes'
  const qrcodePlugin = barcodeBundle.qrcode || 
                       barcodeBundle.qrCode || 
                       barcodeBundle.barcodes; // Added fallback

  if (!qrcodePlugin) {
    console.error('❌ Error: qrcode not found even after unwrapping.');
    console.log('Final available keys:', Object.keys(barcodeBundle));
    // If we see 'barcodes' in the keys, we might need to look inside THAT.
    process.exit(1);
  }

  const plugins = {
    text: textSource.default || textSource,
    image: imageSource.default || imageSource,
    qrcode: qrcodePlugin
  };

  // 2. Load External Files
  console.log('📂 Loading template.json and inputs.json...');
  
  // This ensures it looks in the same folder as render.mjs
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const templatePath = path.resolve(__dirname, 'template.json');
  const inputsPath = path.resolve(__dirname, 'inputs.json');

  if (!fs.existsSync(templatePath) || !fs.existsSync(inputsPath)) {
    console.error(`❌ Error: Files not found.`);
    console.error(`Looking in: ${__dirname}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(templatePath) || !fs.existsSync(inputsPath)) {
    console.error('❌ Error: template.json or inputs.json not found in the root directory.');
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf-8'));

  // 3. Execution
  console.log(`🚀 Generating PDF/VT with ${inputs.length} records...`);
  console.log('💡 Using internal helper for blank basePdf if template.basePdf is empty.');

  try {
    const pdf = await generate({ 
      template, 
      inputs, 
      plugins 
    });

    const outputPath = path.resolve(__dirname, 'output_vt.pdf');
    fs.writeFileSync(outputPath, pdf);

// 4. Binary Audit
    const buffer = Buffer.from(pdf);
    const pdfContent = buffer.toString('latin1');

    const hasDPartRoot = pdfContent.includes('/DPartRoot');
    const hasVTVersion = pdfContent.includes('pdfvt:version');
    
    // Count occurrences of your unique mapping key. 
    // It appears twice per record (once in the map, once in the node).
    const recordIDMatches = (pdfContent.match(/\/RecordID/g) || []).length;
    const recordCount = Math.floor(recordIDMatches / 2);

    console.log('\n====================================');
    console.log('      FINAL PDF/VT AUDIT LOG       ');
    console.log('====================================');
    console.log(`Document Structure:  ${hasDPartRoot ? '✅ DPartRoot Found' : '❌ DPartRoot Missing'}`);
    console.log(`ISO Compliance:      ${hasVTVersion ? '✅ VT Metadata Found' : '❌ VT Metadata Missing'}`);
    console.log(`Record Indexing:     ${recordCount === inputs.length ? '✅' : '⚠️'} ${recordCount} records for ${inputs.length} inputs`);
    console.log(`File Size:           ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`Output Location:     ${outputPath}`);
    console.log('====================================\n');

  } catch (err) {
    console.error('\n❌ PDF Generation Failed:');
    console.error(err);
    process.exit(1);
  }
}

main();