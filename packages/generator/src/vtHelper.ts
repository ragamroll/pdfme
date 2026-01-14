import type {
  Template,
  TemplateVTConfig,
  RecordDPartInfo,
  GenerateProps,
} from '@pdfme/common';

/**
 * DPart Options type extracted from template.
 */
export interface DPartOptions {
  enabled?: boolean;
  version?: string;
  mapping?: Record<string, string>;
  outputIntent?: {
    profileName?: string;
    registryName?: string;
    profileData?: string;
  };
  enforceCompliance?: boolean;
  xmpNamespaceVersion?: string;
}

/**
 * Extract DPart options from template.
 * Returns undefined if dpartOptions is not configured.
 */
export function getDPartOptionsFromTemplate(template: Template): DPartOptions | undefined {
  return (template as any).dpartOptions;
}

/**
 * Extract VT configuration from template.
 * Returns undefined if VT is not configured.
 */
export function getVTConfigFromTemplate(template: Template): TemplateVTConfig | undefined {
  return (template as any).vt;
}

/**
 * Determine if a template has PDF/VT enabled.
 * Checks both dpartOptions.enabled and vt.isVT for backwards compatibility.
 */
export function isVTEnabled(template: Template): boolean {
  const dpartOptions = getDPartOptionsFromTemplate(template);
  const vtConfig = getVTConfigFromTemplate(template);
  return dpartOptions?.enabled === true || vtConfig?.isVT === true;
}

/**
 * Extract record ID from input data using configured record ID fields.
 * Falls back to input index if no field is configured or found.
 *
 * @param input - The input record data
 * @param recordIndex - The index of the record in the input array
 * @param recordIdFields - Fields to check for record ID (in order of preference)
 * @returns The record ID as a string
 */
export function extractRecordId(
  input: Record<string, any>,
  recordIndex: number,
  recordIdFields?: string[],
): string {
  if (recordIdFields && recordIdFields.length > 0) {
    for (const field of recordIdFields) {
      const value = input[field];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  }

  // Fallback to record index
  return `record_${recordIndex}`;
}

/**
 * Extract metadata from input data using DPart mapping.
 * Maps DPart metadata keys to values from the corresponding schema fields in the input.
 *
 * @param input - The input record data
 * @param dpartMapping - Mapping from DPart keys to schema field names
 * @returns An object containing the extracted metadata keyed by DPart field names
 */
export function extractDPartMetadata(
  input: Record<string, any>,
  dpartMapping?: Record<string, string>,
): Record<string, any> {
  if (!dpartMapping || Object.keys(dpartMapping).length === 0) {
    return {};
  }

  const metadata: Record<string, any> = {};
  
  // For each DPart key, find the corresponding schema field and extract its value
  Object.entries(dpartMapping).forEach(([dpartKey, schemaFieldName]) => {
    if (schemaFieldName in input) {
      metadata[dpartKey] = input[schemaFieldName];
    }
  });

  return metadata;
}

/**
 * Extract metadata from input data using configured metadata fields.
 * This is for the legacy VT config approach.
 *
 * @param input - The input record data
 * @param metadataFields - Fields to extract as metadata
 * @returns An object containing the extracted metadata
 */
export function extractMetadata(
  input: Record<string, any>,
  metadataFields?: string[],
): Record<string, any> {
  if (!metadataFields || metadataFields.length === 0) {
    return {};
  }

  const metadata: Record<string, any> = {};
  for (const field of metadataFields) {
    if (field in input) {
      metadata[field] = input[field];
    }
  }

  return metadata;
}

/**
 * Build VT metadata for a record using DPart mapping.
 * Extracts values from input based on the mapping configuration.
 *
 * @param recordIndex - Index of the record
 * @param input - The input record data
 * @param dpartOptions - DPart options from template
 * @returns Metadata object keyed by DPart field names
 */
export function buildDPartMetadata(
  recordIndex: number,
  input: Record<string, any>,
  dpartOptions?: DPartOptions,
): Record<string, any> {
  return extractDPartMetadata(input, dpartOptions?.mapping);
}

/**
 * Build VT metadata for a record using legacy VT config.
 * Combines default metadata with record-specific metadata.
 *
 * @param recordIndex - Index of the record
 * @param input - The input record data
 * @param vtConfig - VT configuration from template
 * @returns The built VT metadata
 */
export function buildRecordVTMetadata(
  recordIndex: number,
  input: Record<string, any>,
  vtConfig?: TemplateVTConfig,
): RecordDPartInfo {
  const recordId = extractRecordId(input, recordIndex, vtConfig?.recordIdFields);
  const recordMetadata = extractMetadata(input, vtConfig?.metadataFields);

  // Merge with default metadata if configured
  const metadata = {
    ...vtConfig?.defaultVTMetadata?.metadata,
    ...recordMetadata,
  };

  return {
    recordIndex,
    recordId,
    startPageIndex: 0, // Will be set by VTManager
    endPageIndex: 0, // Will be set by VTManager
    metadata,
  };
}

/**
 * Validate that required DPart fields are present in input data.
 * Useful for ensuring data integrity before generation.
 *
 * @param inputs - Array of input records
 * @param dpartOptions - DPart options from template
 * @throws Error if required fields are missing
 */
export function validateDPartInputs(
  inputs: Record<string, any>[],
  dpartOptions?: DPartOptions,
): void {
  if (!dpartOptions?.enabled || !dpartOptions?.mapping) {
    return;
  }

  const mappedFields = Object.values(dpartOptions.mapping);

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const hasAnyField = mappedFields.some((field) => field in input && input[field]);

    if (!hasAnyField && dpartOptions.enforceCompliance) {
      throw new Error(
        `[@pdfme/generator] Record ${i}: At least one of the mapped fields (${mappedFields.join(', ')}) must be present in input data for PDF/VT DPart generation`,
      );
    }
  }
}

