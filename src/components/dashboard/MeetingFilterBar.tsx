"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/design";
import type { Location, SentimentCategory } from "@/types";

interface MeetingFilterBarProps {
  locations: Location[];
  selectedLocationIds: string[];
  onToggleLocation: (id: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  selectedCategories: SentimentCategory[];
  onToggleCategory: (category: SentimentCategory) => void;
  dateStart: string;
  dateEnd: string;
  onDateStartChange: (value: string) => void;
  onDateEndChange: (value: string) => void;
  onGenerate: () => void;
}

function chip(active: boolean) {
  return cn(
    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
    active
      ? "bg-forest text-paper border-forest"
      : "bg-paper text-ink-soft border-line hover:border-ink-faint"
  );
}

export default function MeetingFilterBar({
  locations,
  selectedLocationIds,
  onToggleLocation,
  city,
  onCityChange,
  selectedCategories,
  onToggleCategory,
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
  onGenerate,
}: MeetingFilterBarProps) {
  return (
    <div className="bg-paper rounded-2xl border border-line p-5 space-y-4">
      <div>
        <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2">
          Location
        </p>
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onToggleLocation(loc.id)}
              className={chip(selectedLocationIds.includes(loc.id))}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] block mb-1.5">
            City
          </label>
          <input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="All cities"
            className="w-full text-sm border border-line rounded-lg px-3 py-1.5 focus:outline-none focus:border-forest bg-cream"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] block mb-1.5">
            From
          </label>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-1.5 focus:outline-none focus:border-forest bg-cream"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] block mb-1.5">
            To
          </label>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="w-full text-sm border border-line rounded-lg px-3 py-1.5 focus:outline-none focus:border-forest bg-cream"
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2">
          Categories
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={chip(selectedCategories.includes(cat))}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={onGenerate} className="bg-forest hover:bg-forest-soft text-paper gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Generate meeting
        </Button>
      </div>
    </div>
  );
}
