import { useState } from "react";
import { getNflTeamLogoUrl } from "@/lib/nflTeamLogo";

/** NFL team logo shown beside a defense (DST). Renders nothing for other positions or if the image fails. */
export function DstLogo({ pos, nflTeam, size = 18 }: { pos: string; nflTeam?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (pos !== "DST" || !nflTeam || failed) return null;
  return (
    <img
      src={getNflTeamLogoUrl(nflTeam)}
      alt={`${nflTeam} logo`}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, verticalAlign: "middle" }}
      onError={() => setFailed(true)}
    />
  );
}
