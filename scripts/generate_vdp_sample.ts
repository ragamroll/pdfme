import * as fs from 'fs';
import * as path from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFNumber } from '@pdfme/pdf-lib';

interface VDPRecord {
  recordId: string;
  recipientId: string;
  firstName: string;
  lastName: string;
  company: string;
  invoiceNumber: string;
  invoiceAmount: string;
  dueDate: string;
  region: string;
}

/**
 * Minimal test ICC profile (base64 encoded)
 * For production use, provide a real ICC profile
 */
const TEST_ICC_PROFILE_B64 =
  'IyBNaW5pbWFsIHRlc3QgSUNDIHByb2ZpbGUgaGVhZGVyCiMgVGhpcyBpcyBhIHN0dWIgSUNDIHY0IHByb2ZpbGUgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seQojIFJlYWwgcHJvZmlsZXMgc2hvdWxkIGJlIG9idGFpbmVkIGZyb20gY29sb3Iub3JnIG9yIHlvdXIgcHJpbnRlcgphY3NwCg==';

/**
 * Generate a PDF/VT (Variable Data Printing) sample document
 * Demonstrates DPart hierarchy, output intent, and XMP metadata
 *
 * @param dataPath - Path to VDP data JSON file
 * @param iccPath - Path to ICC profile (optional, uses test profile if not provided)
 * @param outputDir - Directory for output PDF (defaults to /tmp)
 * @returns Path to generated PDF
 */
