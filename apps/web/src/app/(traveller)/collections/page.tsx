import type { Metadata } from "next";
import { CollectionsView } from "@/components/browse/collections-view";
import { loadCollections } from "@/lib/catalogue-api";

export const metadata: Metadata = {
  title: "Collections — Ready-made days.",
  description: "Curated collections assembled from published inventory.",
};

export default async function CollectionsPage() {
  return <CollectionsView collections={await loadCollections()} />;
}
