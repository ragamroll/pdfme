import PDFArray from '../objects/PDFArray';
import PDFDict, { DictMap } from '../objects/PDFDict';
import PDFName from '../objects/PDFName';
import PDFRef from '../objects/PDFRef';
import PDFContext from '../PDFContext';

class PDFDPart extends PDFDict {
  static withContext = (context: PDFContext, metadata?: PDFDict) => {
    const dict = new Map();
    dict.set(PDFName.of('Type'), PDFName.of('DPart'));
    if (metadata) dict.set(PDFName.of('Metadata'), metadata);
    return new PDFDPart(dict, context);
  };

  static fromMapWithContext = (map: DictMap, context: PDFContext) => new PDFDPart(map, context);

  Metadata(): PDFDict | undefined {
    return this.lookupMaybe(PDFName.of('Metadata'), PDFDict);
  }

  setMetadata(metadata: PDFDict): void {
    this.set(PDFName.of('Metadata'), metadata);
  }

  Parent(): PDFDPart | undefined {
    return this.lookupMaybe(PDFName.of('Parent'), PDFDict) as PDFDPart | undefined;
  }

  setParent(parent: PDFDPart): void {
    this.set(PDFName.of('Parent'), parent);
  }

  Children(): PDFArray | undefined {
    return this.lookupMaybe(PDFName.of('Children'), PDFArray);
  }

  addChild(child: PDFDPart): void {
    let children = this.Children();
    if (!children) {
      children = this.context.obj([]);
      this.set(PDFName.of('Children'), children);
    }
    children.push(child);
  }
}

export default PDFDPart;