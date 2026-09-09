import { NextResponse } from "next/server";
import matter from "gray-matter";
import { getPayloadClient } from "@/lib/payload";
import { convertMarkdownToLexical, defaultEditorConfig, sanitizeServerEditorConfig } from "@payloadcms/richtext-lexical";
import { isContentEngineRequest } from "@/lib/content-engine-auth";

/**
 * Importador de conteúdo `.md` para o EA HUB. Recebe um arquivo Markdown com
 * YAML frontmatter e devolve `{ frontmatter, lexical }` para o
 * ImportMarkdownButton preencher os campos do Artigo/Material no admin.
 *
 * O corpo é convertido para Lexical com `defaultEditorConfig` — gera só nós
 * padrão (parágrafos, títulos, listas, negrito, links), 100% compatíveis com
 * o editor EA (que apenas ADICIONA barra fixa + paleta de cor/tamanho; a
 * paleta é aplicada à mão, nunca vem do markdown). Acesso restrito a usuários
 * autenticados do admin.
 */
export async function POST(req: Request) {
  try {
    const payload = await getPayloadClient();

    // Usuário autenticado do admin (botão de importar) OU o EA Post via
    // bearer token (Fases B/D do plano de conteúdo semanal, 19/08/2026).
    const { user } = await payload.auth({ headers: req.headers });
    if (!user && !isContentEngineRequest({ headers: req.headers })) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    // Posts e Materials têm coleções de categoria DIFERENTES (`categories` vs
    // `material-categories`) — sem saber de qual coleção o botão foi acionado,
    // a busca de categoria sempre caía na de Posts, então nunca resolvia em
    // Materials. O botão manda o slug da coleção atual (useDocumentInfo).
    const targetCollection = formData.get("collection") as string | null;
    const categoryCollection =
      targetCollection === "materials" ? "material-categories" : "categories";

    const text = await file.text();
    const { data: frontmatter, content } = matter(text);

    // Resolve relacionamentos por nome/título.
    if (frontmatter.category) {
      const catRes = await payload.find({
        collection: categoryCollection,
        where: { name: { equals: frontmatter.category } },
        limit: 1,
      });
      if (catRes.docs.length > 0) frontmatter.categoryId = catRes.docs[0].id;
    }
    const authorTarget = frontmatter.author || "Thiago Marchi";
    const authorRes = await payload.find({
      collection: "users",
      where: { name: { equals: authorTarget } },
      limit: 1,
    });
    if (authorRes.docs.length > 0) {
      frontmatter.authorId = authorRes.docs[0].id;
    } else {
      const anyUser = await payload.find({ collection: "users", limit: 1 });
      if (anyUser.docs.length > 0) frontmatter.authorId = anyUser.docs[0].id;
    }

    // `convertMarkdownToLexical` exige a config SANITIZADA (com `features.nodes`
    // resolvido). Passar `defaultEditorConfig` cru quebra com "Cannot read
    // properties of undefined (reading 'map')" em getEnabledNodesFromServerNodes
    // (features.nodes === undefined). `sanitizeServerEditorConfig` resolve as
    // features usando o config completo do Payload.
    const sanitizedEditorConfig = await sanitizeServerEditorConfig(
      defaultEditorConfig,
      payload.config,
    );
    const lexicalState = convertMarkdownToLexical({
      editorConfig: sanitizedEditorConfig,
      markdown: content,
    });

    return NextResponse.json({ frontmatter, lexical: lexicalState });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Erro ao fazer parse do markdown:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
