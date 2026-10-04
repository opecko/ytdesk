import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Track } from "../api/types";
import { ratingOf, usePlayer } from "../stores/player";

/** Thumbs up / down for any track; filled icon = current rating. */
export default function RatingButtons({ track, size = 20, className = "" }: { track: Track; size?: number; className?: string }) {
  const rating = usePlayer((s) => ratingOf(s, track));
  const rateTrack = usePlayer((s) => s.rateTrack);
  const btn = size >= 20 ? "h-10 w-10" : "h-8 w-8";
  return (
    <span className={`flex shrink-0 ${className}`}>
      <button className={`icon-btn ${btn}`} aria-label={rating === "LIKE" ? "Remove like" : "Like"} aria-pressed={rating === "LIKE"}
        onClick={(e) => { e.stopPropagation(); rateTrack(track, rating === "LIKE" ? "INDIFFERENT" : "LIKE"); }}>
        <ThumbsUp size={size} fill={rating === "LIKE" ? "currentColor" : "none"} />
      </button>
      <button className={`icon-btn ${btn}`} aria-label={rating === "DISLIKE" ? "Remove dislike" : "Dislike"} aria-pressed={rating === "DISLIKE"}
        onClick={(e) => { e.stopPropagation(); rateTrack(track, rating === "DISLIKE" ? "INDIFFERENT" : "DISLIKE"); }}>
        <ThumbsDown size={size} fill={rating === "DISLIKE" ? "currentColor" : "none"} />
      </button>
    </span>
  );
}
