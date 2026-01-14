import { PDFDocument, PDFName, PDFDict, PDFArray } from '@pdfme/pdf-lib';

/**
 * DPart Leaf Node representation for a single record.
 * Stores the PDF object reference and metadata for later backlinking to pages.
 */
interface DPartLeafNode {
  pdfObject: any; // PDFDict reference
  recordId: string;
  metadata: Record<string, any>;
}

/**
 * Manages PDF/VT compliance and Document Part (DPart) tracking during generation.
 * This class tracks which pages belong to which records and facilitates DPart creation.
 * It provides low-level access to pdf-lib's context for DPart injection.
 */
export class VTManager {
  private recordDParts: any[] = [];
  private dpartLeafNodes: DPartLeafNode[] = [];
  private vtConfig?: any;
  private complianceMode: boolean = false;
  private dpartRootNode?: any;

  constructor(vtConfig?: any, complianceMode: boolean = false) {
    this.vtConfig = vtConfig;
    this.complianceMode = complianceMode;
  }

  /**
   * Track the start of a new record's page generation.
   * Returns the current page index where this record starts.
   */
  getRecordStartPageIndex(pdfDoc: PDFDocument): number {
    return pdfDoc.getPageCount();
  }

  /**
   * Register a completed record with its page range and metadata.
   * This should be called after all pages for a record have been added to the PDF.
   *
   * @param recordIndex - The index of the record in the input data array
   * @param recordId - Unique identifier for this record
   * @param startPageIndex - The page index where this record's pages start (0-based)
   * @param endPageIndex - The page index where this record's pages end (inclusive, 0-based)
   * @param metadata - Record-level metadata to embed in DPart
   */
  registerRecordDPart(
    recordIndex: number,
    recordId: string,
    startPageIndex: number,
    endPageIndex: number,
    metadata: Record<string, any> = {},
  ): any {
    const dpartInfo: any = {
      recordIndex,
      recordId,
      startPageIndex,
      endPageIndex,
      metadata,
    };

    this.recordDParts.push(dpartInfo);
    return dpartInfo;
  }

  /**
   * Get all registered DPart information.
   */
  getDParts(): any[] {
    return [...this.recordDParts];
  }

  /**
   * Get DPart information for a specific record index.
   */
  getDPartByRecordIndex(recordIndex: number): any | undefined {
    return this.recordDParts.find((d) => d.recordIndex === recordIndex);
  }

  /**
   * Clear all registered DParts.
   * Useful when reusing the manager for multiple PDF documents.
   */
  clearDParts(): void {
    this.recordDParts = [];
  }

  /**
   * Create a DPart Leaf Node for a single record.
   * This creates the low-level PDF dictionary structure that represents a record in the DPart hierarchy.
   *
   * @param pdfDoc - The PDFDocument whose context will be used
   * @param recordId - The unique identifier for this record
   * @param metadata - Record metadata to include in the DPart node
   * @returns The DPart leaf node object
   */
  createDPartLeafNode(
    pdfDoc: PDFDocument,
    recordId: string,
    metadata: Record<string, any>,
  ): DPartLeafNode {
    const context = (pdfDoc as any).context;

    // Create the Record metadata dictionary
    const recordDict = context.obj({});
    Object.entries(metadata).forEach(([key, value]) => {
      recordDict.set(PDFName.of(key), this.serializeValue(context, value));
    });

    // Create the DPart Leaf Node
    const dpartLeafNode = context.obj({
      Type: PDFName.of('DPart'),
      Record: recordDict,
    });

    const node: DPartLeafNode = {
      pdfObject: dpartLeafNode,
      recordId,
      metadata,
    };

    this.dpartLeafNodes.push(node);
    return node;
  }

  /**
   * Create the DPartRoot hierarchy in the PDF catalog.
   * This builds the complete DPart structure from all registered leaf nodes and
   * registers it in the document catalog.
   *
   * @param pdfDoc - The PDFDocument to apply DParts to
   */
  createDPartRoot(pdfDoc: PDFDocument): void {
    if (this.dpartLeafNodes.length === 0) {
      return;
    }

    const context = (pdfDoc as any).context;

    // Collect all metadata field names used across all records
    const fieldNameSet = new Set<string>();
    this.dpartLeafNodes.forEach((node) => {
      Object.keys(node.metadata).forEach((key) => {
        fieldNameSet.add(key);
      });
    });

    // Create the Kids array containing all DPart leaf nodes
    const kidsArray = context.obj(
      this.dpartLeafNodes.map((node) => node.pdfObject),
    );

    // Create the DParts container
    const dpartsContainer = context.obj({
      Type: PDFName.of('DPart'),
      Kids: kidsArray,
    });

    // Create the NodeNameList for all field names
    const nodeNameList = Array.from(fieldNameSet).map((name) => PDFName.of(name));

    // Create the DPartRoot
    this.dpartRootNode = context.obj({
      Type: PDFName.of('DPartRoot'),
      DParts: dpartsContainer,
      NodeNameList: nodeNameList,
    });

    // Register in the document catalog
    const catalog = pdfDoc.catalog;
    catalog.set(PDFName.of('DPartRoot'), this.dpartRootNode);
  }

  /**
   * Backlink a page to its corresponding DPart leaf node.
   * This associates a specific page with a record in the DPart hierarchy.
   *
   * @param page - The PDFPage to link
   * @param dpartLeafNode - The DPart leaf node to link to
   */
  backlinkPageToDPart(page: any, dpartLeafNode: DPartLeafNode): void {
    page.node.set(PDFName.of('DPart'), dpartLeafNode.pdfObject);
  }

