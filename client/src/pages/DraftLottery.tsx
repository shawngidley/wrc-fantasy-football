import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import DraftSubNav from "@/components/DraftSubNav";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { createLotteryRows, DRAFT_LOTTERY_OWNERS, type DraftLotteryOwner } from "@shared/draftLottery";
import { Trophy, Play, Lock, Timer } from "lucide-react";
import { toast } from "sonner";

const REVEAL_INTERVAL_SECONDS = 45;

export default function DraftLottery() {
  const { franchise, isCommissioner } = useAuth();
  const lottery = trpc.league.draftLottery.useQuery(undefined, { refetchInterval: 3000 });
  const draw = trpc.league.commissionerRunDraftLottery.useMutation({ onSuccess: () => lottery.refetch() });
  const startReveal = trpc.league.commissionerStartDraftLotteryReveal.useMutation({ onSuccess: () => lottery.refetch() });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, []);

  const result = lottery.data?.resultOwners as DraftLotteryOwner[] | null | undefined;
  const isRunning = lottery.data?.revealStatus === "running" && Boolean(lottery.data?.revealStartedAt);
  const elapsed = isRunning ? Math.max(0, Math.floor((now - new Date(lottery.data?.revealStartedAt ?? now).getTime()) / 1000)) : 0;
  const revealedCount = isRunning ? Math.min(6, Math.floor(elapsed / REVEAL_INTERVAL_SECONDS)) : 0;
  const countdown = isRunning && revealedCount < 6 ? REVEAL_INTERVAL_SECONDS - (elapsed % REVEAL_INTERVAL_SECONDS) : 0;
  const revealedOwners = result ? result.slice(6 - revealedCount).reverse() : [];
  const remainingOwners = result ? result.filter(owner => !revealedOwners.includes(owner)) : [...DRAFT_LOTTERY_OWNERS];
  const nextOwner = result && revealedCount < 6 ? result[5 - revealedCount] : null;
  const rows = result && !isRunning && lottery.data?.revealStatus !== "pending" ? createLotteryRows(result) : null;

  const run = async () => {
    if (!confirm("Run the equal-odds lottery? This permanently sets Round 1 picks 1–6 and linked Round 2 picks 7–12.")) return;
    try { await draw.mutateAsync(); toast.success("Lottery locked. Start the live reveal when ready."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to run lottery."); }
  };
  const begin = async () => {
    if (!confirm("Start the 45-second live reveal? All owners will see the same countdown, beginning with 6th pick.")) return;
    try { await startReveal.mutateAsync(); toast.success("Live lottery reveal started."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to start reveal."); }
  };
  const stageLabel = revealedCount >= 6 ? "Lottery complete" : isRunning ? `Next reveal: ${6 - revealedCount}${6 - revealedCount === 1 ? "st" : 6 - revealedCount === 2 ? "nd" : 6 - revealedCount === 3 ? "rd" : "th"} pick` : result ? "Lottery locked · ready to reveal" : "Lottery pending";

  return <div className="bg-crowd bg-overlay" style={{ minHeight: "100vh" }}><Navigation showTicker={false} teamName={franchise?.team_name} /><DraftSubNav active="lottery" />
    <style>{`@keyframes lotteryFloat{0%,100%{transform:translate3d(-12px,8px,0) rotate(-7deg)}25%{transform:translate3d(20px,-22px,0) rotate(8deg)}55%{transform:translate3d(-18px,-34px,0) rotate(-4deg)}78%{transform:translate3d(25px,16px,0) rotate(6deg)}}@keyframes lotteryDraw{0%{transform:scale(.86);opacity:0}55%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){.lottery-ball{animation:none!important}.lottery-reveal{animation:none!important}}`}</style>
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "1rem 1rem 3rem" }}>
      <div className="wrc-page-title" style={{ padding: "0 0 1rem" }}><h1>2026 Draft Lottery</h1><p>Sunday, August 23, 2026 · 9:00 PM ET · Six equal chances · live sixth-through-first reveal</p></div>
      <section className="wrc-card" style={{ overflow: "hidden" }}><div className="wrc-card-gold-stripe" /><div style={{ padding: "1.25rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:"1rem", alignItems:"center", flexWrap:"wrap" }}><div><h2 style={{ margin:0, fontFamily:"Barlow Condensed, sans-serif", color:"oklch(0.22 0.08 150)" }}>{stageLabel}</h2><p style={{ margin:".3rem 0 0", color:"oklch(0.5 0.04 150)", fontSize:".86rem" }}>{result ? "The draw is permanently locked before the visual reveal begins." : "Each eligible owner has one equal chance."}</p></div>{isCommissioner && !result && <button onClick={run} disabled={draw.isPending} style={{ border:0,borderRadius:8,padding:".65rem 1rem",background:"oklch(0.72 0.15 85)",color:"oklch(0.15 0.02 150)",fontWeight:800,cursor:"pointer" }}><Play size={15} style={{ verticalAlign:"middle" }}/> {draw.isPending ? "DRAWING…" : "RUN DRAFT LOTTERY"}</button>}{isCommissioner && result && !isRunning && revealedCount === 0 && <button onClick={begin} disabled={startReveal.isPending} style={{ border:0,borderRadius:8,padding:".65rem 1rem",background:"oklch(0.28 0.09 150)",color:"white",fontWeight:800,cursor:"pointer" }}><Play size={15} style={{ verticalAlign:"middle" }}/> {startReveal.isPending ? "STARTING…" : "START LIVE REVEAL"}</button>}{result && <span style={{ color:"oklch(0.35 0.15 150)",fontWeight:700 }}><Lock size={14} style={{verticalAlign:"middle"}}/> Locked</span>}</div>
        {isRunning && revealedCount < 6 && <div style={{ textAlign:"center", margin:"1rem 0 .25rem", color:"oklch(0.28 0.09 150)", fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, letterSpacing:".08em" }}><Timer size={17} style={{verticalAlign:"middle"}}/> {countdown}s UNTIL THE NEXT REVEAL</div>}
        <div aria-live="polite" style={{ position:"relative", minHeight:330, marginTop:"1rem", borderRadius:20, overflow:"hidden", background:"radial-gradient(circle at 50% 0%, oklch(0.37 0.11 150 / .88), oklch(0.14 0.04 150))", border:"2px solid oklch(0.72 0.15 85 / .72)", boxShadow:"inset 0 0 50px rgb(0 0 0 / .45)" }}>
          <div style={{ position:"absolute", inset:"18px 14px 22px", border:"2px solid rgb(255 255 255 / .16)", borderRadius:"50% 50% 42% 42% / 36% 36% 64% 64%", background:"linear-gradient(120deg,rgb(255 255 255 / .14),transparent 45%)" }} />
          {remainingOwners.map((owner,index) => { const positions = [{left:"8%",top:"14%"},{left:"39%",top:"7%"},{left:"67%",top:"22%"},{left:"12%",top:"57%"},{left:"42%",top:"63%"},{left:"70%",top:"55%"}]; const position = positions[index] ?? positions[0]; return <div className="lottery-ball" key={owner} style={{ position:"absolute", ...position, animation:`lotteryFloat ${3.4 + index*.31}s cubic-bezier(.45,.05,.55,.95) ${index*.23}s infinite`, width:74, height:74, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:"50%", background:"radial-gradient(circle at 32% 23%, white 0 7%, oklch(.92 .08 85) 19%, oklch(.66 .15 85) 62%, oklch(.38 .10 85) 100%)", border:"3px solid oklch(0.96 0.03 85)", color:"oklch(0.18 0.07 150)", boxShadow:"inset -8px -10px 14px rgb(0 0 0 / .2), inset 5px 6px 11px rgb(255 255 255 / .65), 0 7px 17px rgb(0 0 0 / .4)", fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:".69rem", textAlign:"center", lineHeight:1, zIndex:2 }}><span style={{fontSize:".5rem",letterSpacing:".1em",opacity:.7,marginBottom:4}}>WRC</span>{owner}</div>; })}
          {nextOwner && <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center", color:"rgb(255 255 255 / .62)", fontSize:".74rem", letterSpacing:".12em", fontWeight:700 }}>SELECTING FROM {remainingOwners.length} TEAMS</div>}
          {revealedOwners.length > 0 && <div className="lottery-reveal" style={{ position:"absolute", zIndex:4, left:"50%", top:"50%", transform:"translate(-50%,-50%)", minWidth:235, textAlign:"center", borderRadius:15, padding:"1rem 1.25rem", background:"linear-gradient(135deg,oklch(0.82 .16 85),oklch(.66 .15 85))", color:"oklch(.16 .05 150)", boxShadow:"0 14px 34px rgb(0 0 0 / .45)", animation:"lotteryDraw .55s ease-out" }}><div style={{fontSize:".7rem",fontWeight:800,letterSpacing:".12em"}}>{6 - (revealedOwners.length - 1)}TH PICK REVEALED</div><div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:"1.65rem",fontWeight:900,margin:".2rem 0"}}>{revealedOwners[revealedOwners.length-1]}</div><div style={{fontWeight:800,fontSize:".82rem"}}>Round 1: 1.{String(6 - (revealedOwners.length - 1)).padStart(2,"0")} · Round 2: 2.{String(7 + (revealedOwners.length - 1)).padStart(2,"0")}</div></div>}
        </div>
        {revealedOwners.length > 0 && <div style={{ display:"flex", flexWrap:"wrap", gap:".5rem", marginTop:"1rem" }}>{revealedOwners.map((owner,index)=><div key={owner} style={{ flex:"1 1 130px", borderRadius:8, padding:".55rem", textAlign:"center", background:"oklch(.95 .08 85)", border:"1px solid oklch(.77 .14 85)", fontWeight:800, color:"oklch(.25 .08 150)" }}>{6-index}. {owner}<br/><small>1.{String(6-index).padStart(2,"0")} · 2.{String(7+index).padStart(2,"0")}</small></div>)}</div>}
        {rows && <div style={{ overflowX:"auto", marginTop:"1.25rem" }}><table className="wrc-table" style={{ minWidth:560,width:"100%" }}><thead><tr><th>LOTTERY</th><th>OWNER</th><th>ROUND 1</th><th>ROUND 2</th></tr></thead><tbody>{rows.map(row=><tr key={row.owner}><td style={{fontWeight:800,textAlign:"center"}}>{row.lotteryPick}</td><td style={{fontWeight:800}}>{row.owner}</td><td>1.{String(row.round1Pick).padStart(2,"0")}</td><td>2.{String(row.round2Pick).padStart(2,"0")}</td></tr>)}</tbody></table></div>}
        <p style={{ margin:"1rem 0 0",fontSize:".78rem",color:"oklch(0.5 0.04 150)" }}><Trophy size={14} style={{verticalAlign:"middle"}}/> Only Round 1 picks 1–6 and Round 2 picks 7–12 change. Round 1 picks 7–12, Round 2 picks 1–6, and Rounds 3–18 remain set.</p>
      </div></section>
    </main></div>;
}
