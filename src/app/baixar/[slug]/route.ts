import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload";

// Conta o download e redireciona para o arquivo do material.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const payload = await getPayloadClient();

  const { docs } = await payload.find({
    collection: "materials",
    where: {
      and: [{ slug: { equals: slug } }, { status: { equals: "published" } }],
    },
    depth: 1,
    limit: 1,
  });

  const material = docs[0];
  const file = material && typeof material.file === "object" ? material.file : null;

  if (!material || !file?.url) {
    return NextResponse.json(
      { error: "Material não encontrado." },
      { status: 404 },
    );
  }

  // Incrementa o contador de downloads (sem bloquear o redirecionamento se falhar).
  try {
    await payload.update({
      collection: "materials",
      id: material.id,
      data: { downloads: (material.downloads ?? 0) + 1 },
    });
  } catch {
    // ignore
  }

  return NextResponse.redirect(new URL(file.url, process.env.NEXT_PUBLIC_SITE_URL || request.url), { status: 302 });
}