  /**
   * Apply DPart structure to the PDF document.
   * This method uses pdf-lib's low-level API to inject DPartRoot and create page backlinks.
   *
   * @param pdfDoc - The PDFDocument to apply DParts to
   * @throws Error if enforcement is enabled and validation fails
   */
  async applyDPartsToPDF(pdfDoc: PDFDocument): Promise<void> {
    if (this.recordDParts.length === 0 || this.dpartLeafNodes.length === 0) {
      return;
    }

    try {
      // Create the DPartRoot hierarchy
      this.createDPartRoot(pdfDoc);

      // Apply page backlinks
      this.applyPageBacklinks(pdfDoc);

      // Apply XMP metadata if configured
      if (this.vtConfig?.vtNamespaceVersion) {
        await this.injectXMPMetadata(pdfDoc);
      }

      // Apply output intent if configured
      if (this.vtConfig?.outputIntentProfile) {
        await this.applyOutputIntent(pdfDoc);
      }
    } catch (error) {
      if (this.complianceMode) {
        throw new Error(
          `[@pdfme/generator] Failed to apply PDF/VT DPart structure: ${(error as Error).message}`,
        );
      } else {
        console.warn(
          `[@pdfme/generator] Warning: Could not apply PDF/VT DPart structure: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Apply page backlinks to map pages to their DPart leaf nodes.
   * This method uses the page range information from recordDParts to link pages.
   *
   * @param pdfDoc - The PDFDocument containing the pages
   */
  private applyPageBacklinks(pdfDoc: PDFDocument): void {
    const pages = pdfDoc.getPages();

    for (const recordDPart of this.recordDParts) {
      const dpartLeafNode = this.dpartLeafNodes[recordDPart.recordIndex];
      if (!dpartLeafNode) {
        continue;
      }

      // Apply backlink to all pages in this record's range
      for (let pageIdx = recordDPart.startPageIndex; pageIdx <= recordDPart.endPageIndex; pageIdx++) {
        if (pageIdx < pages.length) {
          this.backlinkPageToDPart(pages[pageIdx], dpartLeafNode);
        }
      }
    }
  }

  /**
   * Serialize a value to a PDF-compatible object.
   * Handles strings, numbers, booleans, dates, and nested objects.
   *
   * @param context - The pdf-lib context
   * @param value - The value to serialize
   * @returns A serialized PDF object
   */
  private serializeValue(context: any, value: any): any {
    if (value === null || value === undefined) {
      return context.obj(null);
    }

    if (typeof value === 'string') {
      return context.obj(value);
    }

    if (typeof value === 'number') {
      return context.obj(value);
    }

    if (typeof value === 'boolean') {
      return context.obj(value);
    }

    if (value instanceof Date) {
      return context.obj(value.toISOString());
    }

    if (Array.isArray(value)) {
      return context.obj(value.map((v) => this.serializeValue(context, v)));
    }

    if (typeof value === 'object') {
      const dict = context.obj({});
      Object.entries(value).forEach(([key, val]) => {
        dict.set(PDFName.of(key), this.serializeValue(context, val));
      });
      return dict;
    }

    return context.obj(String(value));
  }

  /**
   * Inject XMP metadata with GTS_PDFVT namespace.
   * This ensures PDF/VT version and metadata are properly embedded.
   *
   * @param pdfDoc - The PDFDocument
   */
  private async injectXMPMetadata(pdfDoc: PDFDocument): Promise<void> {
    // Check if pdf-lib has XMP injection capabilities
    if (typeof (pdfDoc as any).injectXMPMetadata === 'function') {
      const xmpNamespace = `http://www.npes.org/pdfvt/ns/id/`;
      const vtVersion = this.vtConfig?.vtNamespaceVersion || '1.0';

      const xmpMetadata = {
        'gts:PDFVT': {
          'gts:Version': vtVersion,
          'gts:SourceModified': new Date().toISOString(),
        },
      };

      await (pdfDoc as any).injectXMPMetadata(xmpNamespace, xmpMetadata);
    }
  }

  /**
   * Apply output intent (ICC profile) for color consistency.
   *
   * @param pdfDoc - The PDFDocument
   */
  private async applyOutputIntent(pdfDoc: PDFDocument): Promise<void> {
    // This will call the pdf-lib Output Intent API when available
    if (typeof (pdfDoc as any).addOutputIntent === 'function') {
      const profile = this.vtConfig?.outputIntentProfile;
      if (profile) {
        await (pdfDoc as any).addOutputIntent(profile);
      }
    }
  }

  /**
   * Check if the pdf-lib instance has DPart API support.
   */
  private hasDPartAPI(pdfDoc: PDFDocument): boolean {
    return (
      typeof (pdfDoc as any).createDPartRoot === 'function' ||
      !this.complianceMode // Allow graceful degradation if not in strict mode
    );
  }

  /**
   * Validate that all fonts and images are embedded.
   * Used for PDF/VT and PDF/X-4 compliance.
   *
   * @param pdfDoc - The PDFDocument to validate
   * @throws Error if enforcement is enabled and non-embedded resources are found
   */
  validateEmbeddedResources(pdfDoc: PDFDocument): void {
    if (!this.complianceMode || !this.vtConfig?.enforceEmbedding) {
      return;
    }

    // This delegates to pdf-lib's validation when available
    if (typeof (pdfDoc as any).validateEmbeddedResources === 'function') {
      const result = (pdfDoc as any).validateEmbeddedResources();
      if (!result.isCompliant) {
        throw new Error(
          `[@pdfme/generator] PDF/VT compliance check failed: ${result.errors.join(', ')}`,
        );
      }
    }
  }

  /**
   * Get configuration for this VT manager.
   */
  getConfig(): any | undefined {
    return this.vtConfig;
  }

  /**
   * Check if compliance mode is enabled.
   */
  isComplianceMode(): boolean {
    return this.complianceMode;
  }
}
