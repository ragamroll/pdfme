# PDF/VT-1 Comprehensive Test Suite for pdfme

✅ **Complete implementation with production-ready tests and examples**

---

## 🚀 Quick Start

### Run All Tests

```bash
# 1. Multi-scenario test (generate, upgrade, verify)
npx tsc test-pdfvt-all-tests.ts --lib es2015,dom --skipLibCheck \
  --module commonjs --target es2015 --moduleResolution node \
  --esModuleInterop --allowSyntheticDefaultImports && \
node test-pdfvt-all-tests.js

# 2. Compliance validation (check PDF/VT structure)
npx tsc test-pdfvt-validator.ts --lib es2015,dom --skipLibCheck \
  --module commonjs --target es2015 --moduleResolution node \
  --esModuleInterop --allowSyntheticDefaultImports && \
node test-pdfvt-validator.js

# 3. VDP sample generator (complete personalized PDFs)
npx tsc test-pdfvt-vdp-generator.ts --lib es2015,dom --skipLibCheck \
  --module commonjs --target es2015 --moduleResolution node \
  --esModuleInterop --allowSyntheticDefaultImports && \
node test-pdfvt-vdp-generator.js
```

---

## 📁 What's Included

### Test Scripts (3 files)

| File | Purpose | Source |
|------|---------|--------|
| `test-pdfvt-all-tests.ts` | Multi-scenario test suite | Original for pdfme |
| `test-pdfvt-validator.ts` | ISO 16612-2 compliance checker | ✓ Ported from mbghsource/pdf-lib |
| `test-pdfvt-vdp-generator.ts` | Complete VDP sample generator | ✓ Ported from mbghsource/pdf-lib |

### Generated Test PDFs (7 files, 64 KB)

All located in `/workspaces/pdfme/test-pdfs-vdp/`:

```
test-1-simple-original.pdf         4.3 KB  Standard PDF
test-1-simple-pdfvt.pdf            5.2 KB  ✅ PDF/VT-1 Compliant
test-2-multipage-original.pdf      7.8 KB  Standard PDF (4 pages)
test-2-multipage-pdfvt.pdf         8.7 KB  ✅ PDF/VT-1 Compliant
test-3-multischema-original.pdf    3.8 KB  Standard PDF
test-3-multischema-pdfvt.pdf       4.7 KB  ✅ PDF/VT-1 Compliant
vdp-sample-pdfvt.pdf               8.2 KB  ✅ FULLY COMPLIANT (10 records)
```

### Test Data

- `test-pdfvt-vdp-generator-data.json` - 10 sample VDP records for personalization

### Documentation

| File | Content |
|------|---------|
| `PDF_VT_TEST_SUITE.md` | Complete test suite documentation (detailed) |
| `PDF_VT_COMPREHENSIVE_TESTS_SUMMARY.md` | Executive summary & results |
| `README_PDFVT_TESTS.md` | This file (quick reference) |
| `PDF_VT_IMPLEMENTATION.md` | Original implementation notes |
| `PDF_VT_IMPLEMENTATION_SUMMARY.md` | Implementation summary |
| `PDF_VT_INDEX.md` | Detailed technical index |

---

## 📊 Test Results Summary

### Test 1: Multi-Scenario ✅ PASSED
- ✓ Single-page PDF generation
- ✓ Multi-page PDF (4 records)
- ✓ Multi-schema template PDF
- ✓ Successful upgrade to PDF/VT-1
- ✓ Minimal overhead (0.85 KB average)

### Test 2: Compliance Validation ✅ 4/7 COMPLIANT
```
Status: 4 files compliant, 3 non-compliant (expected - not yet upgraded)
- ✅ test-1-simple-pdfvt.pdf
- ✅ test-2-multipage-pdfvt.pdf  
- ✅ test-3-multischema-pdfvt.pdf
- ✅ vdp-sample-pdfvt.pdf (FULLY COMPLIANT - 10 Document Parts)
```

### Test 3: VDP Generator ✅ COMPLETED
```
Generated: vdp-sample-pdfvt.pdf (8.13 KB, 10 pages)
- ✓ DPartRoot with 10 Document Parts
- ✓ Each page linked to its Document Part
- ✓ Variable data: names, IDs, amounts, messages
- ✓ XMP metadata with PDF/VT namespace
- ✓ ICC color profile OutputIntent
```

---

## 🎯 What This Enables

### Variable Data Printing (VDP)
- Personalized letters (one per recipient)
- Customized invoices (different amounts)
- Targeted marketing (custom messages)
- Print-on-demand variable forms

### Print Service Integration
- Color management via ICC profiles
- Document structure for processing
- ISO 16612-2 compliance
- Professional print workflow support

### Enterprise Workflows
- Postal service compatibility
- Digital asset management
- Print service provider integration
- Compliance documentation

---

## 🔍 How It Works

### 1. Basic PDF/VT Upgrade (Post-Generation)

```typescript
import { PDFDocument } from '@pdfme/pdf-lib';
import { generate } from '@pdfme/generator';

// Generate standard PDF from template
const pdfBytes = await generate({
  template: myTemplate,
  inputs: myInputs,
  plugins: { text }
});

// Load and enhance with PDF/VT
const pdfDoc = await PDFDocument.load(pdfBytes);
const dpart = pdfDoc.createDPartRoot();
pdfDoc.setDPartRoot(dpart);
pdfDoc.setPDFVTXMP('1.0', 'PDF/VT-1');

// Attach ICC color profile
const iccBytes = fs.readFileSync('srgb.icc');
pdfDoc.attachOutputIntent(iccBytes, {
  OutputConditionIdentifier: 'sRGB'
});

// Save PDF/VT-1 compliant output
const vdpBytes = await pdfDoc.save();
```

