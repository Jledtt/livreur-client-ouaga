"use client";

import { usePathname, useRouter } from "next/navigation";

type Zone = { id: number; nom: string };

export default function SelecteurZoneDepart({
  zones,
  zoneSelectionneeId,
}: {
  zones: Zone[];
  zoneSelectionneeId: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex flex-col gap-1 text-sm">
      Zone de depart
      <select
        value={zoneSelectionneeId}
        onChange={(evenement) => router.push(`${pathname}?depart=${evenement.target.value}`)}
        className="w-64 rounded border border-gray-300 px-3 py-2"
      >
        {zones.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.nom}
          </option>
        ))}
      </select>
    </label>
  );
}
