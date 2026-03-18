export const dynamic = "force-dynamic";

import { detecterColonnes } from "@/lib/detecterColonnes";

export async function POST(req: Request) {
  try {
    const { headers, sampleRows } = await req.json();

    if (!Array.isArray(headers) || headers.length === 0) {
      return Response.json({ error: "headers manquants", mapping: {} }, { status: 400 });
    }

    const result = detecterColonnes(headers, sampleRows ?? []);
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ error: String(err?.message ?? err), mapping: {} }, { status: 500 });
  }
}
