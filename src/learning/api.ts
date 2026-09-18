import { supabase } from "../lib/supabase";
import type { Material, SourcePage, StudySession } from "./model";

export async function learningAction<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("material-study", {
    body,
  });
  if (error) {
    let message =
      "Study service is unavailable. Your saved material is safe; please try again.";
    try {
      const details = await error.context?.json();
      if (details?.error) message = details.error;
    } catch {
      /* Keep recoverable fallback. */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function fetchLibrary(
  userId: string,
): Promise<{ materials: Material[]; sessions: StudySession[] }> {
  const [materials, sessions] = await Promise.all([
    supabase
      .from("materials")
      .select(
        "id,title,created_at,course:metadata->>course,exam_on:metadata->>exam_on,topics:metadata->topics,confirmed:metadata->confirmed,page_count:metadata->page_count",
      )
      .eq("owner_user_id", userId)
      .contains("metadata", { workspace: "curve" })
      .order("created_at", { ascending: false }),
    supabase
      .from("curve_material_sessions")
      .select(
        "id,material_id,mode,topic,questions,answers,hints,results,created_at,completed_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (materials.error)
    throw new Error("Could not load your library. Please retry.");
  if (sessions.error)
    throw new Error("Could not load your saved sessions. Please retry.");
  return {
    materials: materials.data.map((m) => ({
      id: m.id,
      title: m.title,
      created_at: m.created_at,
      extracted_text: null,
      metadata: {
        course: m.course,
        exam_on: m.exam_on,
        topics: m.topics,
        confirmed: m.confirmed,
        page_count: m.page_count,
      },
    })) as Material[],
    sessions: sessions.data as StudySession[],
  };
}

export async function saveMaterial(
  userId: string,
  title: string,
  course: string,
  exam: string,
  pages: SourcePage[],
): Promise<Material> {
  const text = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n");
  const { data, error } = await supabase
    .from("materials")
    .insert({
      owner_user_id: userId,
      visibility: "private",
      material_type: "upload",
      title,
      extracted_text: text,
      metadata: {
        workspace: "curve",
        course,
        exam_on: exam || null,
        pages,
        page_count: pages.length,
        topics: [],
        confirmed: false,
      },
    })
    .select("id,title,created_at,extracted_text,metadata")
    .single();
  if (error) throw new Error("Could not save this material. Please retry.");
  return data as Material;
}

export async function readMaterialFile(file: File): Promise<SourcePage[]> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a file smaller than 20 MB.");
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const document = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      isEvalSupported: false,
    }).promise;
    try {
      if (document.numPages > 100)
        throw new Error("Use a chapter or lecture PDF of up to 100 pages.");
      const pages: SourcePage[] = [];
      for (let n = 1; n <= document.numPages; n++) {
        const content = await (await document.getPage(n)).getTextContent();
        pages.push({
          page: n,
          text: content.items
            .map((item) =>
              "str" in item
                ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
                : "",
            )
            .join(""),
        });
      }
      if (pages.reduce((sum, p) => sum + p.text.trim().length, 0) < 100)
        throw new Error(
          "This PDF has no readable text. Paste its text or upload a searchable PDF.",
        );
      if (pages.reduce((sum, p) => sum + p.text.length, 0) > 300000)
        throw new Error(
          "Split this material into smaller chapters (up to 300,000 characters).",
        );
      return pages;
    } finally {
      await document.destroy();
    }
  }
  if (!/\.(txt|md)$/i.test(file.name))
    throw new Error(
      "Supported files: PDF, TXT, and Markdown. You can also paste notes.",
    );
  const text = await file.text();
  if (text.trim().length < 100 || text.length > 300000)
    throw new Error(
      "Use between 100 and 300,000 characters of teaching material.",
    );
  return [{ page: 1, text }];
}

export async function fetchMaterial(
  id: string,
  userId: string,
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .select("id,title,created_at,extracted_text,metadata")
    .eq("id", id)
    .eq("owner_user_id", userId)
    .single();
  if (error || !data)
    throw new Error("Could not open your material. Please retry.");
  return data as Material;
}
