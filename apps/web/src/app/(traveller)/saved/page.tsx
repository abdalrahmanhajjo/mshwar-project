import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_HEADER, parseLocale, withLocalePrefix } from "@/lib/locale";

export default async function SavedPage() {
  const locale = parseLocale((await headers()).get(LOCALE_HEADER));
  redirect(withLocalePrefix(locale, "/favorites"));
}
