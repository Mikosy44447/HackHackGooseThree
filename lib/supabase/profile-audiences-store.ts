import { supabase } from "./client";

export type ProfileAudienceRow = {
  id: number;
  profile_email: string;
  audience_label: string;
  normalized_audience_key?: string | null;
  source: string;
  confidence: number;
};

export type ProfileAudience = {
  id: number;
  profileEmail: string;
  audienceLabel: string;
  normalizedAudienceKey?: string | null;
  source: string;
  confidence: number;
};

function mapProfileAudience(row: ProfileAudienceRow): ProfileAudience {
  return {
    id: row.id,
    profileEmail: row.profile_email,
    audienceLabel: row.audience_label,
    normalizedAudienceKey: row.normalized_audience_key ?? null,
    source: row.source,
    confidence: Number(row.confidence),
  };
}

export async function getProfileAudiencesByEmail(
  email: string
): Promise<ProfileAudience[]> {
  const { data, error } = await supabase
    .from("profile_audiences")
    .select("*")
    .eq("profile_email", email)
    .order("confidence", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProfileAudience);
}

export async function replaceProfileAudiences(
  email: string,
  audiences: Array<{
    audienceLabel: string;
    normalizedAudienceKey?: string | null;
    source?: string;
    confidence?: number;
  }>
) {
  const { error: deleteError } = await supabase
    .from("profile_audiences")
    .delete()
    .eq("profile_email", email);

  if (deleteError) {
    throw deleteError;
  }

  if (!audiences.length) {
    return [];
  }

  const payload = audiences.map((audience) => ({
    profile_email: email,
    audience_label: audience.audienceLabel,
    normalized_audience_key: audience.normalizedAudienceKey ?? null,
    source: audience.source ?? "derived",
    confidence: audience.confidence ?? 1,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("profile_audiences")
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapProfileAudience);
}