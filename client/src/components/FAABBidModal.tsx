/**
 * WRC Fantasy Football — FAAB Bid Modal
 * Blind auction bid submission. Bids are stored in Supabase faab_bids table.
 * Commissioner sees all bids and awards the player.
 *
 * Uses live Supabase data for:
 *  - Roster (drop selector) — from `players` table filtered by team_id
 *  - FAAB balance — from `teams.faab` via auth context
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { getCurrentWeek } from "@/lib/scheduleData2026";
import { toast } from "sonner";
import { DollarSign, X, Loader2 } from "lucide-react";

interface FAABBidModalProps {
  player: {
    id: string;
    name: string;
    pos: string;
    nflTeam: string;
  };
  onClose: () => void;
}

type RosterPlayer = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
};

export default function FAABBidModal({ player, onClose }: FAABBidModalProps) {
  const { franchise } = useAuth();
  const [bidAmount, setBidAmount] = useState("");
  const [dropPlayerId, setDropPlayerId] = useState<string>("__none__");
  const [submitting, setSubmitting] = useState(false);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const bidDetailsQuery = trpc.league.faabBidRoster.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const submitBidMutation = trpc.league.submitFaabBid.useMutation();

  const currentWeek = getCurrentWeek();
  const week = currentWeek > 0 ? currentWeek : 1;

  // FAAB balance and roster are session-scoped server data.
  const faabRemaining = bidDetailsQuery.data?.faab ?? franchise?.faab ?? 1000;

  useEffect(() => {
    setLoadingRoster(bidDetailsQuery.isLoading || bidDetailsQuery.isFetching);
    if (bidDetailsQuery.data) setMyRoster(bidDetailsQuery.data.roster as RosterPlayer[]);
  }, [bidDetailsQuery.data, bidDetailsQuery.isFetching, bidDetailsQuery.isLoading]);

  if (!franchise) return null;

  const handleSubmit = async () => {
    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid bid amount (0 or more).");
      return;
    }
    if (amount > faabRemaining) {
      toast.error(`Bid exceeds your FAAB balance ($${faabRemaining} remaining).`);
      return;
    }

    setSubmitting(true);
    try {
      const dropPlayer = dropPlayerId !== "__none__"
        ? myRoster.find((p) => p.id === dropPlayerId)
        : null;

      await submitBidMutation.mutateAsync({
        playerId: player.id,
        playerName: player.name,
        playerPos: player.pos,
        playerNflTeam: player.nflTeam,
        bidAmount: amount,
        dropPlayerId: dropPlayer?.id ?? null,
        week,
        season: 2026,
      });

      toast.success(`Bid of $${amount} submitted for ${player.name}! The commissioner will process bids after the waiver deadline.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit bid. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const rosterFull = myRoster.length >= 18;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            FAAB Bid — {player.name}
          </DialogTitle>
          <DialogDescription>
            This is a <strong>blind auction</strong>. Your bid is sealed until the commissioner processes waivers. Highest bid wins.
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
              <p className="text-xs text-slate-500">FAAB Balance</p>
              <p className="text-lg font-bold text-emerald-700">${faabRemaining}</p>
            </div>
          </div>

          {/* Bid amount */}
          <div className="space-y-2">
            <Label htmlFor="bid-amount" className="text-sm font-semibold">
              Bid Amount ($)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">$</span>
              <Input
                id="bid-amount"
                type="number"
                min={0}
                max={faabRemaining}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="0"
                className="pl-7 text-lg font-bold"
              />
            </div>
            <p className="text-xs text-slate-500">
              Enter $0 to claim a player for free if no one else bids. Max: ${faabRemaining}.
            </p>
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

          {/* Week info */}
          <p className="text-xs text-slate-400 text-center">
            Bid for Week {week} waivers · Bids are blind until the commissioner processes them
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              onClick={handleSubmit}
              disabled={submitting || !bidAmount || (rosterFull && dropPlayerId === "__none__")}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting…</>
              ) : (
                `Submit $${bidAmount || 0} Bid`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
