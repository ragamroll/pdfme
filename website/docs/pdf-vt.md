# PDF/VT Support

PDF/VT (PDF for Variable Transactional Printing) is a specialized PDF format designed for professional print production workflows, particularly for variable data printing (VDP) and transactional documents.

## What is PDF/VT?

PDF/VT extends the PDF format with additional structures that enable:
- **Variable Data Printing**: Efficient handling of personalized documents
- **Print Production Workflow**: Integration with professional printing systems
- **Document Structure**: Hierarchical organization of content for automated processing
- **Metadata Management**: Rich metadata for document tracking and processing

## PDF/VT Standards

pdfme implements **PDF/VT-1** according to ISO 16612-2, which includes:
- DPart (Document Part) structures for organizing content
- XMP metadata with PDF/VT namespace
- Output intents for color management
- Record-aware document generation

## Usage

PDF/VT is an **optional enhancement** to pdfme's existing functionality. It adds professional print production capabilities without changing how you use pdfme.

### Basic Setup

To enable PDF/VT support, simply add `dpartOptions` to your existing template:

```typescript
const template = {
  basePdf: BLANK_PDF,
  schemas: [
    // Your schema definitions
  ],
  dpartOptions: {
    enabled: true,
    version: 'PDF/VT-1',
    mapping: {
      // Map input field names to PDF/VT metadata keys
      InvoiceNumber: 'invoice_number',
      CustomerName: 'customer_name',
      Amount: 'amount',
      Region: 'region',
    },
    outputIntent: {
      profileName: 'Coated FOGRA39',
      registryName: 'http://www.color.org',
    },
  },
};
```

### Input Data Structure

PDF/VT leverages pdfme's existing input format - an array of record objects. Each record represents one document instance with its variable data:

```typescript
const inputs = [
  {
    invoice_number: 'INV-001',
    customer_name: 'John Doe',
    amount: '1500.00',
    region: 'North',
  },
  {
    invoice_number: 'INV-002',
    customer_name: 'Jane Smith',
    amount: '2750.50',
    region: 'South',
  },
];
```

**Note**: PDF/VT does not change pdfme's existing input format. It was already designed to work with arrays of records for generating multiple documents. PDF/VT simply adds metadata mapping capabilities to this existing structure.

### Generation

Generate PDF/VT documents using the **same API** as standard pdfme generation:

```typescript
import { generate } from '@pdfme/generator';

const pdf = await generate({ inputs, template });
```

The only difference is the `dpartOptions` in your template - everything else works exactly the same.

## Configuration Options

### dpartOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable PDF/VT generation |
| `version` | `string` | Yes | PDF/VT version (currently 'PDF/VT-1') |
| `mapping` | `Record<string, string>` | Yes | Map input field names to metadata keys |
| `outputIntent` | `OutputIntentOptions` | No | Color management settings |

### OutputIntentOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `profileName` | `string` | Yes | Output profile name (e.g., 'Coated FOGRA39') |
| `registryName` | `string` | Yes | ICC registry URL |
| `info` | `string` | No | Additional profile information |

## Generated PDF Structure

When PDF/VT is enabled, the generated PDF includes:

### Document Catalog
- **DPart Root**: Hierarchical structure for organizing content
- **XMP Metadata**: PDF/VT namespace with version information
- **Output Intents**: Color management specifications

### Page Structure
- **DPart References**: Each page links to its corresponding data record
- **Metadata**: Record-specific information embedded in the page structure

### Metadata Mapping
Input data is automatically mapped to PDF/VT metadata according to your configuration:

```typescript
mapping: {
  InvoiceNumber: 'invoice_number',  // input.invoice_number → PDF/VT InvoiceNumber
  CustomerName: 'customer_name',    // input.customer_name → PDF/VT CustomerName
}
```

## Use Cases

### Transactional Documents
- Invoices and statements
- Personalized letters
- Account notifications
- Billing documents

### Marketing Materials
- Personalized direct mail
- Targeted advertising
- Customer communications
- Promotional materials

### Print Production
- High-volume printing workflows
- Automated document processing
- Quality control systems
- Print management integration

## Backward Compatibility

PDF/VT is fully backward compatible with existing pdfme usage. When `dpartOptions.enabled` is `false` or not specified, pdfme behaves exactly as before.

### Existing Code Continues to Work

```typescript
// This existing code works unchanged
const inputs = [{ name: 'John', age: '30' }, { name: 'Jane', age: '25' }];
const template = { basePdf: BLANK_PDF, schemas: [...] };
const pdf = await generate({ inputs, template }); // No PDF/VT features
```

### Adding PDF/VT is Optional

```typescript
// Add PDF/VT features without breaking existing functionality
const templateWithPDFVT = {
  ...template,
  dpartOptions: {
    enabled: true,
    version: 'PDF/VT-1',
    mapping: { Name: 'name', Age: 'age' },
    // ... other options
  },
};
const pdfWithVT = await generate({ inputs, templateWithPDFVT }); // PDF/VT enabled
```

## Standards Compliance

This implementation follows:
- **ISO 16612-2**: PDF/VT-1 specification
- **PDF 1.7**: Base PDF format
- **XMP**: Extensible Metadata Platform
- **ICC Color Management**: Output intent specifications

## Example

See the [PDF/VT example](../examples/pdf-vt-example.js) for a complete working implementation that generates a multi-record PDF/VT document.

---

## Technical Implementation Details

