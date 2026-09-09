import type { CollectionConfig } from "payload";
import { formatSlug } from "@/lib/slug";
import { sendNewPostAlert } from "@/lib/content-alerts";
import { eaEditor } from "@/lib/editor";
import { buildPreviewUrl } from "@/lib/preview";
import {
  requiredToPublish,
  requiredToPublishArray,
  requiredToPublishRichText,
} from "@/lib/publish-validation";
import { isContentEngineRequest } from "@/lib/content-engine-auth";

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Artigo", plural: "Artigos" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "status", "publishedAt"],
        group: "Conteúdo do Site",
    // Botão "Visualizar": abre o artigo no layout REAL do blog (mesmo em
    // rascunho), via rota /preview autenticada por segredo.
    preview: (doc) =>
      doc?.slug ? buildPreviewUrl("posts", String(doc.slug)) : null,
    components: {
      edit: {
        PublishButton: "@/components/admin/publish/PublishButton#PublishButton",
      },
    },
  },
  access: {
    // Público lê apenas artigos publicados; usuários autenticados e o EA Post
    // (via chave própria) veem tudo — o cron check-site-publications precisa
    // ler o próprio rascunho que criou pra saber quando foi publicado.
    read: ({ req }) => {
      if (req.user || isContentEngineRequest(req)) return true;
      return { status: { equals: "published" } };
    },
    // EA Post cria rascunho de artigo e pode atualizar status para published ao aprovar/publicar.
    create: ({ req }) => Boolean(req.user) || isContentEngineRequest(req),
    update: ({ req }) => Boolean(req.user) || isContentEngineRequest(req),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "importMarkdown",
      type: "ui",
      admin: {
        components: {
          Field: "@/components/admin/ImportMarkdownButton#ImportMarkdownButton",
        },
      },
    },
    { name: "title", type: "text", required: true, label: "Título" },
    {
      name: "slug",
      type: "text",
      unique: true,
      index: true,
      label: "Slug (URL)",
      admin: { position: "sidebar" },
      hooks: { beforeValidate: [formatSlug("title")] },
    },
    {
      name: "excerpt",
      type: "textarea",
      label: "Resumo",
      maxLength: 300,
      admin: { description: "Texto curto exibido na listagem e no SEO." },
      validate: requiredToPublish("Resumo"),
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      label: "Imagem destacada",
      validate: requiredToPublish("Imagem destacada"),
    },
    {
      name: "content",
      type: "richText",
      label: "Conteúdo",
      editor: eaEditor,
      validate: requiredToPublishRichText("Conteúdo"),
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      label: "Categoria",
      admin: { position: "sidebar" },
      validate: requiredToPublish("Categoria"),
    },
    {
      name: "tags",
      type: "array",
      label: "Tags",
      admin: { position: "sidebar" },
      fields: [{ name: "tag", type: "text" }],
      validate: requiredToPublishArray("Tags"),
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      label: "Autor",
      admin: { position: "sidebar" },
      validate: requiredToPublish("Autor"),
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      label: "Status",
      admin: { position: "sidebar" },
      options: [
        { label: "Rascunho", value: "draft" },
        { label: "Publicado", value: "published" },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
      label: "Publicar em",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: "Datas futuras agendam a publicação.",
      },
    },
    {
      name: "seo",
      type: "group",
      label: "SEO",
      fields: [
        { name: "metaTitle", type: "text", label: "Meta title", validate: requiredToPublish("Meta title") },
        {
          name: "metaDescription",
          type: "textarea",
          label: "Meta description",
          validate: requiredToPublish("Meta description"),
        },
      ],
    },
    {
      name: "subscriberAlertSent",
      type: "checkbox",
      label: "Alerta de novo artigo enviado",
      defaultValue: false,
      admin: {
        position: "sidebar",
        readOnly: true,
        description:
          "Marcado automaticamente quando o e-mail de novo conteúdo é disparado aos assinantes da newsletter, ao publicar.",
      },
    },
    {
      name: "likes",
      type: "number",
      label: "Curtidas",
      defaultValue: 0,
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "dislikes",
      type: "number",
      label: "Não curtidas",
      defaultValue: 0,
      admin: { position: "sidebar", readOnly: true },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        // Garante que o artigo sempre tenha um autor associado (Thiago Marchi ou primeiro admin),
        // evitando falha na regra requiredToPublish("Autor") ao publicar rascunhos criados via IA/API.
        if (data && !data.author && !originalDoc?.author) {
          try {
            const authorRes = await req.payload.find({
              collection: "users",
              where: { name: { equals: "Thiago Marchi" } },
              limit: 1,
            });
            if (authorRes.docs.length > 0) {
              data.author = authorRes.docs[0].id;
            } else {
              const firstUser = await req.payload.find({
                collection: "users",
                limit: 1,
              });
              if (firstUser.docs.length > 0) {
                data.author = firstUser.docs[0].id;
              } else {
                data.author = 1;
              }
            }
          } catch {
            data.author = 1;
          }
        }
        return data;
      },
    ],
    beforeChange: [
      ({ data, req, operation }) => {
        // Defesa em profundidade: o EA Post (token de serviço, sem sessão de
        // usuário) NUNCA cria artigo já publicado, mesmo que o motor envie
        // "published" por engano — a regra "sempre rascunho" fica garantida
        // aqui, não só no código de quem chama a API.
        if (operation === "create" && !req.user && data?.status === "published") {
          data.status = "draft";
        }
        // Define publishedAt automaticamente ao publicar sem data informada.
        if (data?.status === "published" && !data?.publishedAt) {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
    afterChange: [
      ({ doc, previousDoc, req }) => {
        const justPublished =
          doc.status === "published" &&
          previousDoc?.status !== "published" &&
          !doc.subscriberAlertSent;
        // Post AGENDADO (data futura): não avisar agora — o cron diário
        // (sendPendingContentAlerts) envia quando a data chegar, para o
        // assinante não receber link de artigo ainda invisível.
        const isScheduledForFuture =
          doc.publishedAt && new Date(doc.publishedAt).getTime() > Date.now();
        if (!justPublished || isScheduledForFuture) return doc;
        // Dispara em background — NÃO bloqueia a resposta do Salvar/Publicar.
        // Awaitar aqui prende o "Submitting..." até enviar e-mail pra CADA
        // assinante da newsletter, um por um (podem ser dezenas/centenas).
        void (async () => {
          try {
            await sendNewPostAlert({ title: doc.title, excerpt: doc.excerpt, slug: doc.slug });
            await req.payload.update({
              collection: "posts",
              id: doc.id,
              data: { subscriberAlertSent: true },
            });
          } catch (e) {
            req.payload.logger.error(`[posts] falha ao enviar alerta de novo artigo: ${e}`);
          }
        })();
        return doc;
      },
    ],
  },
};
