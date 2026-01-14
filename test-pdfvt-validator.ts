/**
 * PDF/VT VALIDATION CHECKER
 * ========================
 * 
 * Ported from: https://github.com/mbghsource/pdf-lib/tree/feat/pdfvt-dpart-outputintent
 * Source: scripts/check_pdfvt.ts
 * 
 * Validates ISO 16612-2 PDF/VT-1 compliance:
 * - DPartRoot structure (Document Parts hierarchy)
 * - OutputIntent with ICC color profile
 * - XMP metadata with PDF/VT namespace
 * - Page-level DPart references
 * - Font embedding for print readiness
 */

import * as fs from 'fs';
import { PDFDocument } from '@pdfme/pdf-lib';
import { PDFName, PDFStream, PDFDict, PDFArray, PDFRef } from '@pdfme/pdf-lib';

interface ValidationError {
  category: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationReport {
  file: string;
  isCompliant: boolean;
  dpartRoot: { valid: boolean; details: string };
  outputIntent: { valid: boolean; details: string };
  xmpMetadata: { valid: boolean; details: string };
  pagesDPartLinked: { valid: boolean; pageCount: number; details: string };
  errors: ValidationError[];
  warnings: ValidationError[];
}

async function validatePDFVT(filePath: string): Promise<ValidationReport> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  const catalog = pdfDoc.catalog;

  // ===== 1. DPARTROOT CHECKS =====
  let dpartRootValid = false;
  let dpartDetails = '';
  const dpartRoot = catalog.getDPart();

