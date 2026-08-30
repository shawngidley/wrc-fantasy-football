/**
 * WRC Fantasy Football - Draft Presentation
 * Spectator/projector view of the live draft: same board grid, pick list,
 * chime, reveal overlay, and theme songs as the normal Draft Board, but
 * with the private per-owner queue/search section hidden entirely. Meant
 * for the commissioner to project this screen for the room while he
 * drafts privately from his own separate Draft Board tab, so nobody sees
 * his queue or search activity.
 */
import DraftBoard from "./DraftBoard";

export default function DraftPresentation() {
  return <DraftBoard presentationMode />;
}