This section describes the internal implementation of PDF/VT support for developers contributing to pdfme.

### Architecture Overview

PDF/VT support is implemented across multiple packages:

| Package | Component | Purpose |
|---------|-----------|---------|
| `pdf-lib` | `PDFDPart`, `PDFCatalog` | Core DPart structure and catalog management |
| `generator` | `generate.ts` | PDF generation with DPart hierarchy and metadata |
| `common` | Type definitions | Shared types and interfaces |

### Key Requirements Met

#### 1. Strict DPartRoot Structure

**Requirement**: The DPartRoot uses `/DParts` key for direct children; nested nodes use `/Children`.

**Files Modified**:
- `packages/pdf-lib/src/core/structures/PDFDPart.ts`
- `packages/pdf-lib/src/core/structures/PDFCatalog.ts`

**Implementation**:
```typescript
// In PDFDPart.ts - Root node uses /DParts, children use /Children
Children(): PDFArray | undefined {
  const childrenKey = this.isRoot ? PDFName.of('DParts') : PDFName.of('Children');
  return this.lookupMaybe(childrenKey, PDFArray);
}

// In PDFCatalog.ts - Mark root during creation
dpart = PDFDPart.withContext(this.context, undefined, true); // true = isRoot
```

#### 2. Explicit Record-Level Metadata

**Requirement**: Each leaf DPart node has its own XMP metadata stream with `GTS_PDFVT` marker and unique `RecordID`.

**File Modified**: `packages/generator/src/generate.ts`

**Implementation**:
```typescript
// Generate explicit XMP for each record
const recordId = input[dpartOptions.mapping.RecordID] || `record-${i}`;
const xmpContent = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" 
      xmlns:pdfvmeta="http://www.npes.org/pdfvt/ns/id/">
      <pdfvmeta:GTS_PDFVT>true</pdfvmeta:GTS_PDFVT>
      <pdfvmeta:RecordID>${recordId}</pdfvmeta:RecordID>
      <!-- Additional fields mapped from input -->
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

const xmpStream = pdfDoc.context.stream(xmpContent);
const xmpStreamRef = pdfDoc.context.register(xmpStream);
dpartNode.set(pdfLib.PDFName.of('Metadata'), xmpStreamRef);
```

#### 3. Standardized OutputConditionIdentifier

**Requirement**: OutputIntent uses recognized color characterization (defaults to `FOGRA39`).

**File Modified**: `packages/generator/src/generate.ts`

**Implementation**:
```typescript
const outputIntentConfig = dpartOptions.outputIntent || {
  profileName: 'FOGRA39',
  registryName: 'http://www.color.org',
  info: 'Coated FOGRA39 (ISO 12647-2:2004)',
};

pdfDoc.setOutputIntent({
  subtype: 'GTS_PDFX',
  outputCondition: outputIntentConfig.profileName,
  outputConditionIdentifier: outputIntentConfig.profileName.includes(' ') 
    ? outputIntentConfig.profileName.replace(/\s+/g, '')
    : outputIntentConfig.profileName,
  registryName: outputIntentConfig.registryName,
  info: outputIntentConfig.info,
});
```

#### 4. PDF Header Versioning

**Requirement**: Generated PDFs use PDF 1.7 (supports both PDF/VT-1 and PDF/X-4).

**File**: `packages/pdf-lib/src/core/writers/PDFWriter.ts`

**Status**: Uses `PDFHeader.forVersion(1, 7)` - generates files starting with `%PDF-1.7`

#### 5. XMP Namespace Compliance

**Requirement**: XMP includes proper PDF/VT namespace: `xmlns:pdfvmeta="http://www.npes.org/pdfvt/ns/id/"`

**File Modified**: `packages/generator/src/generate.ts`

Both root document and leaf node metadata include:
- Proper namespace declaration
- `GTS_PDFVT` marker for identification
- All fields prefixed with `pdfvmeta:`

### Testing

Compliance is validated by `acceptance_test/final_audit.js` which verifies:

**PDF/X-4 Requirements**:
- `/OutputIntents` array in catalog
- Valid OutputIntent dictionary structure
- XMP includes `GTS_PDFX` marker

**PDF/VT-1 Requirements**:
- `/DPartRoot` in catalog
- `/DParts` key (not `/Children`) at root level
- XMP includes `GTS_PDFVT` marker
- Each record has metadata with unique RecordID
- Record count matches input count

Run tests with: `npm run test:vt`

### Files Modified

| File | Changes |
|------|---------|
| `packages/pdf-lib/src/core/structures/PDFDPart.ts` | Added `isRoot` parameter, updated `Children()` and `addChild()` for `/DParts` vs `/Children` |
| `packages/pdf-lib/src/core/structures/PDFCatalog.ts` | Updated `getOrCreateDPart()` to mark root node |
| `packages/generator/src/generate.ts` | Added explicit XMP metadata, OutputIntent defaults, namespace compliance |
| `packages/pdf-lib/src/core/writers/PDFWriter.ts` | PDF 1.7 header generation |
| `acceptance_test/final_audit.js` | Strict `/DParts` validation |

### References

- [PDF/VT-1 Specification (ISO 16612-2)](https://www.print.org/the-vomit-standards/pdf-vt)
- [PDF/X Specification (ISO 15930-6)](https://www.iso.org/standard/51502.html)
- [XMP Specification](https://www.adobe.io/open/standards/PDFA_XMP.html)
- [FOGRA39 Color Standard](https://www.fogra.org/)