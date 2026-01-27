# PDF/VT Acceptance Tests

This directory contains acceptance tests for **PDF/VT-1** and **PDF/X-4** compliance validation in the pdfme generator.

## Overview

The acceptance tests verify that the pdfme generator produces valid PDF/VT-1 (Variable Data) and PDF/X-4 (Print Exchange) compliant documents. These standards are critical for professional variable data printing and print-on-demand services.

## Test Cases

### 1. **singlepage** - Single-Page Records
- **Pages per Record**: 1
- **Total Records**: 3 (Alice Smith, Bob Jones, Charlie Brown)
- **Total Pages**: 3
- **Purpose**: Validates basic PDF/VT-1 structure with one page per recipient

**Files:**
- `singlepage/template.json` - Template with single-page schema
- `singlepage/inputs.json` - Input data for 3 recipients
- Generated: `singlepage.pdf`

### 2. **postcard** - Multi-Page Records (Front & Back)
- **Pages per Record**: 2 (front and back)
- **Total Records**: 2 (Praveen, Mani)
- **Total Pages**: 4
- **Purpose**: Validates DPart grouping for duplex printing (front/back pages grouped per recipient)

**Files:**
- `postcard/template.json` - Two-page postcard template with GRACoL 2006 color profile
- `postcard/inputs.json` - Input data for 2 recipients
- Generated: `postcard.pdf`

### 3. **multipage** - Multi-Page Letter Records
- **Pages per Record**: 2 (cover + details)
- **Total Records**: 3 (Alice, Bob, Charlie)
- **Total Pages**: 6
- **Purpose**: Validates multi-page variable data documents with correct record grouping

**Files:**
- `multipage/template.json` - Two-schema template (page 1: name/id/photo, page 2: contact info)
- `multipage/inputs.json` - Input data for 3 recipients
- Generated: `multipage.pdf`

## Running the Tests

### Run All Acceptance Tests
```bash
npm run test:vt
```

This command:
1. Builds the project
2. Generates all three test PDFs
3. Runs the compliance audit on each PDF
4. Reports which PDFs are compliant with PDF/VT-1 and PDF/X-4 standards
5. Exits with code 0 if all tests pass, code 1 if any fail

### Run Individual Tests
```bash
# Generate a single test PDF
node acceptance_test/render.mjs singlepage
node acceptance_test/render.mjs postcard
node acceptance_test/render.mjs multipage

# Run compliance audit only
node acceptance_test/final_audit.js
```

## Key Files

### `render.mjs`
Main test runner script. Accepts a directory name as argument and:
1. Loads `template.json`, `inputs.json`, and `pdfvt-config.json` from the directory
2. Computes `pageCount` from template structure
3. Injects `pageCount` into each input record (for DPart mapping)
4. Generates the PDF using the pdfme generator
5. Outputs a PDF named `<directory>.pdf`
6. Performs basic audit (DPartRoot check, VT metadata check, record count validation)

**Usage:**
```bash
node render.mjs <directoryName>
```

### `final_audit.js`
Comprehensive PDF/VT-1 and PDF/X-4 compliance auditor. Checks:

**PDF/X-4 Requirements:**
- ✓ `/OutputIntents` array properly linked to Document Catalog
- ✓ OutputIntent dictionary with correct structure
- ✓ String values properly formatted (not converted to Names)
- ✓ XMP metadata includes `pdfx:GTS_PDFXVersion`

**PDF/VT-1 Requirements:**
- ✓ `/DPartRoot` present in Document Catalog for document part hierarchy
- ✓ XMP metadata includes `pdfvt:version`
- ✓ Unique RecordID values match input records
- ✓ DPart nodes created and assigned to pages

**Output:**
Detailed compliance report for each PDF with overall status and exit code.

## Manual Verification

- Upload the generated pdf to https://pdfux.com/inspect-pdf/

- Expand the **Root** tree so that **DPartRoot**, **OutputIntents** and **Pages** are visible.

