declare module "word-extractor" {
  export default class WordExtractor {
    extract(source: string): Promise<{
      getBody(): string;
      getFootnotes?(): string;
      getHeaders?(): string;
    }>;
  }
}
