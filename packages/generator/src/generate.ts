import * as pdfLib from '@pdfme/pdf-lib';
import type { GenerateProps, Schema, PDFRenderProps, Template, DPartOptions } from '@pdfme/common';
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
  getBlankPdf,
} from './helper.js';

const generate = async (props: GenerateProps): Promise<Uint8Array<ArrayBuffer>> => {
  checkGenerateProps(props);
  const { inputs, template: _template, options = {}, plugins: userPlugins = {} } = props;
  const template = cloneDeep(_template);

  let basePdf = template.basePdf;
  
  // Use blank PDF if basePdf is not provided
  if (!basePdf) {
    const blankPdfBase64 = await getBlankPdf();
    basePdf = blankPdfBase64;
    template.basePdf = basePdf;
  }

  if (inputs.length === 0) {
    throw new Error(
      '[@pdfme/generator] inputs should not be empty, pass at least an empty object in the array',
    );
  }

  validateRequiredFields(template, inputs);

  const { pdfDoc, renderObj } = await preprocessing({ template, userPlugins });

  // PDF/VT setup
  let dpartRoot: pdfLib.PDFDPart | undefined;
  console.log("DEBUG: dpartOptions in generator:", template.dpartOptions);
  const dpartOptions = template.dpartOptions;
  if (dpartOptions?.enabled) {
    dpartRoot = pdfDoc.catalog.getOrCreateDPart();
    // Set XMP metadata for PDF/VT
    const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfvt="http://www.gts-1.com/namespace/pdfvt/">
      <pdfvt:version>${dpartOptions.version}</pdfvt:version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
    pdfDoc.setXMP(xmp);
    // Set Output Intent
    if (dpartOptions.outputIntent) {
      pdfDoc.setOutputIntent({
        subtype: 'GTS_PDFX',
        outputCondition: dpartOptions.outputIntent.profileName,
        outputConditionIdentifier: dpartOptions.outputIntent.profileName.replace(/\s+/g, ''),
        registryName: dpartOptions.outputIntent.registryName,
      });
    }
  }

  const _cache = new Map<string, unknown>();

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i];
    const pagesForInput: pdfLib.PDFPage[] = [];

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
      pagesForInput.push(page);

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

    // PDF/VT: Create DPart node for this input
    if (dpartRoot && dpartOptions) {
      const dpartNode = pdfLib.PDFDPart.withContext(pdfDoc.context);
      // Set metadata based on mapping
      const metadata = pdfDoc.context.obj({});
      for (const [key, field] of Object.entries(dpartOptions.mapping)) {
        if (input[field]) {
          metadata.set(pdfLib.PDFName.of(key), pdfLib.PDFString.of(String(input[field])));
        }
      }
      dpartNode.setMetadata(metadata);
      dpartRoot.addChild(dpartNode);
      // Set DPart on each page for this input
      for (const page of pagesForInput) {
        page.setDPart(dpartNode);
      }
    }
  }

  postProcessing({ pdfDoc, options });
  if (dpartOptions?.enabled) { 
    const dpartRoot = pdfDoc.catalog.get(pdfLib.PDFName.of("DPartRoot")) || pdfDoc.catalog.get(pdfLib.PDFName.of("DPart"));
    if (dpartRoot) {
      pdfDoc.catalog.set(pdfLib.PDFName.of("DPartRoot"), dpartRoot);
    }
  }

  return pdfDoc.save({ useObjectStreams: false });
};

export default generate;
