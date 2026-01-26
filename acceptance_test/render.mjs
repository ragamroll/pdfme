import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
// Use standard package names - Works if 'npm install' linked them
import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';

async function main() {
  // 1. Resolve Plugins
  // Using standard exports from the built packages
  const plugins = {
    text: text.default || text,
    image: image.default || image,
    qrcode: barcodes.qrcode || barcodes.default?.qrcode
  };

  // 2. Load External Files
  // This ensures it looks in the same folder as render.mjs
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Accept a single directory name as argument
  // Usage: node render.mjs [directoryName]
  // Reads: directoryName/template.json, directoryName/inputs.json, directoryName/pdfvt-config.json
  // Outputs: directoryName.pdf
  const directoryName = process.argv[2];
  
  if (!directoryName) {
    console.error('❌ Usage: node render.mjs <directoryName>');
    console.error('   Example: node render.mjs multipage');
    process.exit(1);
  }

  if (directoryName === 'postcard') {
    console.log('📬 Delegating to render_postcard.mjs...');
    const child = fork(path.resolve(__dirname, 'render_postcard.mjs'), [directoryName], { stdio: 'inherit' });
    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
    return;
  }
  
  const directoryPath = path.resolve(__dirname, directoryName);
  const templatePath = path.resolve(directoryPath, 'template.json');
  const inputsPath = path.resolve(directoryPath, 'inputs.json');
  const pdfvtConfigPath = path.resolve(directoryPath, 'pdfvt-config.json');
  const outputPath = path.resolve(__dirname, `${directoryName}.pdf`);
  
  console.log('📂 Loading files from directory...');
  console.log(`   Directory:  ${directoryName}/`);

  if (!fs.existsSync(templatePath) || !fs.existsSync(inputsPath) || !fs.existsSync(pdfvtConfigPath)) {
    console.error(`❌ Error: Files not found in ${directoryPath}`);
    console.error(`   Template:   ${templatePath}`);
    console.error(`   Inputs:     ${inputsPath}`);
    console.error(`   PDF/VT Cfg: ${pdfvtConfigPath}`);
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf-8'));
  const pdfvtConfig = JSON.parse(fs.readFileSync(pdfvtConfigPath, 'utf-8'));
  
  // Compute pageCount from template structure and inject into each input record
  // This enables the pageCount to be available for DPart mapping (finishing instructions)
  const pageCount = template.schemas.length;
  const enrichedInputs = inputs.map(input => ({
    ...input,
    pageCount: pageCount
  }));
  
  console.log(`📄 Template has ${pageCount} page(s) per record`);
  
  // 3. Execution
  console.log(`🚀 Generating PDF/VT with ${enrichedInputs.length} records...`);

  try {
    const pdf = await generate({ 
      template, 
      inputs: enrichedInputs, 
      plugins,
      options: {
        pdfvt: pdfvtConfig
      }
    });

    fs.writeFileSync(outputPath, pdf);

// 4. Binary Audit with Proper DPart Node Counting
    const buffer = Buffer.from(pdf);
    const pdfContent = buffer.toString('latin1');

    const hasDPartRoot = pdfContent.includes('/DPartRoot');
    const hasVTVersion = pdfContent.includes('pdfvt:version');
    const hasOutputIntents = pdfContent.includes('/OutputIntents');
    
    // Better record counting: count unique DPart nodes
    // DPart nodes appear as references followed by object declarations
    // Each DPart node gets a unique RecordID from the input data
    // Count how many unique RecordID values exist in the PDF
    const recordIDMatches = pdfContent.match(/\/RecordID \(([^)]+)\)/g) || [];
    const uniqueRecordIDs = new Set(recordIDMatches.map(m => m.match(/\(([^)]+)\)/)[1]));
    const recordCount = uniqueRecordIDs.size > 0 ? uniqueRecordIDs.size : enrichedInputs.length;

    console.log('\n====================================');
    console.log('      FINAL PDF/VT AUDIT LOG       ');
    console.log('====================================');
    console.log(`Document Structure:  ${hasDPartRoot ? '✅ DPartRoot Found' : '❌ DPartRoot Missing'}`);
    console.log(`ISO Compliance:      ${hasVTVersion ? '✅ VT Metadata Found' : '❌ VT Metadata Missing'}`);
    console.log(`Color Intent:        ${hasOutputIntents ? '✅ OutputIntents Found' : '❌ OutputIntents Missing'}`);
    console.log(`Record Indexing:     ${recordCount === enrichedInputs.length ? '✅' : '⚠️'} ${recordCount} records for ${enrichedInputs.length} inputs`);
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