import fs from 'fs';
import path from 'path';
// Use standard package names - Works if 'npm install' linked them
import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';

async function main() {
  // 1. Resolve Plugins
  // Simplified: Build outputs/Workspaces provide clean exports 
  // without needing the complex while-loop unwrapping
  const plugins = {
    text: text.default || text,
    image: image.default || image,
    qrcode: barcodes.qrcode || barcodes.default?.qrcode
  };

  // 2. Load External Files
  console.log('📂 Loading template.json and inputs.json...');
  
  // This ensures it looks in the same folder as render.mjs
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const templatePath = path.resolve(__dirname, 'template.json');
  const inputsPath = path.resolve(__dirname, 'inputs.json');

  if (!fs.existsSync(templatePath) || !fs.existsSync(inputsPath)) {
    console.error(`❌ Error: Files not found in: ${__dirname}`);
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf-8'));

  // 3. Execution
  console.log(`🚀 Generating PDF/VT with ${inputs.length} records...`);

  try {
    const pdf = await generate({ 
      template, 
      inputs, 
      plugins,
      options: {
        pdfvt: {
          enabled: true,
          mapping: { ContactName: 'name', RecordID: 'id', MemberCode: 'barcode' }
        }
      }
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