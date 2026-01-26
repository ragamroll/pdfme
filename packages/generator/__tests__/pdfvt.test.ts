import generate from '../src/generate.js';
import { Template, Schema, BLANK_PDF } from '@pdfme/common';
import { getFont } from './utils.js';

const textObject = (x: number, y: number, name: string = 'a'): Schema => ({
  name,
  type: 'text',
  content: '',
  position: { x, y },
  width: 100,
  height: 100,
  fontSize: 13,
  fontColor: '#000000',
  fontName: 'NotoSerifJP-Regular',
});

describe('PDF/VT Support', () => {
  describe('generate with PDF/VT enabled', () => {
    it('should generate PDF with DPartRoot and pdfvt:version metadata', async () => {
      // Template with basePdf
      const template: Template = {
        basePdf: BLANK_PDF,
        schemas: [[textObject(0, 0, 'invoiceNumber'), textObject(25, 25, 'customerName')]],
        dpartOptions: {
          enabled: true,
          version: 'PDF/VT-1',
          mapping: {
            InvoiceNumber: 'invoiceNumber',
            CustomerName: 'customerName',
          },
          outputIntent: {
            profileName: 'Coated FOGRA39',
            registryName: 'http://www.color.org',
          },
        },
      };

      const inputs = [
        { invoiceNumber: 'INV-001', customerName: 'John Doe' },
        { invoiceNumber: 'INV-002', customerName: 'Jane Smith' },
      ];

      const pdf = await generate({
        template,
        inputs,
        options: {
          font: await getFont(),
        },
      });

      // Verify the output is a Uint8Array
      expect(pdf).toBeInstanceOf(Uint8Array);

      // Convert PDF bytes to string to check for DPartRoot and pdfvt:version
      const pdfString = new TextDecoder('latin1').decode(pdf);

      // Verify DPartRoot is present in the PDF
      expect(pdfString).toContain('/DPartRoot');

      // Verify pdfvt:version is present in the XMP metadata
      expect(pdfString).toContain('pdfvt:version');
      expect(pdfString).toContain('PDF/VT-1');

      // Verify output intent is present
      expect(pdfString).toContain('GTS_PDFX');
    });

    it('should work with blank PDF when no basePdf is provided', async () => {
      const template: Template = {
        basePdf: BLANK_PDF,
        schemas: [[textObject(0, 0, 'field1')]],
        dpartOptions: {
          enabled: true,
          version: 'PDF/VT-1',
          mapping: {
            Field1: 'field1',
          },
        },
      };

      const inputs = [{ field1: 'Test Value' }];

      // This should not throw an error about "Cannot read properties of undefined (reading Pages)"
      const pdf = await generate({
        template,
        inputs,
        options: {
          font: await getFont(),
        },
      });

      expect(pdf).toBeInstanceOf(Uint8Array);
      expect(pdf.length).toBeGreaterThan(0);

      const pdfString = new TextDecoder('latin1').decode(pdf);
      expect(pdfString).toContain('/DPartRoot');
      expect(pdfString).toContain('pdfvt:version');
    });

    it('should support multiple records with DPart metadata mapping', async () => {
      const template: Template = {
        basePdf: BLANK_PDF,
        schemas: [[textObject(0, 0, 'invoiceId'), textObject(30, 30, 'amount')]],
        dpartOptions: {
          enabled: true,
          version: 'PDF/VT-1',
          mapping: {
            InvoiceId: 'invoiceId',
            Amount: 'amount',
          },
        },
      };

      const inputs = [
        { invoiceId: 'INV-100', amount: '$1000' },
        { invoiceId: 'INV-101', amount: '$2000' },
        { invoiceId: 'INV-102', amount: '$3000' },
      ];

      const pdf = await generate({
        template,
        inputs,
        options: {
          font: await getFont(),
        },
      });

      expect(pdf).toBeInstanceOf(Uint8Array);

      const pdfString = new TextDecoder('latin1').decode(pdf);
      expect(pdfString).toContain('/DPartRoot');
      expect(pdfString).toContain('pdfvt:version');
    });
  });
});
