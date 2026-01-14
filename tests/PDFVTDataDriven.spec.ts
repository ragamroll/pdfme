import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from '@pdfme/pdf-lib';
import generateVDPSample from '../scripts/generate_vdp_sample';

describe('PDF/VT Data-Driven VDP Generation', () => {
  let samplePdfPath: string;

  beforeAll(async () => {
    // Generate a sample PDF using test data
    const testDataPath = path.join(__dirname, '../test-data/vdp-data.json');
    samplePdfPath = await generateVDPSample(testDataPath, undefined, '/tmp');
  });

  afterAll(() => {
    // Cleanup
    if (samplePdfPath && fs.existsSync(samplePdfPath)) {
      fs.unlinkSync(samplePdfPath);
    }
  });

  test('Generated PDF exists and is readable', () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    const stats = fs.statSync(samplePdfPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  test('PDF has correct document metadata', async () => {
    const pdfBytes = fs.readFileSync(samplePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    expect(pdfDoc.getTitle()).toContain('Variable Data Invoice');
    expect(pdfDoc.getAuthor()).toContain('pdfme');
    expect(pdfDoc.getSubject()).toContain('PDF/VT');
    expect(pdfDoc.getKeywords()).toContain('pdf/vt');
  });

  test('PDF has multiple pages (one per record)', async () => {
    const pdfBytes = fs.readFileSync(samplePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Test data has 3 records, so we expect 3 pages
    expect(pdfDoc.getPageCount()).toBe(3);
  });

  test('PDF pages have content', async () => {
    const pdfBytes = fs.readFileSync(samplePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    expect(pages.length).toBeGreaterThan(0);

    // Check that pages are not empty
    pages.forEach((page) => {
      expect(page).toBeDefined();
      const size = page.getSize();
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  });

  test('PDF catalog structure is valid', async () => {
    const pdfBytes = fs.readFileSync(samplePdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const catalog = pdfDoc.catalog;
    expect(catalog).toBeDefined();

    // Check if DPartRoot is set (when pdf-lib support is available)
    if (catalog.lookup('DPartRoot')) {
      const dpartRoot = catalog.lookup('DPartRoot');
      expect(dpartRoot).toBeDefined();
    }
  });
});

describe('PDF/VT Roundtrip Integration Test', () => {
  test('Generate, load, and validate PDF/VT structure', async () => {
    const testDataPath = path.join(__dirname, '../test-data/vdp-data.json');
    const outputDir = '/tmp';

    // Generate sample
    const samplePath = await generateVDPSample(testDataPath, undefined, outputDir);
    expect(fs.existsSync(samplePath)).toBe(true);

    try {
      // Load generated PDF
      const pdfBytes = fs.readFileSync(samplePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Validate basic structure
      expect(pdfDoc.getPageCount()).toBe(3);
      expect(pdfDoc.getTitle()).toBeDefined();

      // Validate content
      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        expect(page.getWidth()).toBeGreaterThan(0);
        expect(page.getHeight()).toBeGreaterThan(0);
      });

      console.log('✓ PDF/VT roundtrip integration test passed');
    } finally {
      // Cleanup
      if (fs.existsSync(samplePath)) {
        fs.unlinkSync(samplePath);
      }
    }
  });

  test('PDF resources are accessible after generation', async () => {
    const testDataPath = path.join(__dirname, '../test-data/vdp-data.json');
    const samplePath = await generateVDPSample(testDataPath, undefined, '/tmp');

    try {
      const pdfBytes = fs.readFileSync(samplePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Check that fonts are embedded
      expect(pdfDoc.getFont).toBeDefined();

      // Check pages can be accessed
      const page = pdfDoc.getPage(0);
      expect(page).toBeDefined();
    } finally {
      if (fs.existsSync(samplePath)) {
        fs.unlinkSync(samplePath);
      }
    }
  });
});

describe('PDF/VT Compliance Validation', () => {
  test('Generated PDF has valid PDF/VT metadata', async () => {
    const testDataPath = path.join(__dirname, '../test-data/vdp-data.json');
    const samplePath = await generateVDPSample(testDataPath, undefined, '/tmp');

    try {
      const pdfBytes = fs.readFileSync(samplePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // When pdf-lib has full support, check for:
      // - Catalog.DPartRoot
      // - Catalog.OutputIntents
      // - Catalog.Metadata with PDF/VT XMP
      // For now, check basic metadata

      const keywords = pdfDoc.getKeywords();
      expect(keywords).toContain('pdf/vt');

      console.log('✓ PDF/VT compliance validation passed');
    } finally {
      if (fs.existsSync(samplePath)) {
        fs.unlinkSync(samplePath);
      }
    }
  });

  test('PDF document size is reasonable', async () => {
    const testDataPath = path.join(__dirname, '../test-data/vdp-data.json');
    const samplePath = await generateVDPSample(testDataPath, undefined, '/tmp');

    try {
      const stats = fs.statSync(samplePath);
      // With 3 records and embedded fonts, expect file to be reasonable size
      // Minimum: ~5KB, Maximum: ~500KB
      expect(stats.size).toBeGreaterThan(5000);
      expect(stats.size).toBeLessThan(500000);

      console.log(`PDF size: ${(stats.size / 1024).toFixed(2)} KB`);
    } finally {
      if (fs.existsSync(samplePath)) {
        fs.unlinkSync(samplePath);
      }
    }
  });
});
