import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ─── /api/competitors ────────────────────────────────────────────────────────
// Manages the list of LinkedIn competitors watched by Auto 1.
// n8n reads this list via GET before each scraping run.
//
// GET    /api/competitors            → { competitors: Competitor[] }
// POST   /api/competitors            → add    { name, linkedin_url }
// DELETE /api/competitors            → remove { name }

export interface Competitor {
  name: string;
  linkedin_url: string;
}

// GET — used by n8n at the start of Auto 1 to fetch the current list
export async function GET() {
  const { data, error } = await supabase
    .from("competitors")
    .select("name, linkedin_url")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ competitors: data as Competitor[] });
}

// POST — add a competitor { name, linkedin_url }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Partial<Competitor>;
  const name         = (body.name         ?? "").trim();
  const linkedin_url = (body.linkedin_url ?? "").trim();

  if (!name || !linkedin_url) {
    return NextResponse.json(
      { error: "Les champs 'name' et 'linkedin_url' sont requis" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("competitors")
    .insert({ name, linkedin_url });

  if (error) {
    // Unique constraint violation → duplicate
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `"${name}" est déjà dans la liste` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return full updated list
  const { data, error: fetchError } = await supabase
    .from("competitors")
    .select("name, linkedin_url")
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ competitors: data as Competitor[] }, { status: 201 });
}

// DELETE — remove a competitor by name { name }
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { name?: string };
  const name = (body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Le champ 'name' est requis" }, { status: 400 });
  }

  const { error } = await supabase
    .from("competitors")
    .delete()
    .eq("name", name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return full updated list
  const { data, error: fetchError } = await supabase
    .from("competitors")
    .select("name, linkedin_url")
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ competitors: data as Competitor[] });
}
