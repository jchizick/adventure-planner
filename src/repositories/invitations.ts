import { supabase } from "../lib/supabase";
import type { SharedSpace } from "../workspace";

export type SpaceMember = {
  userId: string;
  displayName: string | null;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type SpaceInvitation = {
  id: string;
  email: string;
  role: "member";
  invitedBy: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type InvitationPreview = {
  id: string;
  spaceId: string;
  spaceName: string;
  inviterName: string;
  invitedEmail: string;
  expiresAt: string;
  status: SpaceInvitation["status"];
};

type InvitationRpcRow = {
  invitation_id: string;
  raw_token: string;
  normalized_email: string;
  expires_at: string;
};

type PreviewRpcRow = {
  invitation_id: string;
  space_id: string;
  space_name: string;
  inviter_name: string;
  invited_email: string;
  expires_at: string;
  status: SpaceInvitation["status"];
};

type MemberRpcRow = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: "owner" | "member";
  joined_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: "member";
  invited_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
};

function safeError(
  action: string,
  error: { message: string; code?: string; status?: number },
) {
  if (import.meta.env.DEV)
    console.error(`Supabase invitation ${action} failed`, {
      function: action,
      code: error.code,
      message: error.message,
      status: error.status,
    });
  return new Error(error.message || `We could not ${action}. Please try again.`);
}

export async function loadSpaceMembers(spaceId: string) {
  const { data, error } = await supabase.rpc("list_space_members", {
    p_space_id: spaceId,
  });
  if (error) throw safeError("load members", error);
  return ((data ?? []) as MemberRpcRow[]).map(
    (row): SpaceMember => ({
      userId: row.user_id,
      displayName: row.display_name,
      email: row.email,
      role: row.role as SpaceMember["role"],
      joinedAt: row.joined_at,
    }),
  );
}

export async function loadSpaceInvitations(spaceId: string) {
  const { data, error } = await supabase
    .from("space_invitations")
    .select(
      "id, email, role, invited_by, accepted_at, revoked_at, expires_at, created_at",
    )
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw safeError("load invitations", error);
  const now = Date.now();
  return ((data ?? []) as InvitationRow[]).map((row): SpaceInvitation => {
    const status = row.accepted_at
      ? "accepted"
      : row.revoked_at
        ? "revoked"
        : new Date(row.expires_at).getTime() <= now
          ? "expired"
          : "pending";
    return {
      id: row.id,
      email: row.email,
      role: "member",
      invitedBy: row.invited_by,
      acceptedAt: row.accepted_at,
      revokedAt: row.revoked_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      status,
    };
  });
}

export async function createSpaceInvitation(spaceId: string, email: string) {
  const { data, error } = await supabase.rpc("create_space_invitation", {
    p_space_id: spaceId,
    p_invitee_email: email,
  });
  if (error) throw safeError("create", error);
  const row = (data as InvitationRpcRow[] | null)?.[0];
  if (!row) throw new Error("The invitation could not be created.");

  const invitationUrl = new URL(
    `/invite/${encodeURIComponent(row.raw_token)}`,
    window.location.origin,
  ).toString();
  let delivered = false;
  let deliveryMessage = "Invitation created, but email delivery is not configured.";
  const { data: delivery, error: deliveryError } = await supabase.functions.invoke(
    "send-space-invitation",
    {
      body: {
        invitationId: row.invitation_id,
        rawToken: row.raw_token,
        appOrigin: window.location.origin,
      },
    },
  );
  if (!deliveryError && delivery?.delivered === true) {
    delivered = true;
    deliveryMessage = "Invitation email sent.";
  } else if (deliveryError && import.meta.env.DEV) {
    console.warn("Invitation email delivery unavailable", {
      invitationId: row.invitation_id,
      message: deliveryError.message,
    });
  }

  return {
    invitationId: row.invitation_id,
    email: row.normalized_email,
    expiresAt: row.expires_at,
    delivered,
    deliveryMessage,
    developmentUrl: import.meta.env.DEV ? invitationUrl : null,
  };
}

export async function loadInvitation(rawToken: string) {
  const { data, error } = await supabase.rpc("get_space_invitation", {
    p_raw_token: rawToken,
  });
  if (error) throw safeError("load", error);
  const row = (data as PreviewRpcRow[] | null)?.[0];
  if (!row)
    throw new Error(
      "This invitation is not available for the signed-in account.",
    );
  return {
    id: row.invitation_id,
    spaceId: row.space_id,
    spaceName: row.space_name,
    inviterName: row.inviter_name,
    invitedEmail: row.invited_email,
    expiresAt: row.expires_at,
    status: row.status,
  } satisfies InvitationPreview;
}

export async function acceptInvitation(rawToken: string) {
  const { data, error } = await supabase.rpc("accept_space_invitation", {
    p_raw_token: rawToken,
  });
  if (error) throw safeError("accept", error);
  const row = (data as Array<{
    id: string;
    name: string;
    created_by: string;
  }> | null)?.[0];
  if (!row) throw new Error("The invitation could not be accepted.");
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
  } satisfies SharedSpace;
}

export async function revokeInvitation(spaceId: string, invitationId: string) {
  const { error } = await supabase.rpc("revoke_space_invitation", {
    p_space_id: spaceId,
    p_invitation_id: invitationId,
  });
  if (error) throw safeError("revoke", error);
}

export async function removeMember(spaceId: string, userId: string) {
  const { error } = await supabase.rpc("remove_space_member", {
    p_space_id: spaceId,
    p_member_user_id: userId,
  });
  if (error) throw safeError("remove member", error);
}
