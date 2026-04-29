export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 10;

// GET /api/data/campagnes/segments — list all segments ordered alphabetically
export async function GET() {
  const { data, error } = await supabase
    .from("segments")
    .select("name")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ segments: (data ?? []).map((r) => r.name) });
}

// POST /api/data/campagnes/segments — create a new segment { name }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim().toUpperCase();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { error } = await supabase.from("segments").insert({ name });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Segment déjà existant" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}

// PUT /api/data/campagnes/segments — rename { old, new } + cascade to campagnes
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const oldName = (body.old ?? "").trim();
  const newName = (body.new ?? "").trim().toUpperCase();
  if (!oldName || !newName) {
    return NextResponse.json({ error: "old and new required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("segments")
    .update({ name: newName })
    .eq("name", oldName);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cascade: update all contacts that had the old segment name
  await supabase.from("campagnes").update({ segment: newName }).eq("segment", oldName);
  return NextResponse.json({ ok: true });
}

// DELETE /api/data/campagnes/segments — remove segment { name } (contacts keep orphan value)
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { error } = await supabase.from("segments").delete().eq("name", name);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
