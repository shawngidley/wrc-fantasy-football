import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { isOwnerCutWindowOpen, OWNER_CUT_WINDOW_CLOSED_MESSAGE } from "@shared/ownerCut";
import { toast } from "sonner";
import { Scissors, Loader2 } from "lucide-react";

/**
 * Owner-only Cut button for the player card. The server is the real gate
 * (window, kickoff, pending bids); this only disables the button when the
 * window is plainly closed and shows the server's reason otherwise.
 */
export default function CutPlayerButton({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const windowOpen = isOwnerCutWindowOpen();
  const cut = trpc.league.cutPlayer.useMutation({
    onSuccess: async () => {
      toast.success(`${playerName} has been cut.`);
      setOpen(false);
      await Promise.all([
        utils.league.playerOwnership.invalidate(),
        utils.league.lineups.invalidate(),
        utils.league.lineupsForWeek.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">Cut {playerName}</p>
        <p className="text-xs text-slate-500">
          {windowOpen
            ? "Releases him to waivers with no pickup. Allowed until his game starts or 1:00 PM ET Sunday."
            : OWNER_CUT_WINDOW_CLOSED_MESSAGE}
        </p>
      </div>
      <Button
        size="sm"
        variant="destructive"
        disabled={!windowOpen}
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Scissors className="w-4 h-4 mr-1" /> Cut
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!cut.isPending) setOpen(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cut {playerName}?</DialogTitle>
            <DialogDescription>
              He leaves your roster and your lineup slot is cleared. He goes on waivers with the 48-hour hold,
              and you won't receive a replacement. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={cut.isPending}>Keep him</Button>
            <Button variant="destructive" onClick={() => cut.mutate({ playerId })} disabled={cut.isPending}>
              {cut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, cut"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
