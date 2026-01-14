"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const pdf_lib_1 = require("@pdfme/pdf-lib");
/**
 * Simple PDF/VT test - demonstrates DPart and OutputIntent functionality
 */
async function testPDFVT() {
    console.log('[TEST] Starting PDF/VT functionality test...');
    // Create a new PDF document
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    console.log('[TEST] Created PDF document');
    // Add a simple page
    const page = pdfDoc.addPage([612, 792]); // Standard letter size
    const fontSize = 12;
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
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
    }
    catch (error) {
        console.error('[TEST] Error with DPart:', error);
        throw error;
    }
    // Test XMP metadata for PDF/VT
    try {
        pdfDoc.setPDFVTXMP('1.0', 'PDF/VT-1');
        console.log('[TEST] Set PDF/VT XMP metadata');
    }
    catch (error) {
        console.error('[TEST] Error setting XMP:', error);
        throw error;
    }
    // Test OutputIntent with minimal ICC profile
    try {
        // Minimal ICC profile bytes (base64 decoded)
        const minimalICCBase64 = 'IyBNaW5pbWFsIHRlc3QgSUNDIHByb2ZpbGUgaGVhZGVyCiMgVGhpcyBpcyBhIHN0dWIgSUNDIHY0IHByb2ZpbGUgZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seQojIFJlYWwgcHJvZmlsZXMgc2hvdWxkIGJlIG9idGFpbmVkIGZyb20gY29sb3Iub3JnIG9yIHlvdXIgcHJpbnRlcgphY3NwCg==';
        const iccProfileBytes = new Uint8Array(Buffer.from(minimalICCBase64, 'base64'));
        pdfDoc.attachOutputIntent(iccProfileBytes, {
            OutputConditionIdentifier: 'Test Profile',
            S: 'GTS_PDFX',
        });
        console.log('[TEST] Attached OutputIntent with ICC profile');
    }
    catch (error) {
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
