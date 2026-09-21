"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/shell/auth-provider";
import { useBrowseCopy } from "@/lib/browse-copy";
import { toggleFavorite } from "@/lib/hub";
import { useSavedExperiences } from "@/lib/saved-experiences";
import { cn } from "@/lib/utils";

export function SaveExperienceButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const copy = useBrowseCopy();
  const { user } = useAuth();
  const { has, toggle } = useSavedExperiences();
  const saved = has(slug);

  return (
    <Button
      type="button"
      variant={compact ? "secondary" : "outline"}
      size={compact ? "icon" : "sm"}
      aria-pressed={saved}
      aria-label={saved ? copy.savedExperience : copy.saveExperience}
      className={cn(
        compact && "size-10 min-h-10 rounded-full bg-surface/95 text-text shadow-sm backdrop-blur hover:bg-surface",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
        if (user) {
          void toggleFavorite(slug).catch(() => toggle(slug));
        }
      }}
    >
      <Heart className={cn("size-4 transition-transform", saved && "scale-110 fill-accent text-accent")} aria-hidden />
      {compact ? null : saved ? copy.savedExperience : copy.saveExperience}
    </Button>
  );
}
