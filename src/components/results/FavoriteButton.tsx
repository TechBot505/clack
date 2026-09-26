"use client";

import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { useSettings } from "@/stores/settings";

/** Save a quote to favorites (then pick "favorites" in quote mode). */
export function FavoriteButton({ id }: { id: string }) {
  const favs = useSettings((s) => s.favoriteQuotes);
  const set = useSettings((s) => s.set);
  const on = favs.includes(id);
  return (
    <button
      onClick={() => set({ favoriteQuotes: on ? favs.filter((f) => f !== id) : [...favs, id].slice(-200) })}
      aria-pressed={on}
      aria-label={on ? "Remove quote from favorites" : "Add quote to favorites"}
      className="press inline-flex items-center gap-1 normal-case tracking-normal text-sub hover:text-accent"
    >
      <motion.span animate={on ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.35 }}>
        <Heart size={12} className={on ? "fill-accent text-accent" : ""} />
      </motion.span>
      {on ? "favorited" : "favorite"}
    </button>
  );
}
