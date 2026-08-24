import { Hub } from "src/app/shared/types/hub.types";

export function getObsSceneName(hub: Hub) {
  const userId = hub.user?.id;

  if (!userId) {
    throw new Error("Cannot export this hub to OBS because it has no owner user id.");
  }

  return `LiveHub userId=${userId} hubId=${hub._id}`;
}
