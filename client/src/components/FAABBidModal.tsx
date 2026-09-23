/**
 * WRC Fantasy Football — FAAB Bid Modal
 * Blind auction bid submission. Bids are stored in Supabase faab_bids table.
 * Commissioner sees all bids and awards the player.
 *
 * Uses live Supabase data for:
 *  - Roster (drop selector) — from `players` table filtered by team_id
 *  - FAAB balance — from `teams.faab` via auth context
 */
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { getLineupDefaultWeek } from "@/lib/scheduleData2026";
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
  // Conditional (ranked-group) bidding: off = a normal standalone bid; new =
  // start a group with this player as the first pick; existing = add this bid
  // to one of the owner's pending groups (win only one of the group).
  const [conditionalMode, setConditionalMode] = useState<"off" | "new" | "existing">("off");
  const [existingGroupId, setExistingGroupId] = useState<string>("");
  const [showConditionalHelp, setShowConditionalHelp] = useState(false);
  const bidDetailsQuery = trpc.league.faabBidRoster.useQuery(undefined, { enabled: Boolean(franchise?.id) });
  const submitBidMutation = trpc.league.submitFaabBid.useMutation();
  const utils = trpc.useUtils();

  const currentWeek = getLineupDefaultWeek();
  const week = currentWeek > 0 ? currentWeek : 1;

  // The owner's existing pending groups for this week, so a new bid can join
  // one. Each is labeled by its first couple of players.
  const myBidsQuery = trpc.league.myFaabBids.useQuery({ week, season: 2026 }, { enabled: Boolean(franchise?.id) });
  const pendingGroups = useMemo(() => {
    const map = new Map<string, { id: string; players: string[]; maxWins: number }>();
    for (const b of (myBidsQuery.data ?? []) as Array<Record<string, unknown>>) {
      if (b.status !== "pending" || !b.group_id) continue;
      const groupId = String(b.group_id);
      const group = map.get(groupId) ?? { id: groupId, players: [], maxWins: Number(b.group_max_wins ?? 1) };
      group.players.push(String(b.player_name ?? ""));
      map.set(groupId, group);
    }
    return Array.from(map.values());
  }, [myBidsQuery.data]);

  const groupLabel = (players: string[]) =>
    players.slice(0, 2).join(", ") + (players.length > 2 ? ` +${players.length - 2} more` : "");

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

    if (conditionalMode === "existing" && !existingGroupId) {
      toast.error("Pick which group this bid should join.");
      return;
    }

    setSubmitting(true);
    try {
      const dropPlayer = dropPlayerId !== "__none__"
        ? myRoster.find((p) => p.id === dropPlayerId)
        : null;

      const groupId = conditionalMode === "new" ? "new" : conditionalMode === "existing" ? existingGroupId : undefined;

      await submitBidMutation.mutateAsync({
        playerId: player.id,
        playerName: player.name,
        playerPos: player.pos,
        playerNflTeam: player.nflTeam,
        bidAmount: amount,
        dropPlayerId: dropPlayer?.id ?? null,
        week,
        season: 2026,
        groupId,
      });

      const conditionalNote = conditionalMode === "off"
        ? ""
        : " It's part of a conditional group, so you'll win only one: your top-ranked pick you can get.";
      toast.success(`Bid of $${amount} submitted for ${player.name}!${conditionalNote} Bids are resolved automatically at 9am ET Thursday and Sunday.`);
      await utils.league.myFaabBids.invalidate();
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

          {/* Conditional (ranked-group) bidding */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={conditionalMode !== "off"}
                onChange={(e) => setConditionalMode(e.target.checked ? "new" : "off")}
                className="w-4 h-4 accent-amber-600"
              />
              Make this a conditional bid
            </label>
            <p className="text-xs text-slate-500">
              Link this to other bids so you win only one: your top-ranked pick you can actually get. You only pay for the one you win, so you can chase the same roster spot with a ranked backup plan.
            </p>
            <button
              type="button"
              onClick={() => setShowConditionalHelp(v => !v)}
              className="text-xs font-semibold text-amber-700 underline underline-offset-2"
            >
              {showConditionalHelp ? "Hide instructions" : "How conditional bids work"}
            </button>
            {showConditionalHelp && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <ol className="list-decimal ml-4 text-xs text-slate-600 space-y-1.5">
                  <li>On this player, check the box above and hit Submit. That creates a group with this player as your first pick. Nothing else changes on screen, that's expected.</li>
                  <li>Open another free agent, enter a bid, check the box again, and choose "Add to an existing group." Pick the same drop player if you're clearing one roster spot for either player.</li>
                  <li>In My Bids the two show as one group. Use the up and down arrows to rank them, and set how many you want to win (default is 1).</li>
                  <li>At waivers you win only your highest-ranked pick you can actually get, and you only pay for that one. The rest are marked Passed.</li>
                </ol>
              </div>
            )}
            {conditionalMode !== "off" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="cond-group"
                    checked={conditionalMode === "new"}
                    onChange={() => setConditionalMode("new")}
                    className="accent-amber-600"
                  />
                  Start a new group with {player.name}
                </label>
                {pendingGroups.length > 0 && (
                  <>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="cond-group"
                        checked={conditionalMode === "existing"}
                        onChange={() => setConditionalMode("existing")}
                        className="accent-amber-600"
                      />
                      Add to an existing group
                    </label>
                    {conditionalMode === "existing" && (
                      <Select value={existingGroupId} onValueChange={setExistingGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a group" />
                        </SelectTrigger>
                        <SelectContent>
                          {pendingGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{groupLabel(g.players)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </>
                )}
                <p className="text-xs text-slate-500">
                  Rank your picks and choose how many to win over in My Bids.
                </p>
              </div>
            )}
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
