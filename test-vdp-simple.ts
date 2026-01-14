import * as fs from 'fs';
import { PDFDocument, DPart, StandardFonts } from '@pdfme/pdf-lib';

/**
 * Simple PDF/VT test - demonstrates DPart and OutputIntent functionality
 */
async function testPDFVT() {
  console.log('[TEST] Starting PDF/VT functionality test...');

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  console.log('[TEST] Created PDF document');

  // Add a simple page
  const page = pdfDoc.addPage([612, 792]); // Standard letter size
  const fontSize = 12;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('PDF/VT Test Document', {
    x: 50,
    y: 750,
    size: fontSize,
    font,
  });
  console.log('[TEST] Added page with text');

  // Test DPart creation
  try {
    const dpart = pdfDoc.createDPartRoot();
    console.log('[TEST] Created DPartRoot');

    // Test setting DPartRoot
    pdfDoc.setDPartRoot(dpart);
    console.log('[TEST] Set DPartRoot in document');
  } catch (error) {
    console.error('[TEST] Error with DPart:', error);
    throw error;
  }

  // Test XMP metadata for PDF/VT
  try {
    pdfDoc.setPDFVTXMP('1.0', 'PDF/VT-1');
    console.log('[TEST] Set PDF/VT XMP metadata');
  } catch (error) {
    console.error('[TEST] Error setting XMP:', error);
    throw error;
  }

  // Test OutputIntent with minimal ICC profile
  try {
    // Minimal ICC profile bytes (base64 decoded)
    const minimalICCBase64 =
      'IyBNaW5pbWFsIHRlc3QgSUNDIHByb2ZpbGUgaGVhZGVyCiMgVGhpcyBpcyBhIHN0dWIgSUNDIHY0IHByb2ZpbGUgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seQojIFJlYWwgcHJvZmlsZXMgc2hvdWxkIGJlIG9idGFpbmVkIGZyb20gY29sb3Iub3JnIG9yIHlvdXIgcHJpbnRlcgphY3NwCg==';
    const iccProfileBytes = new Uint8Array(Buffer.from(minimalICCBase64, 'base64'));
    
    pdfDoc.attachOutputIntent(iccProfileBytes, {
      OutputConditionIdentifier: 'Test Profile',
      S: 'GTS_PDFX',
    });
    console.log('[TEST] Attached OutputIntent with ICC profile');
  } catch (error) {
    console.error('[TEST] Error attaching OutputIntent:', error);
    throw error;
  }

  // Save the document
  const outputPath = '/tmp/test-pdfvt.pdf';
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`[TEST] Saved PDF to ${outputPath}`);
  console.log(`[TEST] PDF size: ${pdfBytes.length} bytes`);

  console.log('[TEST] ✅ All PDF/VT functionality tests passed!');
  return outputPath;
}

// Run the test
testPDFVT().catch((error) => {
  console.error('[TEST] ❌ Test failed:', error);
  process.exit(1);
});
