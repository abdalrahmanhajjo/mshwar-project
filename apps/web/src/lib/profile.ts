import { apiRequest } from "@/lib/api/client";

export type PreferenceTerm = {
  kind: string;
  slug: string;
  label: string;
};

export type HomeArea = {
  id: string;
  slug: string;
  name: string;
  country_code: string;
};

export type PreferenceValues = {
  source: "explicit";
  home_area_id: string | null;
  default_group_size: number | null;
  activity_intensity: string | null;
  dietary: string[];
  accessibility: string[];
  interests: string[];
  start_location: {
    lat: number;
    lng: number;
    label: string;
    source: "search" | "pin" | "device" | "manual";
  } | null;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  locale: string;
  preferences: PreferenceValues;
  home_area: HomeArea | null;
};

export type AreaCatalog = {
  source: string;
  picker: string;
  replace_with: string;
  areas: HomeArea[];
};

export type VocabularyCatalog = {
  dietary: PreferenceTerm[];
  accessibility: PreferenceTerm[];
  interest: PreferenceTerm[];
  activity_intensity: PreferenceTerm[];
};

export const EMPTY_PREFERENCES: PreferenceValues = {
  source: "explicit",
  home_area_id: null,
  default_group_size: null,
  activity_intensity: null,
  dietary: [],
  accessibility: [],
  interests: [],
  start_location: null,
};

export function hydratePreferences(profile: Profile): PreferenceValues {
  return {
    ...EMPTY_PREFERENCES,
    ...profile.preferences,
    home_area_id: profile.preferences.home_area_id ?? profile.home_area?.id ?? null,
    source: "explicit",
  };
}

export function fetchProfile(): Promise<Profile> {
  return apiRequest<Profile>("/api/v1/profile", { fallbackMessage: "authError" });
}

export function saveProfile(input: {
  display_name: string;
  locale: string;
  preferences: PreferenceValues;
}): Promise<Profile> {
  return apiRequest<Profile>("/api/v1/profile", {
    method: "PUT",
    body: JSON.stringify({ ...input, preferences: { ...input.preferences, source: "explicit" } }),
    fallbackMessage: "authError",
  });
}

export function fetchAreas(): Promise<AreaCatalog> {
  return apiRequest<AreaCatalog>("/api/v1/locations/areas", { fallbackMessage: "authError" });
}

export async function persistSignedInLocale(locale: string): Promise<void> {
  try {
    const profile = await fetchProfile();
    await saveProfile({
      display_name: profile.display_name,
      locale,
      preferences: hydratePreferences(profile),
    });
  } catch {
    /* Guest or unauthenticated header switches still persist via cookie. */
  }
}

export function fetchVocabularies(): Promise<VocabularyCatalog> {
  return apiRequest<VocabularyCatalog>("/api/v1/profile/vocabularies", { fallbackMessage: "authError" });
}