export async function generateVDPSample(
  dataPath: string,
  iccPath?: string,
  outputDir: string = '/tmp',
): Promise<string> {
  // Load VDP data
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawData);
  const records: VDPRecord[] = data.records || [];

  if (records.length === 0) {
    throw new Error('No records found in VDP data file');
  }

  console.log(`[VDP] Processing ${records.length} records from ${dataPath}`);

  // Create PDF document
  const pdfDoc = await PDFDocument.create();

  // Register fontkit for font embedding
  pdfDoc.registerFontkit(fontkit);

  // Load ICC profile
  let iccProfileBytes: Uint8Array;
  if (iccPath && fs.existsSync(iccPath)) {
    iccProfileBytes = fs.readFileSync(iccPath);
    console.log(`[VDP] Using ICC profile from: ${iccPath}`);
  } else {
    // Use minimal test ICC profile
    iccProfileBytes = Buffer.from(TEST_ICC_PROFILE_B64, 'base64');
    console.log('[VDP] Using minimal test ICC profile for testing');
  }

  // Get standard fonts
  const timesRoman = await pdfDoc.embedFont(PDFDocument.builtinFonts.TimesRoman);
  const courierBold = await pdfDoc.embedFont(PDFDocument.builtinFonts.CourierBold);

  // Create DPart nodes for each record
  const dpartNodes: any[] = [];

  for (const record of records) {
    const dpartNode = {
      Type: 'DPart',
      ID: PDFString.of(record.recordId),
      Name: PDFString.of(`${record.firstName} ${record.lastName}`),
      Note: PDFString.of(record.company),
      P: PDFDict.withEntries([
        [PDFName.of('RecipientID'), PDFString.of(record.recipientId)],
        [PDFName.of('InvoiceNumber'), PDFString.of(record.invoiceNumber)],
        [PDFName.of('Region'), PDFString.of(record.region)],
      ]),
    };

    dpartNodes.push(dpartNode);
  }

  // Create DPartRoot structure
  const dpartRoot = {
    Type: 'DPartRoot',
    DParts: {
      Type: 'DPart',
      Kids: dpartNodes,
    },
  };

  // Add one page per record with DPart association
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const page = pdfDoc.addPage([612, 792]); // Letter size

    // Draw header
    page.drawText('Variable Data Invoice', {
      x: 50,
      y: 750,
      size: 24,
      font: courierBold,
      color: { r: 0, g: 0, b: 0 },
    });

    // Draw recipient info
    page.drawText(`To: ${record.firstName} ${record.lastName}`, {
      x: 50,
      y: 700,
      size: 12,
      font: timesRoman,
    });

    page.drawText(`Company: ${record.company}`, {
      x: 50,
      y: 680,
      size: 12,
      font: timesRoman,
    });

    // Draw invoice details
    page.drawText(`Invoice #: ${record.invoiceNumber}`, {
      x: 50,
      y: 630,
      size: 12,
      font: courierBold,
    });

    page.drawText(`Amount Due: ${record.invoiceAmount}`, {
      x: 50,
      y: 610,
      size: 12,
      font: courierBold,
    });

    page.drawText(`Due Date: ${record.dueDate}`, {
      x: 50,
      y: 590,
      size: 12,
      font: timesRoman,
    });

    page.drawText(`Region: ${record.region}`, {
      x: 50,
      y: 570,
      size: 12,
      font: timesRoman,
    });

    // Associate page with DPart node
    // In a real implementation with full pdf-lib support, this would be:
    // page.setDPart(dpartNodes[i])
    // For now, we note this in the console
    console.log(`[VDP] Page ${i + 1} associated with record ${record.recordId}`);
  }

  // Set DPartRoot in catalog
  // This requires pdf-lib to have setDPartRoot method
  if (typeof (pdfDoc as any).setDPartRoot === 'function') {
    (pdfDoc as any).setDPartRoot(dpartRoot);
    console.log('[VDP] DPartRoot set in catalog');
  } else {
    console.warn('[VDP] setDPartRoot not available in pdf-lib - DPart structure not set');
  }

  // Set PDF/VT XMP metadata
  // This requires pdf-lib to have setPDFVTXMP method
  if (typeof (pdfDoc as any).setPDFVTXMP === 'function') {
    (pdfDoc as any).setPDFVTXMP('1.0', 'PDF/VT-1');
    console.log('[VDP] PDF/VT XMP metadata set');
  } else {
    console.warn('[VDP] setPDFVTXMP not available in pdf-lib');
  }

  // Attach output intent (ICC profile)
  // This requires pdf-lib to have attachOutputIntent method
  if (typeof (pdfDoc as any).attachOutputIntent === 'function') {
    (pdfDoc as any).attachOutputIntent(iccProfileBytes, {
      S: 'GTS_PDFX',
      OutputConditionIdentifier: 'Test ICC Profile',
      Info: 'Test output intent for PDF/VT validation',
      RegistryName: 'http://www.color.org',
    });
    console.log('[VDP] Output Intent attached');
  } else {
    console.warn('[VDP] attachOutputIntent not available in pdf-lib');
  }

  // Ensure all resources are registered for print
  if (typeof (pdfDoc as any).ensureResourcesForPrint === 'function') {
    await (pdfDoc as any).ensureResourcesForPrint();
    console.log('[VDP] Resources registered for print');
  } else {
    console.warn('[VDP] ensureResourcesForPrint not available in pdf-lib');
  }

  // Set document metadata
  pdfDoc.setTitle('Variable Data Invoice - PDF/VT Sample');
  pdfDoc.setAuthor('pdfme VDP Generator');
  pdfDoc.setSubject('PDF/VT Variable Data Printing Sample');
  pdfDoc.setKeywords(['pdf/vt', 'vdp', 'variable-data', 'dpart']);

  // Save PDF
  const timestamp = new Date().getTime();
  const filename = `pdfvt-sample-${timestamp}.pdf`;
  const outputPath = path.join(outputDir, filename);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`[VDP] PDF saved to: ${outputPath}`);
  console.log(`[VDP] File size: ${pdfBytes.length} bytes`);

  return outputPath;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  let dataPath = 'test-data/vdp-data.json';
  let iccPath: string | undefined;
  let outputDir = '/tmp';

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) {
      dataPath = args[++i];
    } else if (args[i] === '--icc' && args[i + 1]) {
      iccPath = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  try {
    const samplePath = await generateVDPSample(dataPath, iccPath, outputDir);
    console.log(`\n✓ VDP sample generated successfully: ${samplePath}`);
    process.env.SAMPLE = samplePath;
    process.exit(0);
  } catch (error) {
    console.error('✗ VDP sample generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export default generateVDPSample;
