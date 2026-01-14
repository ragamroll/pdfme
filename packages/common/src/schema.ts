import { z } from 'zod';

const langs = ['en', 'zh', 'ja', 'ko', 'ar', 'th', 'pl', 'it', 'de', 'es', 'fr'] as const;

export const Lang = z.enum(langs);
export const Dict = z.object({
  // -----------------used in ui-----------------
  cancel: z.string(),
  close: z.string(),
  set: z.string(),
  clear: z.string(),
  field: z.string(),
  fieldName: z.string(),
  align: z.string(),
  width: z.string(),
  opacity: z.string(),
  height: z.string(),
  rotate: z.string(),
  edit: z.string(),
  required: z.string(),
  editable: z.string(),
  plsInputName: z.string(),
  fieldMustUniq: z.string(),
  notUniq: z.string(),
  noKeyName: z.string(),
  fieldsList: z.string(),
  editField: z.string(),
  type: z.string(),
  errorOccurred: z.string(),
  errorBulkUpdateFieldName: z.string(),
  commitBulkUpdateFieldName: z.string(),
  bulkUpdateFieldName: z.string(),
  addPageAfter: z.string(),
  removePage: z.string(),
  removePageConfirm: z.string(),
  // --------------------validation-------------------
  'validation.uniqueName': z.string(),
  'validation.hexColor': z.string(),
  'validation.dateTimeFormat': z.string(),
  'validation.outOfBounds': z.string(),

  // -----------------used in schemas-----------------
  'schemas.color': z.string(),
  'schemas.borderWidth': z.string(),
  'schemas.borderColor': z.string(),
  'schemas.backgroundColor': z.string(),
  'schemas.textColor': z.string(),
  'schemas.bgColor': z.string(),
  'schemas.horizontal': z.string(),
  'schemas.vertical': z.string(),
  'schemas.left': z.string(),
  'schemas.center': z.string(),
  'schemas.right': z.string(),
  'schemas.top': z.string(),
  'schemas.middle': z.string(),
  'schemas.bottom': z.string(),
  'schemas.padding': z.string(),

  'schemas.text.fontName': z.string(),
  'schemas.text.size': z.string(),
  'schemas.text.spacing': z.string(),
  'schemas.text.textAlign': z.string(),
  'schemas.text.verticalAlign': z.string(),
  'schemas.text.lineHeight': z.string(),
  'schemas.text.min': z.string(),
  'schemas.text.max': z.string(),
  'schemas.text.fit': z.string(),
  'schemas.text.dynamicFontSize': z.string(),
  'schemas.text.format': z.string(),
  'schemas.radius': z.string(),

  'schemas.mvt.typingInstructions': z.string(),
  'schemas.mvt.sampleField': z.string(),
  'schemas.mvt.variablesSampleData': z.string(),

  'schemas.barcodes.barColor': z.string(),
  'schemas.barcodes.includetext': z.string(),

  'schemas.table.alternateBackgroundColor': z.string(),
  'schemas.table.tableStyle': z.string(),
  'schemas.table.showHead': z.string(),
  'schemas.table.repeatHead': z.string(),
  'schemas.table.headStyle': z.string(),
  'schemas.table.bodyStyle': z.string(),
  'schemas.table.columnStyle': z.string(),

  'schemas.date.format': z.string(),
  'schemas.date.locale': z.string(),

  'schemas.select.options': z.string(),
  'schemas.select.optionPlaceholder': z.string(),

  'schemas.radioGroup.groupName': z.string(),
});
export const Mode = z.enum(['viewer', 'form', 'designer']);

export const ColorType = z.enum(['rgb', 'cmyk']).optional();

export const Size = z.object({ height: z.number(), width: z.number() });

/**
 * Output Intent configuration for PDF/VT and PDF/X-4 compliance.
 * Provides color profile information for professional print environments.
 */
export const DPartOutputIntent = z.object({
  /**
   * Name of the ICC color profile (e.g., "Coated FOGRA39", "Uncoated FOGRA29").
   */
  profileName: z.string().optional(),

  /**
   * Registry name or URL for the color profile.
   * Common: "http://www.color.org"
   */
  registryName: z.string().optional(),

  /**
   * Base64-encoded ICC profile data. If provided, takes precedence over profileName/registryName.
   */
  profileData: z.string().optional(),
});

/**
 * DPart mapping configuration that bridges variable data fields to DPart metadata keys.
 * Maps professional printer DPart keys to pdfme schema names.
 */
export const DPartMapping = z.record(
  z.string(), // DPart metadata key (e.g., "InvoiceNumber", "Segment")
  z.string(), // Schema field name (e.g., "invoice_number", "region")
);

/**
 * Document Part (DPart) options for PDF/VT variable data printing.
 * Configures how records are mapped to the PDF/VT Document Part hierarchy.
 */
