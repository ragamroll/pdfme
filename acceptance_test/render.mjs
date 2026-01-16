import fs from 'fs';
import path from 'path';
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
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  
  // Accept template, inputs, output, and pdfvt config paths as command-line arguments
  // Usage: node render.mjs [templatePath] [inputsPath] [outputPath] [pdfvtConfigPath]
  // Default to template.json and inputs.json if not provided
  // Output name is auto-generated from template name if not provided
  // PDF/VT config defaults to pdfvt_config.json if not provided
  const templateFileName = process.argv[2] || 'template.json';
  const inputsFileName = process.argv[3] || 'inputs.json';
  const outputFileName = process.argv[4];
  const pdfvtConfigFileName = process.argv[5] || 'pdfvt-config.json';
  
  const templatePath = path.resolve(__dirname, templateFileName);
  const inputsPath = path.resolve(__dirname, inputsFileName);
  const pdfvtConfigPath = path.resolve(__dirname, pdfvtConfigFileName);
  
  console.log('📂 Loading files...');
  console.log(`   Template:   ${templateFileName}`);
  console.log(`   Inputs:     ${inputsFileName}`);
  console.log(`   PDF/VT Cfg: ${pdfvtConfigFileName}`);

  if (!fs.existsSync(templatePath) || !fs.existsSync(inputsPath) || !fs.existsSync(pdfvtConfigPath)) {
    console.error(`❌ Error: Files not found`);
    console.error(`   Template:   ${templatePath}`);
    console.error(`   Inputs:     ${inputsPath}`);
    console.error(`   PDF/VT Cfg: ${pdfvtConfigPath}`);
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
  const inputs = JSON.parse(fs.readFileSync(inputsPath, 'utf-8'));
  const pdfvtConfig = JSON.parse(fs.readFileSync(pdfvtConfigPath, 'utf-8'));
  
  // Generate output filename - use provided name or auto-generate from template name
  let outputPath;
  if (outputFileName) {
    outputPath = path.resolve(__dirname, outputFileName);
  } else {
    const templateBaseName = path.basename(templateFileName, path.extname(templateFileName));
    const generatedOutputFileName = `output_${templateBaseName}_vt.pdf`;
    outputPath = path.resolve(__dirname, generatedOutputFileName);
  }

  // 3. Execution
  console.log(`🚀 Generating PDF/VT with ${inputs.length} records...`);

  try {
    const pdf = await generate({ 
      template, 
      inputs, 
      plugins,
      options: {
        pdfvt: pdfvtConfig
      }
    });

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