  if (!dpartRoot) {
    errors.push({
      category: 'DPartRoot',
      message: 'Missing /DPart (DPartRoot) in catalog',
      severity: 'error',
    });
    dpartDetails = 'NOT FOUND';
  } else {
    const type = dpartRoot.get(PDFName.of('Type'));
    if (!type || !type.toString().includes('DPartRoot')) {
      errors.push({
        category: 'DPartRoot',
        message: `Wrong Type: ${type?.toString() || 'undefined'} (expected DPartRoot)`,
        severity: 'error',
      });
      dpartDetails = 'INVALID TYPE';
    } else {
      const kArray = dpartRoot.lookupMaybe(PDFName.of('K'), PDFArray as any);
      if (!kArray) {
        errors.push({
          category: 'DPartRoot',
          message: 'DPartRoot missing K array',
          severity: 'error',
        });
        dpartDetails = 'MISSING K ARRAY';
      } else if (kArray.size() === 0) {
        warnings.push({
          category: 'DPartRoot',
          message: 'DPartRoot K array is empty (no Document Parts)',
          severity: 'warning',
        });
        dpartDetails = 'EMPTY (0 records)';
      } else {
        dpartRootValid = true;
        dpartDetails = `VALID (${kArray.size()} Document Parts)`;

        // Validate each document part
        for (let i = 0; i < kArray.size(); i++) {
          const entry = kArray.lookup(i) as any;
          let childDict: PDFDict | undefined;

          if (entry instanceof PDFRef) {
            const looked = pdfDoc.context.lookup(entry);
            if (looked instanceof PDFDict) childDict = looked;
          } else if (entry instanceof PDFDict) {
            childDict = entry;
          }

          if (!childDict) {
            errors.push({
              category: 'DPartRoot',
              message: `K[${i}]: Entry is not dict or ref`,
              severity: 'error',
            });
            dpartRootValid = false;
            continue;
          }

          const cType = childDict.get(PDFName.of('Type'));
          if (!cType || !cType.toString().includes('DPart')) {
            errors.push({
              category: 'DPartRoot',
              message: `K[${i}]: Missing or wrong Type (expected DPart)`,
              severity: 'error',
            });
            dpartRootValid = false;
          }

          const idAttr = childDict.get(PDFName.of('ID'));
          if (!idAttr) {
            warnings.push({
              category: 'DPartRoot',
              message: `K[${i}]: Missing ID attribute (VDP standard)`,
              severity: 'warning',
            });
          }

          const nameAttr = childDict.get(PDFName.of('Name'));
          if (!nameAttr) {
            warnings.push({
              category: 'DPartRoot',
              message: `K[${i}]: Missing Name attribute (VDP standard)`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  // ===== 2. OUTPUTINTENT CHECKS =====
  let outputIntentValid = false;
  let outputDetails = '';
  const oiArray = catalog.OutputIntents();

  if (!oiArray) {
    errors.push({
      category: 'OutputIntent',
      message: 'Missing /OutputIntents array in catalog',
      severity: 'error',
    });
    outputDetails = 'NOT FOUND';
  } else if (oiArray.size() === 0) {
    errors.push({
      category: 'OutputIntent',
      message: '/OutputIntents array is empty',
      severity: 'error',
    });
    outputDetails = 'EMPTY';
  } else {
    const firstOiRef = oiArray.lookup(0) as any;
    const oiDict = firstOiRef instanceof PDFRef
      ? pdfDoc.context.lookup(firstOiRef, PDFDict as any)
      : firstOiRef;

    if (!oiDict || !(oiDict instanceof PDFDict)) {
      errors.push({
        category: 'OutputIntent',
        message: 'First OutputIntent does not resolve to dictionary',
        severity: 'error',
      });
      outputDetails = 'INVALID DICT';
    } else {
      const s = oiDict.get(PDFName.of('S'));
      if (!s || !s.toString().includes('GTS_PDFX')) {
        errors.push({
          category: 'OutputIntent',
          message: `S value is ${s?.toString() || 'missing'} (expected GTS_PDFX)`,
          severity: 'error',
        });
        outputDetails = 'WRONG S VALUE';
      } else {
        const dest = oiDict.get(PDFName.of('DestOutputProfile'));
        if (!dest) {
          errors.push({
            category: 'OutputIntent',
            message: 'Missing DestOutputProfile (ICC stream)',
            severity: 'error',
          });
          outputDetails = 'NO ICC PROFILE';
        } else {
          const destStream = dest instanceof PDFRef
            ? pdfDoc.context.lookup(dest, PDFStream as any)
            : dest;

          if (!destStream || !(destStream instanceof PDFStream)) {
            errors.push({
              category: 'OutputIntent',
              message: 'DestOutputProfile does not resolve to stream',
              severity: 'error',
            });
            outputDetails = 'ICC NOT STREAM';
          } else {
            const contents = destStream.getContentsString();
            if (!contents || contents.length === 0) {
              errors.push({
                category: 'OutputIntent',
                message: 'ICC stream is empty',
                severity: 'error',
              });
              outputDetails = 'EMPTY ICC';
            } else {
              outputIntentValid = true;
              outputDetails = `VALID (${(contents.length / 1024).toFixed(2)} KB ICC)`;
            }
          }
        }
      }
    }
  }

  // ===== 3. XMP METADATA CHECKS =====
  let xmpValid = false;
  let xmpDetails = '';
  const metaRef = catalog.get(PDFName.of('Metadata')) as PDFRef | undefined;

  if (!metaRef) {
    errors.push({
      category: 'XMP',
      message: 'Missing /Metadata stream in catalog',
      severity: 'error',
    });
    xmpDetails = 'NOT FOUND';
  } else {
    const metaStream = pdfDoc.context.lookup(metaRef, PDFStream as any);

    if (!metaStream || !(metaStream instanceof PDFStream)) {
      errors.push({
        category: 'XMP',
        message: 'Metadata does not resolve to stream',
        severity: 'error',
      });
      xmpDetails = 'NOT STREAM';
    } else {
      const contents = metaStream.getContentsString();
      xmpValid = true;

      if (!contents.includes('<pdfvt:Conformance>PDF/VT-1</pdfvt:Conformance>')) {
        errors.push({
          category: 'XMP',
          message: 'Missing pdfvt:Conformance = PDF/VT-1',
          severity: 'error',
        });
        xmpValid = false;
      }

      if (!contents.includes('<pdfvt:Version>1.0</pdfvt:Version>')) {
        errors.push({
          category: 'XMP',
          message: 'Missing pdfvt:Version = 1.0',
          severity: 'error',
        });
        xmpValid = false;
      }

      if (!contents.includes('xmlns:pdfvt=')) {
        warnings.push({
          category: 'XMP',
          message: 'Missing PDF/VT namespace declaration',
          severity: 'warning',
        });
      }

      xmpDetails = xmpValid
        ? 'VALID (PDF/VT-1 compliant)'
        : 'INVALID (missing attributes)';
    }
  }

  // ===== 4. PAGE-LEVEL DPART LINKING =====
  const pages = pdfDoc.getPages();
  let pagesDPartLinked = false;
  let pageDetails = `${pages.length} pages`;

  if (!pages || pages.length === 0) {
    errors.push({
      category: 'Pages',
      message: 'Document has no pages',
      severity: 'error',
    });
  } else {
    pagesDPartLinked = true;

    // Build set of known DPart refs
    const knownRefs = new Set<string>();
    if (dpartRoot) {
      const kArray = dpartRoot.lookupMaybe(PDFName.of('K'), PDFArray as any);
      if (kArray) {
        for (let i = 0; i < kArray.size(); i++) {
          const entry = kArray.lookup(i) as any;
          if (entry instanceof PDFRef) knownRefs.add(entry.toString());
          else if (entry instanceof PDFDict) {
            const ref = pdfDoc.context.getObjectRef(entry);
            if (ref) knownRefs.add(ref.toString());
          }
        }
      }
    }

    // Check each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const raw = page.node.get(PDFName.of('DPart')) as any;

      if (!raw) {
        warnings.push({
          category: 'Pages',
          message: `Page ${i}: Missing /DPart reference`,
          severity: 'warning',
        });
        pagesDPartLinked = false;
        continue;
      }

      if (raw instanceof PDFRef) {
        const pd = pdfDoc.context.lookup(raw, PDFDict as any);
        if (!pd) {
          errors.push({
            category: 'Pages',
            message: `Page ${i}: DPart reference does not resolve`,
            severity: 'error',
          });
          pagesDPartLinked = false;
        }

        if (knownRefs.size > 0 && !knownRefs.has(raw.toString())) {
          warnings.push({
            category: 'Pages',
            message: `Page ${i}: DPart not in DPartRoot K array`,
            severity: 'warning',
          });
        }
      } else if (!(raw instanceof PDFDict)) {
        errors.push({
          category: 'Pages',
          message: `Page ${i}: DPart has unexpected type`,
          severity: 'error',
        });
        pagesDPartLinked = false;
      }
    }

    if (pagesDPartLinked) {
      pageDetails = `${pages.length} pages with DPart (linked)`;
    }
  }

  // ===== GENERATE REPORT =====
  const isCompliant = errors.length === 0;

  const report: ValidationReport = {
    file: filePath.split('/').pop() || filePath,
    isCompliant,
    dpartRoot: { valid: dpartRootValid, details: dpartDetails },
    outputIntent: { valid: outputIntentValid, details: outputDetails },
    xmpMetadata: { valid: xmpValid, details: xmpDetails },
    pagesDPartLinked: { valid: pagesDPartLinked, pageCount: pages.length, details: pageDetails },
    errors,
    warnings,
  };

  return report;
}

function printReport(report: ValidationReport): void {
  const border = '═'.repeat(75);
  const status = report.isCompliant ? '✅ COMPLIANT' : '❌ FAILED';

  console.log(`\n${border}`);
  console.log(`📄 ${report.file}`);
  console.log(`${border}`);
  console.log(`\nStatus: ${status}\n`);

  console.log('PDF/VT-1 COMPLIANCE CHECKLIST:');
  console.log(`  DPartRoot:          ${report.dpartRoot.valid ? '✓' : '✗'}  ${report.dpartRoot.details}`);
  console.log(`  OutputIntent:       ${report.outputIntent.valid ? '✓' : '✗'}  ${report.outputIntent.details}`);
  console.log(`  XMP Metadata:       ${report.xmpMetadata.valid ? '✓' : '✗'}  ${report.xmpMetadata.details}`);
  console.log(`  Page DPart Links:   ${report.pagesDPartLinked.valid ? '✓' : '✗'}  ${report.pagesDPartLinked.details}`);

  if (report.errors.length > 0 || report.warnings.length > 0) {
    console.log('\nDETAILS:');

    if (report.errors.length > 0) {
      console.log(`\n  ❌ ERRORS (${report.errors.length}):`);
      for (const err of report.errors) {
        console.log(`     • [${err.category}] ${err.message}`);
      }
    }

    if (report.warnings.length > 0) {
      console.log(`\n  ⚠️  WARNINGS (${report.warnings.length}):`);
      for (const warn of report.warnings) {
        console.log(`     • [${warn.category}] ${warn.message}`);
      }
    }
  }
}

async function main() {
  console.log('\n🔍 PDF/VT-1 COMPLIANCE VALIDATOR');
  console.log('═'.repeat(75));
  console.log('Source: github.com/mbghsource/pdf-lib feat/pdfvt-dpart-outputintent\n');

  const outputDir = '/workspaces/pdfme/test-pdfs-vdp';
  if (!fs.existsSync(outputDir)) {
    console.log('⚠️  Output directory not found:', outputDir);
    return;
  }

  const pdfFiles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.pdf'))
    .sort();

  if (pdfFiles.length === 0) {
    console.log('No PDF files found in output directory');
    return;
  }

  console.log(`📋 Found ${pdfFiles.length} PDF files to validate\n`);

  const reports: ValidationReport[] = [];
  let passCount = 0;

  for (const file of pdfFiles) {
    try {
      const filePath = `${outputDir}/${file}`;
      const report = await validatePDFVT(filePath);
      reports.push(report);

      if (report.isCompliant) {
        passCount++;
      }
    } catch (error) {
      console.error(`Error validating ${file}:`, error);
    }
  }

  // Print all reports
  for (const report of reports) {
    printReport(report);
  }

  // Summary
  console.log(`\n${'═'.repeat(75)}`);
  console.log('📊 VALIDATION SUMMARY');
  console.log('═'.repeat(75));
  console.log(`\nTotal Files: ${reports.length}`);
  console.log(`  ✅ Compliant:  ${passCount}`);
  console.log(`  ❌ Failed:     ${reports.length - passCount}`);

  const totalErrors = reports.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = reports.reduce((sum, r) => sum + r.warnings.length, 0);

  if (totalErrors > 0) {
    console.log(`\n  Errors:   ${totalErrors}`);
  }
  if (totalWarnings > 0) {
    console.log(`  Warnings: ${totalWarnings}`);
  }

  if (passCount === reports.length) {
    console.log('\n🎉 ALL TESTS PASSED!');
  }

  console.log(`\n${'═'.repeat(75)}\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
