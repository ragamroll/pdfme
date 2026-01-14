# PDF/VT Implementation for pdfme

This document summarizes the PDF/VT (Variable Data Printing with DPart support) implementation across the pdfme stack.

## Overview

The implementation adds full PDF/VT support to pdfme by extending the template schema to include Document Part (DPart) configuration, implementing record-aware generation tracking, and automating the mapping between variable data records and PDF/VT's hierarchical document structure.

## Key Changes

### 1. Template Schema Extensions (packages/common/src/schema.ts)

#### New DPart Configuration Types

- **DPartOutputIntent**: Defines ICC color profile information for professional print environments
  - `profileName`: Standard ICC profile name (e.g., "Coated FOGRA39")
  - `registryName`: Registry URL (e.g., "http://www.color.org")
  - `profileData`: Base64-encoded ICC profile data

- **DPartMapping**: Maps professional printer DPart metadata keys to pdfme schema field names
  - Example: `{ "InvoiceNumber": "invoice_number", "RecipientID": "customer_id" }`

- **DPartOptions**: Main configuration object for PDF/VT generation
  - `enabled`: Boolean flag to activate PDF/VT pipeline
  - `version`: Target ISO standard (e.g., "PDF/VT-1", "PDF/VT-2")
  - `mapping`: Field mapping between DPart keys and schema names
  - `outputIntent`: Color profile configuration
  - `enforceCompliance`: Strict validation mode
  - `xmpNamespaceVersion`: XMP metadata version

#### Template Extension

The `Template` type now includes:
```typescript
{
  schemas: SchemaPageArray;
  basePdf: BasePdf;
  pdfmeVersion?: string;
  dpartOptions?: DPartOptions;
  vt?: TemplateVTConfig; // Legacy support
}
```

### 2. VT Manager Implementation (packages/generator/src/vtManager.ts)

The `VTManager` class provides:

- **Record Tracking**: Tracks start/end page indices for each input record
- **DPart Leaf Node Creation**: Creates low-level PDF dictionary structures for records
- **DPart Hierarchy**: Builds the complete DPartRoot structure in the document catalog
- **Page Backlinking**: Links pages to their corresponding DPart nodes
- **Metadata Injection**: Supports XMP metadata and Output Intent application

Key methods:
- `createDPartLeafNode()`: Creates a DPart leaf node for a single record
- `createDPartRoot()`: Builds the complete DPart hierarchy
- `backlinkPageToDPart()`: Links pages to DPart nodes
- `applyDPartsToPDF()`: Applies the complete DPart structure to the PDF

### 3. VT Helper Functions (packages/generator/src/vtHelper.ts)

Utility functions for DPart processing:

- `getDPartOptionsFromTemplate()`: Extract DPart configuration
- `isVTEnabled()`: Check if VT is enabled in template
- `extractRecordId()`: Extract unique record identifiers
- `extractDPartMetadata()`: Extract metadata using DPart mapping
- `buildDPartMetadata()`: Build complete metadata for a record
- `validateDPartInputs()`: Validate input data against DPart requirements
- `generateXMPMetadata()`: Generate XMP metadata strings for PDF/VT

### 4. Generate Function Updates (packages/generator/src/generate.ts)

The main `generate()` function now:

1. **Initializes VT Support**:
   - Reads dpartOptions and vt configs
   - Creates VTManager instance
   - Validates input data

2. **Record-Aware Processing**:
   - Tracks page index where each record starts
   - Records page range for each record
   - Extracts metadata based on DPart mapping

3. **DPart Creation**:
   - Creates DPart leaf nodes during generation
   - Registers record information for backlinking
   - Applies complete DPart structure after all records are processed

4. **Post-Processing**:
   - Validates embedded resources if compliance mode enabled
   - Applies XMP metadata
   - Applies output intent

## Usage Example

```json
{
  "basePdf": "base64_pdf_data_or_url",
  "schemas": [
    {
      "name": "invoice_number",
      "type": "text",
      "position": { "x": 10, "y": 10 },
      "width": 50,
      "height": 10
    },
    {
      "name": "customer_id",
      "type": "text",
      "position": { "x": 10, "y": 25 },
      "width": 50,
      "height": 10
    }
  ],
  "dpartOptions": {
    "enabled": true,
    "version": "PDF/VT-1",
    "mapping": {
      "InvoiceNumber": "invoice_number",
      "RecipientID": "customer_id"
    },
    "outputIntent": {
      "profileName": "Coated FOGRA39",
      "registryName": "http://www.color.org"
    },
    "enforceCompliance": true,
    "xmpNamespaceVersion": "1.0"
  }
}
```

## Data Flow

1. **Input Processing**: For each input record, the generator:
   - Records the starting page index
   - Renders all pages for that record
   - Records the ending page index

2. **Metadata Extraction**: Using the DPart mapping:
   - Maps schema field names to DPart metadata keys
   - Extracts values from the input record
   - Builds the metadata dictionary

3. **DPart Creation**: After all records are processed:
   - Creates DPart leaf nodes for each record
   - Builds the DPartRoot hierarchy
   - Backlinkspages to their corresponding DPart nodes
   - Injects XMP metadata and Output Intent

## Compliance Features

- **Strict Mode**: `enforceCompliance: true` enforces PDF/VT rules
- **Resource Validation**: Checks that fonts and images are embedded
- **XMP Metadata**: Generates standardized PDF/VT XMP packets
- **Output Intent**: Ensures color accuracy across printing systems

## Backward Compatibility

The implementation maintains backward compatibility:
- Legacy `vt` configuration is still supported
- `dpartOptions` is the new recommended approach
- Both can coexist in templates

## Integration Points

The implementation assumes pdf-lib will provide:
- Low-level `context.obj()` for PDF object creation
- `PDFName`, `PDFDict` for object construction
- `catalog.set()` for registering objects in the document catalog
- Optional XMP injection API
- Optional Output Intent API

These are used via duck-typing (checking for method existence) to maintain graceful degradation if not available.

## Files Modified

### Common Package
- `packages/common/src/schema.ts`: Added DPart schema definitions
- `packages/common/src/types.ts`: Added DPart type exports
- `packages/common/src/index.ts`: Updated exports

### Generator Package
- `packages/generator/src/generate.ts`: Integrated DPart generation loop
- `packages/generator/src/vtManager.ts`: New DPart management class
- `packages/generator/src/vtHelper.ts`: New helper functions for DPart processing
- `packages/generator/src/types.ts`: Updated type definitions

## Future Enhancements

- Streaming support for PDF/VT-2 (multi-file)
- Advanced validation hooks
- DPart structure preview in Designer UI
- Template validation against PDF/VT standards
