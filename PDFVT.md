# PDF/VT Implementation Guide

This document provides comprehensive information about PDF/VT (Variable Data Printing) support in pdfme.

## Overview

PDF/VT is an ISO 16612-2 standard designed for professional print production with variable data. It combines:

- **Document Part (DPart) Hierarchy**: Logical structure mapping records to pages
- **Output Intent**: ICC color profiles for color-accurate printing
- **XMP Metadata**: Standardized metadata for print workflows
- **Resource Embedding**: Guaranteed font and image availability on print systems

## Architecture

### Components

1. **Template Schema Extensions** (`dpartOptions`)
   - Configuration for DPart mapping and output intent
   - Opt-in flag for PDF/VT generation

2. **VTManager** (`packages/generator/src/vtManager.ts`)
   - Tracks record-to-page mapping
   - Creates DPart nodes and hierarchy
   - Manages XMP and Output Intent injection

3. **VDP Sample Generator** (`scripts/generate_vdp_sample.ts`)
   - Reference implementation for PDF/VT generation
   - Uses test data and ICC profiles
   - Demonstrates all PDF/VT features

4. **Jest Tests** (`tests/PDFVTDataDriven.spec.ts`)
   - Data-driven tests using VDP data
   - Integration tests for roundtrip validation
   - Compliance validation checks

5. **CI Workflow** (`.github/workflows/pdfvt-validate.yml`)
   - Automated generation and validation
   - Artifact upload for inspection
   - Build failure on validation errors

## Usage

### Basic Configuration

```typescript
import { generate } from '@pdfme/generator';

const template = {
  basePdf: 'url_or_base64',
  schemas: [
    {
      name: 'invoice_number',
      type: 'text',
      position: { x: 50, y: 50 },
      width: 100,
      height: 20
    },
    {
      name: 'customer_name',
      type: 'text',
      position: { x: 50, y: 80 },
      width: 200,
      height: 20
    }
  ],
  dpartOptions: {
    enabled: true,
    version: 'PDF/VT-1',
    mapping: {
      'InvoiceNumber': 'invoice_number',
      'RecipientName': 'customer_name'
    },
    outputIntent: {
      profileName: 'Coated FOGRA39',
      registryName: 'http://www.color.org'
    },
    enforceCompliance: true,
    xmpNamespaceVersion: '1.0'
  }
};

const inputs = [
  {
    invoice_number: 'INV-2024-001',
    customer_name: 'John Doe'
  },
  {
    invoice_number: 'INV-2024-002',
    customer_name: 'Jane Smith'
  }
];

const pdfBytes = await generate({
  template,
  inputs,
  options: {
    pdfvt: true  // Enable PDF/VT mode
  }
});
```

### DPart Mapping

The `mapping` object bridges professional printer terminology to your schema fields:

```typescript
mapping: {
  'InvoiceNumber': 'invoice_number',    // DPart key -> schema field
  'RecipientID': 'customer_id',
  'Segment': 'region',
  'CostCenter': 'cost_center'
}
```

For each input record:
1. Extract values from mapped schema fields
2. Create a DPart node with these values as attributes
3. Associate all pages for that record with the DPart node

### Output Intent Configuration

Output Intent specifies color profiles for professional printing:

```typescript
outputIntent: {
  // Option 1: Use standard named profile
  profileName: 'Coated FOGRA39',
  registryName: 'http://www.color.org',
  
  // Option 2: Provide custom ICC profile
  profileData: 'base64_encoded_icc_profile'
}
```

**Common Profiles:**
- `Coated FOGRA39` - Coated paper (glossy/matte)
- `Uncoated FOGRA29` - Uncoated paper
- `Uncoated FOGRA47L` - Uncoated lightweight paper

