import PDFArray from '../objects/PDFArray';
import PDFDict, { DictMap } from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFRef from '../objects/PDFRef';
import PDFContext from '../PDFContext';
import PDFStream from '../objects/PDFStream';
import PDFObject from '../objects/PDFObject';

class PDFDPart extends PDFDict {
  static withContext = (context: PDFContext, metadata?: PDFDict | PDFStream | PDFObject | PDFRef, isRoot: boolean = false) => {
    const dict = new Map();
    dict.set(PDFName.of('Type'), PDFName.of('DPart'));
    if (metadata) dict.set(PDFName.of('Metadata'), metadata);
    return new PDFDPart(dict, context, isRoot);
  };

  static fromMapWithContext = (map: DictMap, context: PDFContext) => new PDFDPart(map, context, false);

  private isRoot: boolean;

  constructor(map: DictMap, context: PDFContext, isRoot: boolean = false) {
    super(map, context);
    this.isRoot = isRoot;
  }

  Metadata(): PDFDict | PDFStream | undefined {
    return this.lookupMaybe(PDFName.of('Metadata'), PDFDict, PDFStream);
  }

  setMetadata(metadata: PDFDict | PDFStream | PDFObject | PDFRef): void {
    this.set(PDFName.of('Metadata'), metadata);
  }

  Parent(): PDFDPart | undefined {
    return this.lookupMaybe(PDFName.of('Parent'), PDFDict) as PDFDPart | undefined;
  }

  setParent(parent: PDFDPart): void {
    this.set(PDFName.of('Parent'), parent);
  }

  Children(): PDFArray | undefined {
    // Root node uses /DParts, child nodes use /Children
    const childrenKey = this.isRoot ? PDFName.of('DParts') : PDFName.of('Children');
    return this.lookupMaybe(childrenKey, PDFArray);
  }

  addChild(child: PDFDPart): void {
    // Root node uses /DParts, child nodes use /Children
    const childrenKey = this.isRoot ? PDFName.of('DParts') : PDFName.of('Children');
    let children = this.lookupMaybe(childrenKey, PDFArray);
    if (!children) {
      children = this.context.obj([]);
      this.set(childrenKey, children);
    }
    children.push(child);
  }
}

export default PDFDPart;