export const DPartOptions = z.object({
  /**
   * Enable PDF/VT Document Part (DPart) structure generation.
   * When true, each record will be mapped to a DPart node in the document catalog.
   */
  enabled: z.boolean().optional(),

  /**
   * PDF/VT version/standard to target.
   * Examples: "PDF/VT-1" (single-file), "PDF/VT-2" (multi-file streaming).
   * Defaults to "PDF/VT-1" when dpartOptions is enabled.
   */
  version: z.string().optional(),

  /**
   * Maps DPart metadata keys (recognized by professional printers) to template schema field names.
   * Example:
   * {
   *   "InvoiceNumber": "invoice_number",
   *   "Segment": "region",
   *   "RecipientID": "customer_id"
   * }
   *
   * For each input record, the generator extracts values from the mapped schema fields
   * and creates corresponding DPart nodes with these metadata keys.
   */
  mapping: DPartMapping.optional(),

  /**
   * Output Intent (color profile) configuration for PDF/X-4 and PDF/VT compliance.
   * Ensures color accuracy across professional digital printing systems.
   */
  outputIntent: DPartOutputIntent.optional(),

  /**
   * If true, enforce strict PDF/VT compliance validation.
   * Will throw errors if resources are not fully embedded or compliance rules are violated.
   */
  enforceCompliance: z.boolean().optional(),

  /**
   * Additional XMP metadata namespace version.
   * Defaults to "1.0" for PDF/VT-1 compliance.
   */
  xmpNamespaceVersion: z.string().optional(),
});

export const Schema = z
  .object({
    name: z.string(),
    type: z.string(),
    content: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }),
    width: z.number(),
    height: z.number(),
    rotate: z.number().optional(),
    opacity: z.number().optional(),
    readOnly: z.boolean().optional(),
    required: z.boolean().optional(),
    __bodyRange: z.object({ start: z.number(), end: z.number().optional() }).optional(),
    __isSplit: z.boolean().optional(),
  })
  .passthrough();

const SchemaForUIAdditionalInfo = z.object({ id: z.string() });
export const SchemaForUI = Schema.merge(SchemaForUIAdditionalInfo);

const ArrayBufferSchema: z.ZodSchema<ArrayBuffer> = z.any().refine((v) => v instanceof ArrayBuffer);
const Uint8ArraySchema: z.ZodSchema<Uint8Array<ArrayBuffer>> = z
  .any()
  .refine((v) => v instanceof Uint8Array && v.buffer instanceof ArrayBuffer);

export const BlankPdf = z.object({
  width: z.number(),
  height: z.number(),
  padding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  staticSchema: z.array(Schema).optional(),
});

export const CustomPdf = z.union([z.string(), ArrayBufferSchema, Uint8ArraySchema]);

export const BasePdf = z.union([CustomPdf, BlankPdf]);

// Legacy keyed structure for BC - we convert to SchemaPageArray on import
export const LegacySchemaPageArray = z.array(z.record(z.string(), Schema));
export const SchemaPageArray = z.array(z.array(Schema));

export const Template = z
  .object({
    schemas: SchemaPageArray,
    basePdf: BasePdf,
    pdfmeVersion: z.string().optional(),
    dpartOptions: DPartOptions.optional(),
    vt: TemplateVTConfig.optional(),
  })
  .passthrough();

export const Inputs = z.array(z.record(z.string(), z.any())).min(1);

export const Font = z.record(
  z.string(),
  z.object({
    data: z.union([z.string(), ArrayBufferSchema, Uint8ArraySchema]),
    fallback: z.boolean().optional(),
    subset: z.boolean().optional(),
  }),
);

export const Plugin = z
  .object({
    ui: z.any(),
    pdf: z.any(),
    propPanel: z.object({
      schema: z.unknown(),
      widgets: z.record(z.string(), z.any()).optional(),
      defaultSchema: Schema,
    }),
    icon: z.string().optional(),
  })
  .passthrough();

export const CommonOptions = z.object({ font: Font.optional() }).passthrough();

const CommonProps = z.object({
  template: Template,
  options: CommonOptions.optional(),
  plugins: z.record(z.string(), Plugin).optional(),
});

// -------------------generate-------------------

export const GeneratorOptions = CommonOptions.extend({
  colorType: ColorType,
  author: z.string().optional(),
  creationDate: z.date().optional(),
  creator: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  lang: Lang.optional(),
  modificationDate: z.date().optional(),
  producer: z.string().optional(),
  subject: z.string().optional(),
  title: z.string().optional(),
});

export const GenerateProps = CommonProps.extend({
  inputs: Inputs,
  options: GeneratorOptions.optional(),
}).strict();

// ---------------------ui------------------------

export const UIOptions = CommonOptions.extend({
  lang: Lang.optional(),
  labels: z.record(z.string(), z.string()).optional(),
  theme: z.record(z.string(), z.unknown()).optional(),
  icons: z.record(z.string(), z.string()).optional(),
  requiredByDefault: z.boolean().optional(),
  maxZoom: z.number().optional(),
  sidebarOpen: z.boolean().optional(),
  zoomLevel: z.number().optional(),
});

const HTMLElementSchema: z.ZodSchema<HTMLElement> = z.any().refine((v) => v instanceof HTMLElement);

export const UIProps = CommonProps.extend({
  domContainer: HTMLElementSchema,
  options: UIOptions.optional(),
});

export const PreviewProps = UIProps.extend({ inputs: Inputs }).strict();

export const DesignerProps = UIProps.extend({}).strict();
