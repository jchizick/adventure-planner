import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import { sendBrevoEmail } from "./brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Function configuration is incomplete." }, 500);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: "Authentication required." }, 401);

  let body: { invitationId?: string; rawToken?: string; appOrigin?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (!body.invitationId || !body.rawToken || !body.appOrigin)
    return json({ error: "Invitation details are incomplete." }, 400);

  let origin: string;
  try {
    const parsedOrigin = new URL(body.appOrigin);
    if (parsedOrigin.protocol !== "https:" && parsedOrigin.hostname !== "localhost")
      return json({ error: "Invalid application origin." }, 400);
    origin = parsedOrigin.origin;
  } catch {
    return json({ error: "Invalid application origin." }, 400);
  }

  const { data: invitation, error: invitationError } = await client
    .from("space_invitations")
    .select("id, email, expires_at, accepted_at, revoked_at, invited_by, spaces(name), profiles!space_invitations_invited_by_fkey(display_name)")
    .eq("id", body.invitationId)
    .eq("invited_by", user.id)
    .single();
  if (invitationError || !invitation)
    return json({ error: "Invitation not available." }, 404);
  if (invitation.accepted_at || invitation.revoked_at || new Date(invitation.expires_at) <= new Date())
    return json({ error: "Invitation is no longer active." }, 409);

  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const fromEmail = Deno.env.get("INVITATION_FROM_EMAIL");

  const space = Array.isArray(invitation.spaces) ? invitation.spaces[0] : invitation.spaces;
  const inviter = Array.isArray(invitation.profiles) ? invitation.profiles[0] : invitation.profiles;
  const inviteUrl = `${origin}/invite/${encodeURIComponent(body.rawToken)}`;
  const inviterName = inviter?.display_name ?? "Your adventure partner";
  const spaceName = space?.name ?? "Our Adventures";
  const expiry = new Date(invitation.expires_at).toUTCString();
  const delivery = await sendBrevoEmail({
    apiKey: brevoKey,
    fromEmail,
    to: invitation.email,
    subject: `You’re invited to ${spaceName}`,
    htmlContent: `<p>${escapeHtml(inviterName)} invited you to plan together in <strong>${escapeHtml(spaceName)}</strong>.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This invitation expires ${escapeHtml(expiry)}.</p>`,
    textContent: `${inviterName} invited you to plan together in ${spaceName}.\n\nAccept invitation: ${inviteUrl}\n\nThis invitation expires ${expiry}.`,
    sensitiveValues: [body.rawToken, encodeURIComponent(body.rawToken), inviteUrl],
  });

  if (!delivery.delivered) {
    if (delivery.reason === "not_configured")
      return json({ delivered: false, reason: "not_configured" });
    console.error("Brevo invitation email delivery failed", {
      status: delivery.status,
      detail: delivery.detail,
    });
    return json({ error: "Email delivery failed." }, 502);
  }
  return json({ delivered: true });
});
