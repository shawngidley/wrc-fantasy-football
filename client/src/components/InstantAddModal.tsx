/**
 * WRC Fantasy Football — Open Waiver Instant Add Modal
 * Free, first-come-first-served add during the Sunday 9am-1pm ET open
 * waiver window. No bid amount, no blind auction -- just confirm and go.
 *
 * Server enforces the actual race (atomic claim), this is a confirmation
 * step to avoid an accidental one-tap add while scrolling a long list.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UserPlus, X, Loader2 } from "lucide-react";

interface InstantAddModalProps {
  player: {
    id: string;
    name: string;
    pos: string;
    nflTeam: string;
  };
  onClose: () => void;
  onAdded?: () => void;
}

type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
};

export default function InstantAddModal({ player, onClose, onAdded }: InstantAddModalProps) {
  const { franchise } = useAuth();
  const [dropPlayerId, setDropPlayerId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const rosterQuery = trpc.league.faabBidRoster.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const instantAddMutation = trpc.league.instantAddFreeAgent.useMutation();

  useEffect(() => {
    setLoadingRoster(rosterQuery.isLoading || rosterQuery.isFetching);
    if (rosterQuery.data) setMyRoster(rosterQuery.data.roster as RosterPlayer[]);
  }, [rosterQuery.data, rosterQuery.isFetching, rosterQuery.isLoading]);

  if (!franchise) return null;

  const rosterFull = myRoster.length >= 18;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const dropPlayer = dropPlayerId !== "__none__"
        ? myRoster.find((p) => p.id === dropPlayerId)
        : null;

      await instantAddMutation.mutateAsync({
        playerName: player.name,
        playerPos: player.pos,
        playerNflTeam: player.nflTeam,
        dropPlayerId: dropPlayer?.id ?? null,
      });

      toast.success(`${player.name} added to your roster — free, no FAAB spent!`);
      onAdded?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add player. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Open Waiver Add — {player.name}
          </DialogTitle>
          <DialogDescription>
            <strong>Open waiver window</strong> — first-come-first-served, no FAAB cost. Confirm to add this player right now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Player info */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700">
              {player.pos}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{player.name}</p>
              <p className="text-xs text-slate-500">{player.pos} · {player.nflTeam}</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-slate-500">Cost</p>
              <p className="text-lg font-bold text-emerald-700">FREE</p>
            </div>
          </div>

          {/* Drop player */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Drop Player {rosterFull ? <span className="text-red-500">(required — roster full)</span> : "(optional)"}
            </Label>
            {loadingRoster ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your roster…
              </div>
            ) : (
              <Select value={dropPlayerId} onValueChange={setDropPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a player to drop (if roster is full)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No drop needed —</SelectItem>
                  {myRoster.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.position} · {p.nfl_team})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-slate-500">
              Your roster has {myRoster.length}/18 players.{" "}
              {rosterFull ? "You must drop a player to add one." : "You have room to add without dropping."}
            </p>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Open waiver window closes at 1pm ET — first come, first served
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleConfirm}
              disabled={submitting || (rosterFull && dropPlayerId === "__none__")}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Adding…</>
              ) : (
                "Add Now"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
