export type EmbedPdfBox = {
  mediaBox: { x: number; y: number; width: number; height: number };
  bleedBox: { x: number; y: number; width: number; height: number };
  trimBox: { x: number; y: number; width: number; height: number };
};

/**
 * Options for PDF/VT generation.
 * Controls how variable data records are mapped to PDF Document Parts.
 */
export interface GeneratorVTOptions {
  /**
   * Enable strict PDF/VT compliance validation.
   */
  enforceCompliance?: boolean;

  /**
   * VT configuration from the template.
   */
  vtConfig?: any;
}

/**
 * Information about page ranges for a single record.
 * Used to track which pages belong to which input record.
 */
export interface RecordPageRange {
  recordIndex: number;
  startPageIndex: number;
  endPageIndex: number;
}
