import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionDetailView } from "@/components/browse/collection-detail-view";
import { loadCollection, loadExperience } from "@/lib/catalogue-api";
import { IDEAS } from "@/lib/catalog";

export function generateStaticParams() {
  return IDEAS.map((idea) => ({ slug: idea.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = await loadCollection(slug);
  return { title: collection ? `${collection.title} — Mshwar` : "Collection" };
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await loadCollection(slug);
  if (!collection) {
    notFound();
  }
  const stops = (await Promise.all(collection.experienceSlugs.map((item) => loadExperience(item)))).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  return <CollectionDetailView collection={collection} stops={stops} />;
}