- Run the following code as a bookmarklet in your chrome browser
```javascript
javascript:(async function(){const wait=ms=>new Promise(r=>setTimeout(r,ms));const visitedRefs=new Set();async function expandNode(div){const header=div.querySelector(':scope > .inspect-node-elem');if(!header)return false;const expandBtn=header.querySelector('span[id$="-expand"]');if(expandBtn&&window.getComputedStyle(expandBtn).display!=='none'){expandBtn.click();await wait(700);return true;}return false;}async function walkAndExpand(currentDataId){const currentDiv=document.querySelector(`div[data-id="${currentDataId}"]`);if(!currentDiv)return;const header=currentDiv.querySelector(':scope > .inspect-node-elem');if(!header)return;/* EXTRACT THE PDF REFERENCE (e.g., '4 0 R') */const refMatch=header.innerText.match(/Indirect reference:\s*(\d+\s+\d+\s+R)/);if(refMatch){const ref=refMatch[1];if(visitedRefs.has(ref))return;/* STOP if we've already expanded this object */visitedRefs.add(ref);}await expandNode(currentDiv);const children=Array.from(currentDiv.querySelectorAll(`:scope > div[data-id^="${currentDataId}-"]`));for(const child of children){const text=child.innerText;const childId=child.getAttribute('data-id');if(text.includes('Dictionary')||text.includes('Array')||text.includes('Metadata')||text.includes('Indirect reference')){await walkAndExpand(childId);}}}const targets=['DPartRoot','OutputIntents','Pages'];const nodes={};for(const name of targets){const header=Array.from(document.querySelectorAll('.inspect-node-elem')).find(el=>el.innerText.includes(name));if(header){console.log(`Expanding ${name}...`);await walkAndExpand(header.parentElement.getAttribute('data-id'));nodes[name]=header.parentElement.cloneNode(true);}}await wait(1500);const htmlContent=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reference-Safe Audit</title><style>body{font-family:monospace;background:#202124;color:#bdc1c6;padding:20px;}.inspect-node-elem{display:flex;align-items:center;padding:2px 0;}div[data-id]{border-left:1px solid #3c4043;padding-left:15px;}.h{color:#8ab4f8;margin-top:25px;border-bottom:1px solid #333;}</style></head><body>${targets.map(name=>%60<h2 class="h">${name}</h2>${nodes[name]?nodes[name].outerHTML:'<p>Not Found</p>'}%60).join('')}</body></html>%60;const blob=new Blob([htmlContent],{type:'text/html'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='pdf_vt_audit_ref_safe.html';link.click();})();
```
## Test Configuration

Each test directory contains:

### `template.json`
Defines the PDF structure:
- `basePdf` - Blank PDF dimensions or custom PDF
- `schemas` - Array of page schemas (array-of-arrays for multi-page)
- `dpartOptions` - PDF/VT configuration:
  - `enabled: true` - Enable PDF/VT support
  - `version: "PDF/VT-1"` - Target version
  - `outputIntent` - Color profile configuration:
    - `profileName` - Profile identifier (e.g., "GRACoL2006_Coated1v2")
    - `registryName` - Registry URL (e.g., "http://www.color.org")
    - `info` - Profile description
  - `mapping` - Maps DPart metadata keys to input fields:
    - `"ContactName": "name"` - DPart field to input field
    - `"RecordID": "id"` - Unique identifier per record
    - `"PageCount": "pageCount"` - Pages per record

### `inputs.json`
Array of input objects, one per record. Example:
```json
[
  {
    "name": "Alice Smith",
    "id": "001",
    "barcode": "https://example.com/001",
    "photo": "base64:...",
    "email": "alice@example.com"
  }
]
```

Fields are rendered into the template schemas based on schema field names.

### `pdfvt-config.json`
Optional - currently not used (mapping is read from `template.dpartOptions`).

## Compliance Criteria

### PDF/VT-1 Compliance
A document is PDF/VT-1 compliant when:
1. ✅ Document Catalog contains `/DPartRoot` entry
2. ✅ XMP metadata declares `pdfvt:version`
3. ✅ DPart nodes are created and linked to document pages
4. ✅ DPart metadata contains correct field mappings
5. ✅ Pages are properly grouped by record

### PDF/X-4 Compliance
A document is PDF/X-4 compliant when:
1. ✅ Document Catalog contains `/OutputIntents` array
2. ✅ OutputIntent dictionary includes:
   - `/Type /OutputIntent`
   - `/S /GTS_PDFX` (subtype)
   - `/OutputCondition` (string, not name)
   - `/OutputConditionIdentifier` (string)
   - `/RegistryName` (string with ICC profile registry)
   - `/Info` (optional string description)
3. ✅ XMP metadata declares `pdfx:GTS_PDFXVersion`
4. ✅ All string values in OutputIntent are properly formatted (parentheses, not forward slashes)

## Implementation Details

### How PDF/VT Support Works

1. **Template Configuration** (`dpartOptions`)
   - User configures PDF/VT settings in template
   - Specifies color profile and field mappings

2. **PDF Generation** (generator package)
   - Creates DPartRoot in PDF Catalog
   - Generates XMP metadata with PDF/VT and PDF/X declarations
   - For each input record:
     - Creates a DPart node with metadata fields
     - Assigns DPart node to all pages in the record
   - Calls `pdfDoc.setOutputIntent()` if profile config provided