/**
 * Validate that required VT fields are present in input data.
 * Useful for ensuring data integrity before generation.
 *
 * @param inputs - Array of input records
 * @param vtConfig - VT configuration
 * @throws Error if required fields are missing
 */
export function validateVTInputs(
  inputs: Record<string, any>[],
  vtConfig?: TemplateVTConfig,
): void {
  if (!vtConfig || !vtConfig.recordIdFields || vtConfig.recordIdFields.length === 0) {
    return;
  }

  const requiredFields = vtConfig.recordIdFields;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const hasAnyField = requiredFields.some((field: string) => field in input && input[field]);

    if (!hasAnyField && vtConfig.isVT) {
      throw new Error(
        `[@pdfme/generator] Record ${i}: At least one of the record ID fields (${requiredFields.join(', ')}) must be present in input data for PDF/VT generation`,
      );
    }
  }
}

/**
 * Generate XMP metadata string for PDF/VT.
 * This can be injected into the PDF as a metadata stream.
 *
 * @param vtNamespaceVersion - PDF/VT namespace version (e.g., "1.0")
 * @param recordDParts - Array of record DPart information
 * @returns XMP metadata as string
 */
export function generateXMPMetadata(
  vtNamespaceVersion: string = '1.0',
  recordDParts: RecordDPartInfo[] = [],
): string {
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:gts="http://www.npes.org/pdfvt/ns/id/">
  <rdf:Description rdf:about=""
                   gts:Version="${vtNamespaceVersion}"
                   gts:SourceModified="${timestamp}"
                   gts:RecordCount="${recordDParts.length}">
    ${recordDParts
      .map(
        (dpart) =>
          `<gts:DocumentPart rdf:parseType="Resource">
      <gts:RecordId>${escapeXML(dpart.recordId)}</gts:RecordId>
      <gts:StartPage>${dpart.startPageIndex}</gts:StartPage>
      <gts:EndPage>${dpart.endPageIndex}</gts:EndPage>
    </gts:DocumentPart>`,
      )
      .join('\n    ')}
  </rdf:Description>
</rdf:RDF>`;
}

/**
 * Escape XML special characters.
 */
function escapeXML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