Get profiles from [color.org](https://www.color.org/)

### Compliance Mode

Enable strict validation:

```typescript
dpartOptions: {
  enabled: true,
  enforceCompliance: true  // Throws errors on violations
}
```

Compliance checks:
- All fonts must be embedded
- All images must be embedded
- DPart structure must be valid
- Output Intent must be present

## Running Locally

### Generate Sample PDF

```bash
# Generate with test data
npx ts-node -r tsconfig-paths/register scripts/generate_vdp_sample.ts \
  --data test-data/vdp-data.json \
  --output /tmp

# Generate with custom ICC profile
npx ts-node -r tsconfig-paths/register scripts/generate_vdp_sample.ts \
  --data test-data/vdp-data.json \
  --icc path/to/profile.icc \
  --output /tmp
```

### Run Validation Tests

```bash
# Run all PDF/VT tests
npm test -- PDFVTDataDriven.spec.ts

# Run with coverage
npm test -- PDFVTDataDriven.spec.ts --coverage

# Run in watch mode
npm test -- PDFVTDataDriven.spec.ts --watch
```

### Manual Validation with qpdf

```bash
# Check PDF structure (requires qpdf)
qpdf --check pdfvt-sample-*.pdf

# Extract and inspect content
qpdf --qdf pdfvt-sample-*.pdf output.pdf
```

## CI/CD Integration

The workflow `.github/workflows/pdfvt-validate.yml` runs on every push and PR:

1. Builds all packages
2. Generates PDF/VT sample
3. Runs Jest validation tests
4. Optionally validates with qpdf
5. Uploads sample as artifact
6. Reports results in PR

**View results:**
- PR checks tab: Test status
- Artifacts: Download generated PDF samples

## Test Data Format

`test-data/vdp-data.json` structure:

```json
{
  "records": [
    {
      "recordId": "INV-2024-001",
      "recipientId": "CUST-001",
      "firstName": "John",
      "lastName": "Doe",
      "company": "ACME Corp",
      "invoiceNumber": "INV-2024-001",
      "invoiceAmount": "$1,250.00",
      "dueDate": "2024-02-15",
      "region": "North America"
    }
  ]
}
```

## Troubleshooting

### "DPart API not available"

This means pdf-lib doesn't have PDF/VT methods yet. Check:
- Is pdf-lib built from the GitHub branch?
- Run `npm run build` to rebuild packages

### "Output Intent failed to attach"

Ensure ICC profile is valid:
```bash
# Verify ICC profile
file path/to/profile.icc
```

### Tests failing

1. Check Node version: `node --version` (need 18+)
2. Rebuild: `npm run build`
3. Clear cache: `npm run clean && npm ci`
4. Run tests: `npm test -- PDFVTDataDriven.spec.ts --verbose`

## Migration from NPM to GitHub Branch

### Install from GitHub branch

```bash
# In package.json or via CLI
npm install github:mbghsource/pdf-lib#feat/pdfvt-dpart-outputintent
```

The postinstall hook automatically builds pdf-lib:
```json
{
  "postinstall": "./scripts/link-workspaces.sh && npm run -w packages/pdf-lib build 2>/dev/null || true"
}
```

### Reverting to NPM Version

When PDF/VT features are released to npm:

```bash
# Update to npm version
npm install pdf-lib@latest

# Remove from package.json
# "pdf-lib": "github:mbghsource/pdf-lib#feat/pdfvt-dpart-outputintent"
# becomes
# "pdf-lib": "^X.Y.Z"
```

## File Structure

```
pdfme/
├── packages/
│   ├── pdf-lib/          # pdf-lib fork (local implementation)
│   ├── generator/        # pdfme generator with PDF/VT support
│   │   └── src/
│   │       ├── vtManager.ts      # VT orchestration
│   │       ├── vtHelper.ts       # Helper functions
│   │       └── generate.ts       # Updated with VT integration
│   └── common/           # Shared types and schema
├── scripts/
│   └── generate_vdp_sample.ts    # VDP sample generator
├── tests/
│   └── PDFVTDataDriven.spec.ts   # PDF/VT validation tests
├── test-data/
│   ├── vdp-data.json            # Test records
│   └── test-icc.bin             # Minimal test ICC profile
├── .github/
│   └── workflows/
│       └── pdfvt-validate.yml    # CI workflow
└── PDFVT.md                      # This file
```

## Advanced Topics

### Custom Record Processing

Extend record handling:

```typescript
// In vtHelper.ts
export function customProcessRecord(record: any): any {
  return {
    ...extractDPartMetadata(record, mapping),
    // Add custom logic
    timestamp: new Date().toISOString()
  };
}
```

### ICC Profile Management

For production:

1. Obtain profiles from print vendor or color.org
2. Store securely (not in version control)
3. Load via environment or configuration
4. Validate profile before use

### Extending PDF/VT Features

To add new features to PDF/VT support:

1. Update `packages/pdf-lib` (or GitHub branch)
2. Add types to `packages/common/src/schema.ts`
3. Extend `VTManager` in `packages/generator/src/vtManager.ts`
4. Add tests to `tests/PDFVTDataDriven.spec.ts`
5. Update this documentation

## Resources

- **PDF/VT Standard**: [ISO 16612-2:2010](https://www.iso.org/standard/36757.html)
- **PDF Reference**: [Adobe PDF Specification](https://opensource.adobe.com/dc-acrobat-sdk-docs/library/newDocs/PDFRM/intro.html)
- **Color Profiles**: [International Color Consortium](https://www.color.org/)
- **Print Production**: [NPES VDP Standards](https://www.npes.org/)

## Support

For issues or questions:

1. Check this documentation
2. Review test cases in `tests/PDFVTDataDriven.spec.ts`
3. Open an issue on [GitHub](https://github.com/pdfme/pdfme/issues)
4. Join our [Discord](https://discord.gg/xWPTJbmgNV)

## License

PDF/VT support is part of pdfme, released under the [MIT License](./LICENSE.md).
