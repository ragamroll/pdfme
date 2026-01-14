import * as pdfLib from '@pdfme/pdf-lib';
import type { GenerateProps, Schema, PDFRenderProps, Template } from '@pdfme/common';
import {
  checkGenerateProps,
  getDynamicTemplate,
  isBlankPdf,
  replacePlaceholders,
  pt2mm,
  cloneDeep,
} from '@pdfme/common';
import { getDynamicHeightsForTable } from '@pdfme/schemas';
import {
  insertPage,
  preprocessing,
  postProcessing,
  getEmbedPdfPages,
  validateRequiredFields,
} from './helper.js';
import { VTManager } from './vtManager.js';
import {
  getDPartOptionsFromTemplate,
  getVTConfigFromTemplate,
  isVTEnabled,
  extractRecordId,
  extractMetadata,
  extractDPartMetadata,
  validateVTInputs,
  validateDPartInputs,
  buildDPartMetadata,
} from './vtHelper.js';

const generate = async (props: GenerateProps): Promise<Uint8Array<ArrayBuffer>> => {
  checkGenerateProps(props);
  const { inputs, template: _template, options = {}, plugins: userPlugins = {} } = props;
  const template = cloneDeep(_template);

  const basePdf = template.basePdf;

  if (inputs.length === 0) {
    throw new Error(
      '[@pdfme/generator] inputs should not be empty, pass at least an empty object in the array',
    );
  }

  validateRequiredFields(template, inputs);

  // Initialize VT/DPart support
  const dpartOptions = getDPartOptionsFromTemplate(template);
  const vtConfig = getVTConfigFromTemplate(template);
  const enablePDFVT = (options as any).pdfvt === true; // Opt-in flag
  const isDPartEnabled = (dpartOptions?.enabled === true || enablePDFVT) && dpartOptions !== undefined;
  const isVT = isDPartEnabled || isVTEnabled(template);
  const enforceCompliance = dpartOptions?.enforceCompliance === true || (options as any).enforceVTCompliance === true;
  
  // Only enable VTManager if VT is explicitly enabled via option or template config
  const vtManager = enablePDFVT || isVT ? new VTManager(vtConfig, enforceCompliance) : null;

  // Validate inputs if enabled
  if (vtManager) {
    if (isDPartEnabled) {
      validateDPartInputs(inputs, dpartOptions);
    }
    if (isVT && !isDPartEnabled) {
      validateVTInputs(inputs, vtConfig);
    }
  }

  const { pdfDoc, renderObj } = await preprocessing({ template, userPlugins });

  const _cache = new Map<string, unknown>();

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];

    // Track the page index where this record starts (for VT DPart mapping)
    const recordStartPageIndex = vtManager ? vtManager.getRecordStartPageIndex(pdfDoc) : pdfDoc.getPageCount();

    // Get the dynamic template with proper typing
    const dynamicTemplate: Template = await getDynamicTemplate({
      template,
      input,
      options,
      _cache,
      getDynamicHeights: (value, args) => {
        switch (args.schema.type) {
          case 'table':
            return getDynamicHeightsForTable(value, args);
          default:
            return Promise.resolve([args.schema.height]);
        }
      },
    });
    const { basePages, embedPdfBoxes } = await getEmbedPdfPages({
      template: dynamicTemplate,
      pdfDoc,
    });

    // Add proper type assertion for dynamicTemplate.schemas
    const schemas = dynamicTemplate.schemas as Schema[][];
    // Create a type-safe array of schema names without using Set spread which requires downlevelIteration
    const schemaNameSet = new Set<string>();
    schemas.forEach((page: Schema[]) => {
      page.forEach((schema: Schema) => {
        if (schema.name) {
          schemaNameSet.add(schema.name);
        }
      });
    });
    const schemaNames = Array.from(schemaNameSet);

    for (let j = 0; j < basePages.length; j += 1) {
      const basePage = basePages[j];
      const embedPdfBox = embedPdfBoxes[j];

      const boundingBoxLeft =
        basePage instanceof pdfLib.PDFEmbeddedPage ? pt2mm(embedPdfBox.mediaBox.x) : 0;
      const boundingBoxBottom =
        basePage instanceof pdfLib.PDFEmbeddedPage ? pt2mm(embedPdfBox.mediaBox.y) : 0;

      const page = insertPage({ basePage, embedPdfBox, pdfDoc });

      if (isBlankPdf(basePdf) && basePdf.staticSchema) {
        for (let k = 0; k < basePdf.staticSchema.length; k += 1) {
          const staticSchema = basePdf.staticSchema[k];
          const render = renderObj[staticSchema.type];
          if (!render) {
            continue;
          }
          const value = staticSchema.readOnly
            ? replacePlaceholders({
                content: staticSchema.content || '',
                variables: { ...input, totalPages: basePages.length, currentPage: j + 1 },
                schemas: schemas, // Use the properly typed schemas variable
              })
            : staticSchema.content || '';

          staticSchema.position = {
            x: staticSchema.position.x + boundingBoxLeft,
            y: staticSchema.position.y - boundingBoxBottom,
          };

          // Create properly typed render props for static schema
          const staticRenderProps: PDFRenderProps<Schema> = {
            value,
            schema: staticSchema,
            basePdf,
            pdfLib,
            pdfDoc,
            page,
            options,
            _cache,
          };
          await render(staticRenderProps);
        }
      }

      for (let l = 0; l < schemaNames.length; l += 1) {
        const name = schemaNames[l];
        const schemaPage = schemas[j] || [];
        const schema = schemaPage.find((s: Schema) => s.name == name);
        if (!schema) {
          continue;
        }

        const render = renderObj[schema.type];
        if (!render) {
          continue;
        }
        const value: string = schema.readOnly
          ? replacePlaceholders({
              content: schema.content || '',
              variables: { ...input, totalPages: basePages.length, currentPage: j + 1 },
              schemas: schemas, // Use the properly typed schemas variable
            })
          : ((input[name] || '') as string);

        schema.position = {
          x: schema.position.x + boundingBoxLeft,
          y: schema.position.y - boundingBoxBottom,
        };

        // Create properly typed render props
        const renderProps: PDFRenderProps<Schema> = {
          value,
          schema,
          basePdf,
          pdfLib,
          pdfDoc,
          page,
          options,
          _cache,
        };
        await render(renderProps);
      }
    }

    // Register DPart information for this record if VT/DPart is enabled
    if (vtManager && (isVT || isDPartEnabled)) {
      const recordEndPageIndex = pdfDoc.getPageCount() - 1;
      
      // Use DPart mapping if available, otherwise use legacy VT config
      let recordId: string;
      let metadata: Record<string, any>;

      if (isDPartEnabled && dpartOptions) {
        // For DPart: extract record ID from input (use first mapped field as ID if available)
        const mappedFields = Object.values(dpartOptions.mapping || {});
        recordId = extractRecordId(input, i, mappedFields.length > 0 ? mappedFields : undefined);
        metadata = buildDPartMetadata(i, input, dpartOptions);
      } else {
        // For legacy VT: use configured fields
        recordId = extractRecordId(input, i, vtConfig?.recordIdFields);
        metadata = extractMetadata(input, vtConfig?.metadataFields);
      }

      vtManager.registerRecordDPart(i, recordId, recordStartPageIndex, recordEndPageIndex, metadata);

      // If DPart is enabled, create the leaf node for this record
      if (isDPartEnabled && dpartOptions) {
        vtManager.createDPartLeafNode(pdfDoc, recordId, metadata);
      }
    }
  }

  // Apply VT/DParts to the document if enabled
  if (vtManager && (isVT || isDPartEnabled)) {
    await vtManager.applyDPartsToPDF(pdfDoc);
    // Validate embedded resources if compliance mode is enabled
    vtManager.validateEmbeddedResources(pdfDoc);
  }

  postProcessing({ pdfDoc, options });

  return pdfDoc.save();
};

export default generate;