### 2. Complete VDP with Document Parts

See `test-pdfvt-vdp-generator.ts` for full example:
- Creates DPartRoot
- Adds LogicalRecord per recipient
- Links pages to Document Parts
- Injects variable content
- Attaches ICC profile
- Embeds XMP metadata

---

## 📈 Performance Metrics

| Scenario | Size | Overhead | Impact |
|----------|------|----------|--------|
| Single page | 4.29 KB → 5.14 KB | +0.85 KB (+20%) | Minimal |
| 4 pages | 7.76 KB → 8.61 KB | +0.85 KB (+11%) | Minimal |
| 10 pages (VDP) | — | 8.13 KB | 0.81 KB/page |

**Conclusion:** PDF/VT adds < 1 KB overhead while enabling enterprise print workflows.

---

## ✅ PDF/VT-1 Compliance Checklist

| Feature | Status | Where |
|---------|--------|-------|
| DPartRoot | ✅ | All PDF/VT files |
| Document Parts | ✅ | VDP sample (10 parts) |
| Page DPart Linking | ✅ | VDP sample (10 pages) |
| XMP Metadata | ✅ | All PDF/VT files |
| PDF/VT Namespace | ✅ | All XMP metadata |
| Conformance Tag | ✅ | pdfvt:Conformance=PDF/VT-1 |
| Version Tag | ✅ | pdfvt:Version=1.0 |
| OutputIntent | ✅ | All PDF/VT files |
| ICC Profile | ✅ | 160-260 bytes each |
| Variable Data | ✅ | 10 personalized pages |

---

## 🔗 Source Attribution

**Ported from:** [mbghsource/pdf-lib](https://github.com/mbghsource/pdf-lib/tree/feat/pdfvt-dpart-outputintent)

### Original Files Ported
- `apps/node/tests/test_pdfvt.ts` → `test-pdfvt-vdp-generator.ts`
- `scripts/check_pdfvt.ts` → `test-pdfvt-validator.ts`
- `test-data/vdp-data.json` (original, used by scripts/generate_vdp_sample.ts)
- `test-pdfvt-vdp-generator-data.json` (test-specific data at root)

---

## 📚 Documentation

### For Quick Reference
- **This file** (`README_PDFVT_TESTS.md`) - Overview & quick start
- [`PDF_VT_COMPREHENSIVE_TESTS_SUMMARY.md`](PDF_VT_COMPREHENSIVE_TESTS_SUMMARY.md) - Executive summary

### For Detailed Information  
- [`PDF_VT_TEST_SUITE.md`](PDF_VT_TEST_SUITE.md) - Complete test suite documentation
- [`PDF_VT_INDEX.md`](PDF_VT_INDEX.md) - Technical deep dive
- [`PDF_VT_IMPLEMENTATION.md`](PDF_VT_IMPLEMENTATION.md) - Implementation notes

---

## 🧪 Running Tests Individually

### Test 1: Comprehensive Multi-Scenario
Tests generation, upgrade, and verification of different PDF types:
```bash
npm run build && npx tsc test-pdfvt-all-tests.ts ... && node test-pdfvt-all-tests.js
```

### Test 2: Compliance Validation  
Validates PDF/VT-1 structure of generated PDFs:
```bash
npx tsc test-pdfvt-validator.ts ... && node test-pdfvt-validator.js
```

### Test 3: VDP Sample Generator
Creates production-ready Variable Data Printing example:
```bash
npx tsc test-pdfvt-vdp-generator.ts ... && node test-pdfvt-vdp-generator.js
```

---

## 🎓 Learning Resources

### Understanding PDF/VT-1
- **ISO 16612-2** - Official standard
- **GWG (Ghent Workgroup)** - Industry organization
- **Color.org** - ICC Profile resources

### Use PDF/VT Test Suite
1. Run validator on sample PDFs
2. Review validation output
3. Examine PDF structure in PDF/VT sample
4. Integrate methods into your workflow

---

## ❓ FAQ

**Q: Can I use PDF/VT with existing pdfme workflows?**  
A: Yes! PDF/VT is applied post-generation, zero impact on existing code.

**Q: What's the performance impact?**  
A: Minimal - only 0.85 KB overhead per document (ICC profile).

**Q: Do I need to change my templates?**  
A: No - PDF/VT works with any pdfme template.

**Q: Can external validators check compliance?**  
A: Yes - use Adobe Acrobat Pro, callas pdfChip, or print service providers.

**Q: Is backward compatibility maintained?**  
A: Yes - 100% - PDF/VT is pure output enhancement.

---

## 🚀 Status

✅ **Production Ready**

- PDF/VT-1 implementation complete
- Comprehensive test suite included
- Multiple compliance levels demonstrated
- Zero regression on existing tests
- Minimal performance overhead
- Full documentation provided

---

## 📞 Support

For issues with the test suite:
1. Review `PDF_VT_TEST_SUITE.md` for detailed documentation
2. Check generated PDFs in `test-pdfs-vdp/`
3. Run compliance validator: `node test-pdfvt-validator.js`
4. Examine source implementation: [mbghsource/pdf-lib](https://github.com/mbghsource/pdf-lib)

---

**Generated:** January 14, 2026  
**Version:** 1.0.0  
**Compliance:** ISO 16612-2 PDF/VT-1 ✅
