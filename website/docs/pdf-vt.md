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
    colorSpace: 'CMYK',  // Optional: 'RGB' (default) or 'CMYK' for print
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
| `colorSpace` | `'RGB' \| 'CMYK'` | No | Color space for text/graphics: 'RGB' (default) or 'CMYK' for professional print |
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

## Color Space Support

The `colorSpace` option controls how text and graphics are rendered in the PDF:

### RGB (Default)
- Standard RGB color space for screen display
- Suitable for digital distribution and web delivery
- Uses RGB operators (`rg`, `RG`) in PDF content streams

### CMYK
- Professional CMYK color space for print production
- Ensures accurate color management in professional printing workflows
- Uses CMYK operators (`k`, `K`) in PDF content streams
- Works seamlessly with print production systems and ICC color profiles

### Example: Enabling CMYK
```typescript
const template = {
  basePdf: BLANK_PDF,
  schemas: [...],
  dpartOptions: {
    enabled: true,
    version: 'PDF/VT-1',
    colorSpace: 'CMYK',  // Enable CMYK rendering
    outputIntent: {
      profileName: 'Coated FOGRA39',
      registryName: 'http://www.color.org',
    },
    mapping: { /* ... */ },
  },
};
```

### How It Works

When `colorSpace: 'CMYK'` is specified:
1. **Text Colors**: All text colors (specified as hex in schemas) are automatically converted from RGB to CMYK
2. **Graphics Colors**: Vector graphics and shapes use CMYK color operators
3. **Embedded Images**: Image color spaces are preserved (images may retain RGB/Grayscale for quality)
4. **PDF Operators**: Content streams use CMYK operators (`k` for fill, `K` for stroke)

### Verification

To verify that CMYK rendering was applied, inspect the generated PDF:
- Upload to a PDF analyzer (e.g., pdfux.com)
- Look for content stream operators: `0 0 0 1 k` (example CMYK color)
- Compare with RGB PDFs which use: `0 0 0 rg` (example RGB color)

### Mixed Color Spaces

**PDF/VT-1 (based on PDF/X-4) explicitly allows mixed color spaces** in the same document. This is compliant with the ISO standards and is actually the expected behavior in professional print workflows.

#### Why Mixed Color Spaces Occur:

1. **Text/Graphics Layer** - Uses your configured `colorSpace` (CMYK or RGB)
   - With `colorSpace: 'CMYK'`: Text renders with CMYK operators (`k` operators)
   
2. **Image Layer** - Retains original image color space for quality
   - Photos: `DeviceRGB` (from source images)
   - Grayscale elements: `DeviceGray`

#### Example Mixed Color Space PDF:

```
Page Health Summary:
  🟡 Page 1  : Mixed (devicergb)      ← Text is CMYK, images are RGB
  🟡 Page 2  : Mixed (devicergb)
  🟡 Page 3  : Mixed (devicergb)

Color Space:
  ✓ Requested:                   cmyk  ← We requested CMYK
  ✓ Actual (detected):           mixed (devicergb)  ← Mixed is fine!
  ✓ Match:                       ✅    ← Still compliant
```

#### Why This Design is Optimal:

The mixed color space approach is **intentional and correct** because:

1. **Color Accuracy**: Images retain their native color space for best visual quality
2. **Print Production**: Text/graphics use CMYK for predictable color management
3. **PDF/X-4 Flexibility**: Allows different color spaces as long as OutputIntent is defined
4. **Professional Standards**: Print workflows expect and handle this correctly

#### Standards Reference:

- **PDF/X-4 (ISO 15930-6)**: Explicitly allows mixing of RGB, CMYK, Lab, and other color spaces
- **PDF/VT-1 (ISO 16612-2)**: Extends PDF/X-4 and inherits this flexibility
- **Requirement**: All colors must be managed under the declared OutputIntent

#### Color Management Under OutputIntent

In PDF/VT-1 and PDF/X-4 compliant documents:

1. **OutputIntent Declaration** - Defined in Document Catalog specifies the color rendering intent
2. **Implicit Color Management** - All color spaces (CMYK text, RGB images, Grayscale graphics) are interpreted relative to the OutputIntent
3. **ICC Profile Binding** - The OutputIntent references an ICC color profile that governs how colors are rendered
4. **No Per-Object Override** - Individual objects don't declare their own color management; they use the document-level OutputIntent

This means:
- **Text colors** (CMYK) are managed by the OutputIntent ICC profile
- **Image colors** (RGB/Grayscale) are managed by the OutputIntent ICC profile  
- **Vector graphics** (CMYK) are managed by the OutputIntent ICC profile

The audit verifies this by checking:
- ✅ OutputIntents array exists in Catalog
- ✅ OutputIntent dictionary has valid structure (GTS_PDFX subtype, profile identifiers)
- ✅ XMP metadata declares the PDF/X-4 and PDF/VT-1 versions
- ✅ Color usage matches the declared configuration (CMYK or RGB)

Mixed color spaces are allowed because the OutputIntent ICC profile handles the conversion and rendering of all color spaces according to the declared profile (e.g., Coated FOGRA39).

## ICC Profile Details

### Profile Specifications

#### GRACoL2006_Coated1v2 (Default in Tests)
- **Standard**: GRACoL (General Requirements for Applications in Commercial Offset Lithography)
- **Color Space**: CMYK
- **Purpose**: Print specification for coated paper offset printing
- **Used By**: Print production workflows, commercial printers

#### FOGRA39 (Modern Equivalent)
- **Standard**: FOGRA (Fédération des Organisations de Gestionnaires de Ressources en Imprimerie/Graphic Arts)
- **Color Space**: CMYK
- **Purpose**: ISO 12647-2:2004 standard for coated paper (offset printing)
- **Used By**: Professional print production, print-on-demand services

Both are:
- CMYK-only profiles
- Designed for print production
- Support PDF/X-4 and PDF/VT-1 fully
- Handle RGB→CMYK conversion automatically
- Handle Grayscale→CMYK conversion automatically

### Color Space Compatibility with ICC Profiles

When a PDF/X-4/PDF/VT-1 document declares OutputIntent with a CMYK profile like GRACoL2006:

1. **CMYK Objects** → Directly managed by the ICC profile ✅
2. **RGB Objects** → ICC profile performs automatic RGB→CMYK conversion ✅
3. **Grayscale Objects** → ICC profile performs automatic Gray→CMYK conversion ✅

The ICC profile specification supports:
- Input color spaces different from profile's native space
- Automatic conversion/rendering to profile's target space
- Multiple color spaces in same document

### Profile Independence

**These tests pass regardless of the specific ICC profile used**, because:

1. **PDF/X-4 Standard Requirement**: Mixed color spaces are explicitly allowed by ISO 15930-6
2. **Any PDF/X-4 Profile Works**: GRACoL2006, FOGRA39, or any other PDF/X-4 compliant profile enables the same functionality
3. **ICC Profile Role**: Defines how colors are **rendered** (color reproduction), not which color spaces are **allowed**

#### Why Profile Selection Matters

Different profiles affect color appearance but not compliance:

| Profile Type | Handles Mixed Spaces | PDF/X-4 Valid | Output Appearance |
|--------------|----------------------|----------------|-------------------|
| **CMYK Print Profile** (GRACoL2006, FOGRA39) | ✅ Yes | ✅ Yes | Print-optimized ✅ |
| **Different CMYK Profile** (Uncoated, Newsprint) | ✅ Yes | ✅ Yes | Different output (coated vs. uncoated) |
| **RGB Display Profile** (sRGB) | ✅ Yes | ❌ No | Works but violates standard |
| **Hypothetical Restrictive Profile** | ❌ No | N/A | Theoretical only - no real profiles work this way |

#### What Could Cause Failure

- **No OutputIntent** declared (violates PDF/X-4)
- **Missing or invalid ICC profile** file referenced by OutputIntent
- **Profile for wrong medium** (e.g., glossy profile output for coated paper)
- **Non-PDF/X-4 compliant profile** (uses wrong standard)

But NOT using mixed color spaces with a valid PDF/X-4 profile - the standards explicitly allow and expect this.

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