3. **PDF Structure** (pdf-lib package)
   - `setXMP()` - Registers XMP stream in Catalog
   - `setOutputIntent()` - Creates OutputIntent dictionary and registers it
   - Properly links OutputIntents array to Catalog via reference
   - Uses `PDFString` for string values to prevent Name conversion

### DPart Grouping

For multi-page records (e.g., postcard with front/back):
- Generator creates ONE DPart node per input
- Assigns that node to ALL pages generated from that input
- Pages 1-2 share DPart node 1
- Pages 3-4 share DPart node 2
- This groups related pages together for duplex printing

## Troubleshooting

### "OutputIntents Missing" Error
**Cause:** Template's `dpartOptions.outputIntent` not configured
**Fix:** Add outputIntent config to template's dpartOptions with profileName and registryName

### Record Count Mismatch
**Cause:** DPart nodes not properly created or assigned
**Fix:** Ensure template.schemas is array-of-arrays, and each input maps to correct number of pages

### Pages Not Grouped
**Cause:** DPart nodes created separately for each page
**Fix:** Verify generator logic assigns single DPart node to all pagesForInput

### Acrobat Reader Can't Open
**Cause:** OutputIntent strings incorrectly formatted as Names
**Fix:** Ensure setOutputIntent uses PDFString for all string values

## Expected Test Output

```
📂 Loading files from directory...
   Directory:  singlepage/
📄 Template has 1 page(s) per record
🚀 Generating PDF/VT with 3 records...
DEBUG: dpartOptions in generator: {
  enabled: true,
  version: 'PDF/VT-1',
  outputIntent: {
    subtype: 'GTS_PDFX',
    profileName: 'GRACoL2006_Coated1v2',
    outputCondition: 'GRACoL2006_Coated1v2',
    outputConditionIdentifier: 'GRACoL2006_Coated1v2',
    registryName: 'http://www.color.org',
    info: 'GRACoL2006 Coated1v2'
  },
  mapping: {
    ContactName: 'name',
    RecordID: 'id',
    MemberCode: 'barcode',
    PageCount: 'pageCount'
  }
}

====================================
      FINAL PDF/VT AUDIT LOG       
====================================
Document Structure:  ✅ DPartRoot Found
ISO Compliance:      ✅ VT Metadata Found
Color Intent:        ✅ OutputIntents Found
Record Indexing:     ✅ 3 records for 3 inputs
File Size:           24.27 KB
Output Location:     /workspaces/pdfme/acceptance_test/singlepage.pdf
====================================

📬 Delegating to render_postcard.mjs...
📂 Loading files from directory...
   Directory:  postcard/
Processing record for ZIP: 94583
Processing record for ZIP: 95117
📄 Template has 2 page(s) per record
🚀 Generating PDF/VT with 2 records...
DEBUG: dpartOptions in generator: {
  enabled: true,
  version: 'PDF/VT-1',
  outputIntent: {
    subtype: 'GTS_PDFX',
    profileName: 'GRACoL2006_Coated1v2',
    outputCondition: 'GRACoL2006_Coated1v2',
    outputConditionIdentifier: 'GRACoL2006_Coated1v2',
    registryName: 'http://www.color.org',
    info: 'GRACoL2006 Coated1v2'
  },
  mapping: {
    ContactName: 'name',
    RecordID: 'id',
    BarcodeURL: 'barcode',
    PageCount: 'pageCount'
  }
}

====================================
      FINAL PDF/VT AUDIT LOG       
====================================
Document Structure:  ✅ DPartRoot Found
ISO Compliance:      ✅ VT Metadata Found
Color Intent:        ✅ OutputIntents Found
Record Indexing:     ✅ 2 records for 2 inputs
File Size:           1551.97 KB
Output Location:     /workspaces/pdfme/acceptance_test/postcard.pdf
====================================

📂 Loading files from directory...
   Directory:  multipage/
📄 Template has 2 page(s) per record
🚀 Generating PDF/VT with 3 records...
DEBUG: dpartOptions in generator: {
  enabled: true,
  version: 'PDF/VT-1',
  outputIntent: {
    subtype: 'GTS_PDFX',
    profileName: 'GRACoL2006_Coated1v2',
    outputCondition: 'GRACoL2006_Coated1v2',
    outputConditionIdentifier: 'GRACoL2006_Coated1v2',
    registryName: 'http://www.color.org',
    info: 'GRACoL2006 Coated1v2'
  },
  mapping: {
    ContactName: 'name',
    RecordID: 'id',
    MemberCode: 'barcode',
    PageCount: 'pageCount'
  }
}

====================================
      FINAL PDF/VT AUDIT LOG       
====================================
Document Structure:  ✅ DPartRoot Found
ISO Compliance:      ✅ VT Metadata Found
Color Intent:        ✅ OutputIntents Found
Record Indexing:     ✅ 3 records for 3 inputs
File Size:           27.37 KB
Output Location:     /workspaces/pdfme/acceptance_test/multipage.pdf
====================================


📄 Auditing: multipage.pdf
────────────────────────────────────────────────────────────
PDF/X-4 (Object-Level):
  ✓ Catalog -> OutputIntents:    ✅
  ✓ Catalog -> Metadata (PDF/X): ✅
  ✓ Intent Dictionary Valid:     ✅

PDF/VT-1 (Object-Level):
  ✓ Catalog -> DPartRoot:        ✅
  ✓ Catalog -> Metadata (VT):    ✅
  ✓ DPart Tree Record Count:     ✅ (3/3)
  ✓ Record-Level Metadata:       ✅ (3/3 records)

Compliance: [✅ FULLY COMPLIANT]

📄 Auditing: postcard.pdf
────────────────────────────────────────────────────────────
PDF/X-4 (Object-Level):
  ✓ Catalog -> OutputIntents:    ✅
  ✓ Catalog -> Metadata (PDF/X): ✅
  ✓ Intent Dictionary Valid:     ✅

PDF/VT-1 (Object-Level):
  ✓ Catalog -> DPartRoot:        ✅
  ✓ Catalog -> Metadata (VT):    ✅
  ✓ DPart Tree Record Count:     ✅ (2/2)
  ✓ Record-Level Metadata:       ✅ (2/2 records)

Compliance: [✅ FULLY COMPLIANT]

📄 Auditing: singlepage.pdf
────────────────────────────────────────────────────────────
PDF/X-4 (Object-Level):
  ✓ Catalog -> OutputIntents:    ✅
  ✓ Catalog -> Metadata (PDF/X): ✅
  ✓ Intent Dictionary Valid:     ✅

PDF/VT-1 (Object-Level):
  ✓ Catalog -> DPartRoot:        ✅
  ✓ Catalog -> Metadata (VT):    ✅
  ✓ DPart Tree Record Count:     ✅ (3/3)
  ✓ Record-Level Metadata:       ✅ (3/3 records)

Compliance: [✅ FULLY COMPLIANT]

════════════════════════════════════════════════════════════
SUMMARY:
  multipage.pdf: ✅
  postcard.pdf: ✅
  singlepage.pdf: ✅
```

