import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bwipjs from 'bwip-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extracts a 5-digit zip code from an address string
 */
function extractZip(address) {
  const match = address.match(/\b\d{5}\b/);
  return match ? match[0] : "00000"; // Fallback if no zip found
}

/**
 * Generates IMb PNG Data URI
 */
async function generateImbPng(zip) {
  // IMb Structure: BarcodeID(2) + ServiceType(3) + MailerID(6) + Serial(4) + Zip(5)
  // Total must be exactly 20 digits for this configuration
  const payload = `007001234567890${zip}`; 
  
  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'onecode',
    text: payload,
    scale: 4,
    height: 4.5,
    includetext: false,
  });
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

async function main() {
  const templatePath = path.join(__dirname, 'postcard_template.json');
  const inputsPath = path.join(__dirname, 'postcard_inputs.json');
  const outputPath = path.join(__dirname, 'output_postcard_imb.pdf');

  try {
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    const rawInputs = JSON.parse(fs.readFileSync(inputsPath, 'utf8'));

    const inputs = await Promise.all(rawInputs.map(async (record) => {
      const zip = extractZip(record.address_line1);
      const imbDataUri = await generateImbPng(zip);
      
      return {
        ...record,
        "imb_barcode": imbDataUri
      };
    }));

    const pdf = await generate({
      template,
      inputs,
      plugins: { text, image, qrcode: barcodes.qrcode }
    });

    fs.writeFileSync(outputPath, pdf);
    console.log(`🚀 Success! Generated ${inputs.length} unique postcards.`);
    
  } catch (error) {
    console.error('❌ Generation Failed:', error.message);
  }
}

main();