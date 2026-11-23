// subset-font ships no type declarations; this is the part scripts/generate-fonts.ts uses.
declare module 'subset-font' {
  interface SubsetFontOptions {
    /** `sfnt` is the raw TrueType/OpenType flavour (a .ttf file). */
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    features?: string;
    variationAxes?: Record<string, number | string>;
  }

  export default function subsetFont(
    buffer: Uint8Array | ArrayBuffer,
    text: string,
    options?: SubsetFontOptions
  ): Promise<Uint8Array>;
}