### **Technical Caveats & Known Assumptions**
The current auditor (`final_audit.js`) includes "Soft Logic" to allow for common generation quirks. These should be addressed in the `pdfme` generator to reach strict ISO-compliance:

#### **1. DPart Root Key Ambiguity**
* **Assumption**: The auditor accepts either `/DParts` or `/Children` at the `DPartRoot` level.
* **Strict Requirement**: Per ISO 16612-2, the root of the DPart tree **must** use the `/DParts` key. Only nested sub-nodes should use `/Children`.
* **Action for Generator**: Update the `DPartRoot` dictionary to use the `/DParts` key specifically for the top-level container.

#### **2. Metadata Inheritance**
* **Assumption**: The auditor allows records to "inherit" metadata from parent nodes if a leaf node lacks its own `/Metadata` entry.
* **Strict Requirement**: Every leaf node (Record) in the `DPart` tree should ideally have its own explicit `/Metadata` stream reference containing the `GTS_PDFVT` marker and `RecordID`.
* **Action for Generator**: Ensure each leaf node in the hierarchy points to its own unique XMP Metadata stream.

#### **3. OutputConditionIdentifier**
* **Assumption**: The auditor passes if `OutputConditionIdentifier` is a valid string.
* **Strict Requirement**: PDF/X-4 requires this string to match a recognized color characterization (e.g., `"FOGRA39"` or `"CGATS TR 006"`).
* **Action for Generator**: Hardcode a standard profile string or allow it to be passed via template config to ensure it isn't just a placeholder.

#### **4. PDF Header Version**
* **Assumption**: The auditor does not currently check the magic bytes at the start of the file.
* **Strict Requirement**: Both PDF/X-4 and PDF/VT-1 require a minimum PDF version of **1.6**.
* **Action for Generator**: Ensure the PDF header is explicitly written as `%PDF-1.6` at the start of the file.

## Adding New Test Cases

To add a new test case:

1. Create a new directory: `acceptance_test/mytest/`
2. Add `template.json` with your PDF structure and `dpartOptions`
3. Add `inputs.json` with test data
4. Run: `node acceptance_test/render.mjs mytest`
5. Verify output with: `node acceptance_test/final_audit.js`

## References

- **PDF/VT-1 Specification**: https://www.print.org/the-vomit-standards/pdf-vt
- **PDF/X-4 Specification**: https://www.iso.org/standard/51502.html
- **GRACoL 2006**: Color standard for coated stock printing
