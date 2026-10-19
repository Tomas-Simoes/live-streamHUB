export type HubBackground = {
  id: string;
  label: string;
  src: string | null;
};

export const DEFAULT_HUB_BACKGROUND_ID = "league-of-legends-clean";

export const HUB_BACKGROUNDS: HubBackground[] = [
  {
    id: "league-of-legends-clean",
    label: "League of Legends Clean",
    src: "/league-of-legends-bg-no-scoreboard.png",
  },
  {
    id: "league-of-legends",
    label: "League of Legends Original",
    src: "/league-of-legends-bg.png",
  },
  {
    id: "hero-studio",
    label: "Hero Studio",
    src: "/hero-studio-backdrop.png",
  },
  {
    id: "classic-gradient",
    label: "Classic Gradient",
    src: null,
  },
  {
    id: "transparent",
    label: "Transparent",
    src: null,
  },
];

export function getHubBackground(backgroundId: unknown): HubBackground {
  return (
    HUB_BACKGROUNDS.find((background) => background.id === backgroundId) ??
    HUB_BACKGROUNDS[0]
  );
}
