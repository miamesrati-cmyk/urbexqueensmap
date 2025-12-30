export type MissionQuest = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  xp: number;
  increment: number;
};

const INITIAL_MISSIONS: MissionQuest[] = [
  {
    id: "add-spot",
    title: "Ajoute 1 spot",
    description: "Poste un nouveau spot urbex sur la carte.",
    progress: 0,
    target: 1,
    xp: 60,
    increment: 1,
  },
  {
    id: "validate-spots",
    title: "Valide 3 spots",
    description: "Soumets 3 spots pour validation communautaire.",
    progress: 1,
    target: 3,
    xp: 90,
    increment: 1,
  },
  {
    id: "post-urbex",
    title: "Poste 1 urbex",
    description: "Partage une photo ou une story depuis le feed.",
    progress: 0,
    target: 1,
    xp: 70,
    increment: 1,
  },
  {
    id: "gain-xp",
    title: "Gagne 50 XP",
    description: "Cumulé sur la semaine (map, feed, missions).",
    progress: 28,
    target: 50,
    xp: 120,
    increment: 2,
  },
];

export function createMissionSeed(): MissionQuest[] {
  return INITIAL_MISSIONS.map((mission) => ({ ...mission }));
}

export function advanceMissionProgress(missions: MissionQuest[]): MissionQuest[] {
  let updated = false;
  const next = missions.map((mission) => {
    if (mission.progress >= mission.target) {
      return mission;
    }
    const nextProgress = Math.min(mission.target, mission.progress + mission.increment);
    if (nextProgress !== mission.progress) {
      updated = true;
    }
    return { ...mission, progress: nextProgress };
  });
  return updated ? next : missions;
}

export function areMissionsComplete(missions: MissionQuest[]): boolean {
  return missions.every((mission) => mission.progress >= mission.target);
}
