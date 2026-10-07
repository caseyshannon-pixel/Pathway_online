import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { putPublicImage, storageConfigured } from "@/lib/blobStore";
import { forbidden, rateLimit, sameOrigin, tooMany } from "@/lib/security";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4_000_000; // stays under the host's request size limit

// Decide the type from the file's own first bytes, not the name or the type the browser claims.
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden();
  const session = await getSession();
  if (!(await isAdmin(session))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!rateLimit(`admin-thumb:${session!.personId}`, 20, 60_000)) return tooMany();

  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Saving isn't set up yet. Connect a Blob store to this project in Vercel first." },
      { status: 503 },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Try one under 4 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) {
    return NextResponse.json({ error: "Please upload a JPG, PNG or WebP image." }, { status: 400 });
  }

  try {
    const url = await putPublicImage(`pathway/thumbnails/session.${kind.ext}`, bytes, kind.type);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Thumbnail upload failed:", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
