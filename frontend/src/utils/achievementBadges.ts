import type { AchievementResult } from "../types";
import GalaxyBrainBadge from "../assets/GalaxyBrain.png";
import GitHubSponsorBadge from "../assets/GitHubSponsorBadge.png";
import PairExtraordinaireBadge from "../assets/PairExtraordinaire.png";
import PullSharkBadge from "../assets/PullShark.png";
import QuickdrawBadge from "../assets/QuickDraw_SkinTone1.png";
import StarstruckBadge from "../assets/StarStruck_SkinTone1.png";
import YoloBadge from "../assets/YOLO_Badge.png";

const localAchievementBadgeMap: Record<AchievementResult["id"], string> = {
  starstruck: StarstruckBadge,
  quickdraw: QuickdrawBadge,
  "pair-extraordinaire": PairExtraordinaireBadge,
  "pull-shark": PullSharkBadge,
  "galaxy-brain": GalaxyBrainBadge,
  yolo: YoloBadge,
  "public-sponsor": GitHubSponsorBadge,
};

export function resolveBadgeImage(achievement: AchievementResult): string {
  return localAchievementBadgeMap[achievement.id] ?? achievement.badgeImageUrl;
}
