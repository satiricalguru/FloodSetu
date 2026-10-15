import { suppress, type AffectedAreaSummary } from "@floodsetu/shared";

/**
 * The ONLY data that leaves the rescue side: neighbourhood-level, anonymised, k-anonymous counts.
 * No ids, no coordinates finer than the neighbourhood, no phone/handles, no free text.
 */
export interface AreaInput {
  id: string;
  name: string;
  status: AffectedAreaSummary["status"];
  incidents: { verified: boolean; people: number; rescued: number; needs: string[] }[];
}

export function summariseAffectedAreas(areas: AreaInput[], at = new Date().toISOString()): AffectedAreaSummary[] {
  return areas.map((a) => {
    const v = a.incidents.filter((i) => i.verified);
    const people = v.reduce((s, i) => s + i.people, 0);
    const sheltered = v.reduce((s, i) => s + i.rescued, 0);
    const medical = v.filter((i) => i.needs.some((n) => n === "medical" || n === "injured")).length;
    return {
      areaId: a.id,
      areaName: a.name,
      status: a.status,
      verifiedIncidents: suppress(v.length),
      peopleAffected: suppress(people),
      peopleSheltered: suppress(sheltered),
      needs: { water: people * 3, food: people * 2, medical: medical * 2, shelterKits: Math.ceil(sheltered / 4) },
      updatedAt: at,
    };
  });
}
