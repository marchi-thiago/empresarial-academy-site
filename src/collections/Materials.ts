import type { CollectionConfig } from "payload";
import { formatSlug } from "@/lib/slug";
import { sendNewMaterialAlert } from "@/lib/content-alerts";
import { eaEditor } from "@/lib/editor";
import { buildPreviewUrl } from "@/lib/preview";
import { requiredToPublish, requiredToPublishRichText } from "@/lib/publish-validation";
import { isContentEngineRequest } from "@/lib/content-engine-auth";

export const Materials: CollectionConfig = {
  slug: "materials",
  labels: { singular: "Material", plural: "Materiais" },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "downloads", "status"],
        group: "Conteúdo do Site",
    preview: (doc) =>
      doc?.slug ? buildPreviewUrl("materials", String(doc.slug)) : null,
    components: {
      edit: {
        PublishButton: "@/components/admin/publish/PublishButton#PublishButton",
      },
    },
  },
  access: {
    // Público lê apenas materiais publicados; usuários autenticados e o EA
    // Post (via chave própria) veem tudo — o cron check-site-publications
    // precisa ler o próprio rascunho que criou pra saber quando foi publicado.
    read: ({ req }) => {
      if (req.user || isContentEngineRequest(req)) return true;
      return { status: { equals: "published" } };
    },
    // EA Post cria rascunho de material e pode atualizar status para published ao aprovar/publicar.
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
      name: "description",
      type: "textarea",
      label: "Descrição (resumo)",
      admin: { description: "Resumo curto exibido na listagem e no topo da página do material." },
      validate: requiredToPublish("Descrição"),
    },
    {
      name: "content",
      type: "richText",
      label: "Conteúdo (texto completo)",
      editor: eaEditor,
      admin: { description: "Texto rico exibido na página do material (abaixo do resumo). Importável do .md." },
      validate: requiredToPublishRichText("Conteúdo"),
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      label: "Imagem de capa",
      validate: requiredToPublish("Imagem de capa"),
    },
    {
      name: "file",
      type: "upload",
      relationTo: "material-files",
      required: true,
      label: "Arquivo para download",
      admin: { description: "Arquivo que o visitante baixa no site (PDF, Excel, Word, PPT, .md, ZIP…)." },
    },
    {
      name: "kind",
      type: "select",
      label: "Tipo de material",
      defaultValue: "ebook",
      admin: { position: "sidebar" },
      options: [
        { label: "E-book", value: "ebook" },
        { label: "Planilha", value: "planilha" },
        { label: "Template", value: "template" },
        { label: "Checklist", value: "checklist" },
        { label: "Guia", value: "guia" },
        { label: "Apresentação", value: "apresentacao" },
        { label: "Vídeo", value: "video" },
      ],
      validate: requiredToPublish("Tipo de material"),
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "material-categories",
      label: "Categoria",
      admin: { position: "sidebar" },
      validate: requiredToPublish("Categoria"),
    },
    {
      name: "version",
      type: "text",
      label: "Versão",
      admin: { position: "sidebar", description: "Ex.: v1.0, 2026" },
      validate: requiredToPublish("Versão"),
    },
    {
      name: "downloads",
      type: "number",
      label: "Downloads",
      defaultValue: 0,
      admin: { position: "sidebar", readOnly: true },
    },
    {
      name: "featured",
      type: "checkbox",
      label: "Destaque",
      admin: { position: "sidebar" },
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
      admin: { position: "sidebar", date: { pickerAppearance: "dayAndTime" } },
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
      label: "Alerta de novo material enviado",
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
        // Garante que o material sempre tenha uma categoria associada (Gestão ou primeira existente),
        // evitando erro de validação ("Categoria é obrigatório para publicar") ao publicar via IA/API.
        if (data && !data.category && !originalDoc?.category) {
          try {
            const catRes = await req.payload.find({
              collection: "material-categories",
              where: { name: { equals: "Gestão" } },
              limit: 1,
            });
            if (catRes.docs.length > 0) {
              data.category = catRes.docs[0].id;
            } else {
              const firstCat = await req.payload.find({
                collection: "material-categories",
                limit: 1,
              });
              data.category = firstCat.docs.length > 0 ? firstCat.docs[0].id : 1;
            }
          } catch {
            data.category = 1;
          }
        }
        return data;
      },
    ],
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === "create" && !req.user && data?.status === "published") {
          data.status = "draft";
        }
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
        // Material AGENDADO (data futura): o cron diário envia quando a
        // data chegar (sendPendingContentAlerts) — mesmo motivo dos Posts.
        const isScheduledForFuture =
          doc.publishedAt && new Date(doc.publishedAt).getTime() > Date.now();
        if (!justPublished || isScheduledForFuture) return doc;
        // Dispara em background — NÃO bloqueia a resposta do Salvar/Publicar
        // (ver mesmo comentário em Posts.ts).
        void (async () => {
          try {
            await sendNewMaterialAlert({
              title: doc.title,
              description: doc.description,
              slug: doc.slug,
            });
            await req.payload.update({
              collection: "materials",
              id: doc.id,
              data: { subscriberAlertSent: true },
            });
          } catch (e) {
            req.payload.logger.error(`[materials] falha ao enviar alerta de novo material: ${e}`);
          }
        })();
        return doc;
      },
    ],
  },
};
