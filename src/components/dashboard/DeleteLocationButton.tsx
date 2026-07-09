"use client";

import { Trash2 } from "lucide-react";
import { deleteLocation } from "@/app/(dashboard)/dashboard/settings/actions";

export default function DeleteLocationButton({
  locationId,
  locationName,
}: {
  locationId: string;
  locationName: string;
}) {
  return (
    <form
      action={deleteLocation}
      onSubmit={(e) => {
        if (!confirm(`Stop tracking "${locationName}"? This permanently deletes its reviews and analysis.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="location_id" value={locationId} />
      <button
        type="submit"
        title="Stop tracking this location"
        className="text-ink-faint hover:text-neg transition-colors p-1 -m-1 rounded"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
