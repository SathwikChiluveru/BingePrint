import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_NEXT, safeNext } from "../safe-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `redirectTo` is the older name, still accepted so links sent before the rename keep working
  const next = safeNext(searchParams.get("next") ?? searchParams.get("redirectTo"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next ?? DEFAULT_NEXT}`);
    }
  }

  // Keep the intent so a retry still lands where the user was heading
  const retry = new URL("/auth/login", origin);
  retry.searchParams.set("error", "auth_failed");
  if (next) retry.searchParams.set("next", next);
  return NextResponse.redirect(retry);
}
