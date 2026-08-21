import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { createLotteryRows, DRAFT_LOTTERY_OWNERS, type DraftLotteryOwner } from "@shared/draftLottery";
import { Trophy, Play, Lock } from "lucide-react";
import { toast } from "sonner";

export default function DraftLottery() {
  const { franchise, isCommissioner } = useAuth();
  const lottery = trpc.league.draftLottery.useQuery(undefined, { refetchInterval: 5000 });
  const draw = trpc.league.commissionerRunDraftLottery.useMutation({ onSuccess: () => lottery.refetch() });
  const result = lottery.data?.resultOwners as DraftLotteryOwner[] | null | undefined;
  const rows = result ? createLotteryRows(result) : DRAFT_LOTTERY_OWNERS.map(owner => ({ owner, lotteryPick: null, round1Pick: null, round2Pick: null }));
  const run = async () => {
    if (!confirm("Run the equal-odds lottery? This permanently sets Round 1 picks 1–6 and linked Round 2 picks 7–12.")) return;
    try { await draw.mutateAsync(); toast.success("Draft lottery finalized."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to run lottery."); }
  };
  return <div className="bg-stadium-night bg-overlay" style={{ minHeight: "100vh" }}><Navigation showTicker={false} teamName={franchise?.team_name} />
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
      <div className="wrc-page-title" style={{ padding: "0 0 1rem" }}><h1>2026 Draft Lottery</h1><p>Six equal chances · linked first- and second-round snake picks</p></div>
      <section className="wrc-card" style={{ overflow: "hidden" }}><div className="wrc-card-gold-stripe" /><div style={{ padding: "1.25rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:"1rem", alignItems:"center", flexWrap:"wrap" }}><div><h2 style={{ margin:0, fontFamily:"Barlow Condensed, sans-serif", color:"oklch(0.22 0.08 150)" }}>{result ? "Lottery Results" : "Lottery Pending"}</h2><p style={{ margin:".3rem 0 0", color:"oklch(0.5 0.04 150)", fontSize:".86rem" }}>{result ? `Finalized ${lottery.data?.drawnAt ? new Date(lottery.data.drawnAt).toLocaleString() : ""}` : "Each eligible owner has one equal chance."}</p></div>{isCommissioner && !result && <button onClick={run} disabled={draw.isPending} style={{ border:0,borderRadius:8,padding:".65rem 1rem",background:"oklch(0.72 0.15 85)",color:"oklch(0.15 0.02 150)",fontWeight:800,cursor:"pointer" }}><Play size={15} style={{ verticalAlign:"middle" }}/> {draw.isPending ? "DRAWING…" : "RUN DRAFT LOTTERY"}</button>}{result && <span style={{ color:"oklch(0.35 0.15 150)",fontWeight:700 }}><Lock size={14} style={{verticalAlign:"middle"}}/> Locked</span>}</div>
        <div style={{ overflowX:"auto", marginTop:"1.25rem" }}><table className="wrc-table" style={{ minWidth:560,width:"100%" }}><thead><tr><th>LOTTERY</th><th>OWNER</th><th>ROUND 1</th><th>ROUND 2</th></tr></thead><tbody>{rows.map((row,index)=><tr key={row.owner}><td style={{fontWeight:800,textAlign:"center"}}>{row.lotteryPick ?? "—"}</td><td style={{fontWeight:800}}>{row.owner}</td><td>{row.round1Pick ? `1.${String(row.round1Pick).padStart(2,"0")}` : "Pending"}</td><td>{row.round2Pick ? `2.${String(row.round2Pick).padStart(2,"0")}` : "Pending"}</td></tr>)}</tbody></table></div>
        <p style={{ margin:"1rem 0 0",fontSize:".78rem",color:"oklch(0.5 0.04 150)" }}><Trophy size={14} style={{verticalAlign:"middle"}}/> Only Round 1 picks 1–6 and Round 2 picks 7–12 change. Round 1 picks 7–12, Round 2 picks 1–6, and Rounds 3–18 remain set.</p>
      </div></section>
    </main></div>;
}
