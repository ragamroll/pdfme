import PDFDict, { DictMap } from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFRef from '../objects/PDFRef';
import PDFContext from '../PDFContext';
import PDFPageTree from './PDFPageTree';
import PDFDPart from './PDFDPart';
import { PDFAcroForm } from '../acroform';
import ViewerPreferences from '../interactive/ViewerPreferences';

class PDFCatalog extends PDFDict {
  static withContextAndPages = (context: PDFContext, pages: PDFPageTree | PDFRef) => {
    const dict = new Map();
    dict.set(PDFName.of('Type'), PDFName.of('Catalog'));
    dict.set(PDFName.of('Pages'), pages);
    return new PDFCatalog(dict, context);
  };

  static fromMapWithContext = (map: DictMap, context: PDFContext) => new PDFCatalog(map, context);

  Pages(): PDFPageTree {
    return this.lookup(PDFName.of('Pages'), PDFDict) as PDFPageTree;
  }

  AcroForm(): PDFDict | undefined {
    return this.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  }

  getAcroForm(): PDFAcroForm | undefined {
    const dict = this.AcroForm();
    if (!dict) return undefined;
    return PDFAcroForm.fromDict(dict);
  }

  getOrCreateAcroForm(): PDFAcroForm {
    let acroForm = this.getAcroForm();
    if (!acroForm) {
      acroForm = PDFAcroForm.create(this.context);
      const acroFormRef = this.context.register(acroForm.dict);
      this.set(PDFName.of('AcroForm'), acroFormRef);
    }
    return acroForm;
  }

  ViewerPreferences(): PDFDict | undefined {
    return this.lookupMaybe(PDFName.of('ViewerPreferences'), PDFDict);
  }

  getViewerPreferences(): ViewerPreferences | undefined {
    const dict = this.ViewerPreferences();
    if (!dict) return undefined;
    return ViewerPreferences.fromDict(dict);
  }

  getOrCreateViewerPreferences(): ViewerPreferences {
    let viewerPrefs = this.getViewerPreferences();
    if (!viewerPrefs) {
      viewerPrefs = ViewerPreferences.create(this.context);
      const viewerPrefsRef = this.context.register(viewerPrefs.dict);
      this.set(PDFName.of('ViewerPreferences'), viewerPrefsRef);
    }
    return viewerPrefs;
  }

  DPart(): PDFDPart | undefined {
    return this.lookupMaybe(PDFName.of('DPartRoot'), PDFDict) as PDFDPart | undefined;
  }

  getDPart(): PDFDPart | undefined {
    const dict = this.DPart();
    if (!dict) return undefined;
    return dict as PDFDPart;
  }

  getOrCreateDPart(): PDFDPart {
    let dpart = this.getDPart();
    if (!dpart) {
      dpart = PDFDPart.withContext(this.context);
      const dpartRef = this.context.register(dpart);
      this.set(PDFName.of('DPartRoot'), dpartRef);
    }
    return dpart;
  }

  setXMP(xmp: string): void {
    const xmpStream = this.context.stream(xmp);
    const xmpRef = this.context.register(xmpStream);
    this.set(PDFName.of('Metadata'), xmpRef);
  }

  /**
   * Inserts the given ref as a leaf node of this catalog's page tree at the
   * specified index (zero-based). Also increments the `Count` of each node in
   * the page tree hierarchy to accomodate the new page.
   *
   * Returns the ref of the PDFPageTree node into which `leafRef` was inserted.
   */
  insertLeafNode(leafRef: PDFRef, index: number): PDFRef {
    const pagesRef = this.get(PDFName.of('Pages')) as PDFRef;
    const maybeParentRef = this.Pages().insertLeafNode(leafRef, index);
    return maybeParentRef || pagesRef;
  }

  removeLeafNode(index: number): void {
    this.Pages().removeLeafNode(index);
  }
}

export default PDFCatalog;
