import { supabase } from "./client";

export type GooseProfileRecord = {
  email: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
  income?: string;
  education?: string;
  race?: string[];
  location?: string;
  employment?: string;
  family?: string;
  digest_enabled?: boolean;
  digest_frequency?: string;
  created_at?: string;
  updated_at?: string;
};

export async function upsertGooseProfile(profile: GooseProfileRecord) {
  const payload = {
    ...profile,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("goose_profiles")
    .upsert(payload, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getGooseProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("goose_profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateGooseDigestSettings(
  email: string,
  digestEnabled: boolean,
  digestFrequency: string
) {
  const { data, error } = await supabase
    .from("goose_profiles")
    .upsert(
      {
        email,
        digest_enabled: digestEnabled,
        digest_frequency: digestFrequency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}