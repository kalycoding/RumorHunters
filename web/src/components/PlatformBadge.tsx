import type { IconType } from "react-icons";
import { FiFileText } from "react-icons/fi";
import {
  SiFacebook,
  SiInstagram,
  SiReddit,
  SiTelegram,
  SiX,
} from "react-icons/si";
import { PLATFORM } from "@/lib/format";
import type { Platform } from "@/lib/mock";

const LOGO: Record<Platform, { icon: IconType; color: string }> = {
  x: { icon: SiX, color: "#000000" },
  facebook: { icon: SiFacebook, color: "#1877F2" },
  instagram: { icon: SiInstagram, color: "#E4405F" },
  telegram: { icon: SiTelegram, color: "#26A5E4" },
  reddit: { icon: SiReddit, color: "#FF4500" },
  news: { icon: FiFileText, color: "#6B7280" },
};

/** A platform's logo and name, e.g. the X logo next to "X". */
export function PlatformBadge({ platform }: { platform: Platform }) {
  const { icon: Icon, color } = LOGO[platform];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 font-medium text-ink/70 ring-1 ring-black/[0.06]">
      <Icon size={12} color={color} />
      {PLATFORM[platform]}
    </span>
  );
}
