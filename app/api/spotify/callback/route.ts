import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/spotify";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  // Behind ngrok, req.url is reconstructed from forwarded headers and can point
  // at https://localhost:3000 — redirect relative to the configured OAuth origin instead
  const appOrigin = new URL(process.env.SPOTIFY_REDIRECT_URI!).origin;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_oauth_state")?.value;

  // Clear state cookie immediately
  cookieStore.delete("spotify_oauth_state");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?spotify_error=${encodeURIComponent(error)}`, appOrigin),
    );
  }

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/?spotify_error=invalid_state", appOrigin),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens in secure httpOnly cookies
    cookieStore.set("spotify_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
    cookieStore.set("spotify_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    cookieStore.set("spotify_expires_at", String(tokens.expires_at), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return NextResponse.redirect(new URL("/?spotify_connected=1", appOrigin));
  } catch (err: any) {
    console.error("Spotify callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/?spotify_error=${encodeURIComponent(err.message || "auth_failed")}`,
        appOrigin,
      ),
    );
  }
}
