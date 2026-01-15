import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bwipjs from 'bwip-js';

// Resolve paths relative to this script in the acceptance_test folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates a USPS Intelligent Mail Barcode (IMb)
 * Returns a Base64 PNG Data URI for maximum compatibility with pdfme
 */
async function generateImbPng(payload) {
  // Payload must be 20, 25, 29, or 31 digits
  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'onecode',       // USPS Intelligent Mail Barcode
    text: payload,
    scale: 4,              // High resolution for print
    height: 4.5,           // Standard USPS height in mm
    includetext: false,
  });
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

async function main() {
  const templatePath = path.join(__dirname, 'postcard_template.json');
  const inputsPath = path.join(__dirname, 'postcard_inputs.json');
  const outputPath = path.join(__dirname, 'output_postcard_imb.pdf');

  try {
    // 1. Load local files
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    const rawInputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));

    // 2. Process inputs and inject Barcodes
    const inputs = await Promise.all(rawInputs.map(async (record) => {
      // 20-digit placeholder: BarcodeID(2) + Service(3) + MailerID(6) + Serial(9)
      const imbPayload = "01234123456123456789"; 
      const imbDataUri = await generateImbPng(imbPayload);
      
      return {
        ...record,
        "imb_barcode": imbDataUri
      };
    }));

    // 3. Generate PDF with required plugins
    const pdf = await generate({
      template,
      inputs,
      plugins: {
        text,
        image,
        qrcode: barcodes.qrcode
      }
    });

    // 4. Save output
    fs.writeFileSync(outputPath, pdf);
    console.log(`\x1b[32m🚀 Success! PDF generated at: ${outputPath}\x1b[0m`);
    
  } catch (error) {
    console.error('\x1b[31m❌ Generation Failed:\x1b[0m', error.message);
    if (error.message.includes('onecode')) {
      console.log('💡 Tip: Ensure the payload is exactly 20, 25, 29, or 31 digits.');
    }
  }
}

main();