// O mjml 5 não publica tipos; só o que a F7 usa.
declare module "mjml" {
  export type MjmlError = { line?: number; message: string; formattedMessage?: string; tagName?: string };
  export type MjmlOptions = { validationLevel?: "strict" | "soft" | "skip"; minify?: boolean; keepComments?: boolean };
  export default function mjml2html(
    input: string,
    options?: MjmlOptions,
  ): Promise<{ html: string; errors: MjmlError[] }>;
}
