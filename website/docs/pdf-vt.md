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