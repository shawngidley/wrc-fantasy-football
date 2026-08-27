import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { commissionerProcedure, publicProcedure, router, teamProcedure } from "./_core/trpc";
import {
  getFantasyProsInjuries,
  getFantasyProsNews,
  getFantasyProsProjections,
  getFantasyProsRanks,
} from "./fantasypros";
import { attachFantasyProsPlayerNames } from "./fantasyprosNewsNames";
import { archiveFantasyProsNews, getArchivedFantasyProsNews, mergeFantasyProsNews } from "./fantasyprosArchive";
import { getPublicLeagueTeam, listPublicLeagueTeams, verifyLeagueTeamPin } from "./leagueAuth";
import { clearWrcTeamSession, readWrcTeamSession, writeWrcTeamSession } from "./wrcTeamSession";
import { supabaseAdmin } from "./supabaseAdmin";
import { validateProtectionSubmission } from "./protectionRules";
import { releaseUnprotectedPlayers } from "./protectionRelease";
import { isProtectionDeadlinePassed } from "../shared/protectionSchedule";
import { findDraftUniversePlayer } from "../shared/draftPlayerUniverse";
import { DRAFT_LOTTERY_OWNERS, isValidDraftLotteryResult } from "../shared/draftLottery";
import { applyDraftLottery } from "../shared/draftLottery";
import { DRAFT_PICKS_2026 } from "../client/src/lib/draftData2026";
import { storagePut } from "./storage";
import { finalizeWeeklyResultsFromTank } from "./weeklyResultsFinalize";
import { assertLoginAllowed, assertStrongLeaguePin, clearLoginFailures, getClientIp, recordLoginFailure } from "./leagueLoginSecurity";
import { nanoid } from "nanoid";
import { randomInt } from "node:crypto";
import {
  PASSKEY_CHALLENGE_TTL_MS,
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  isWrcPasskeyOrigin,
  normalizePasskeyTransports,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from "./passkeyAuth";

const normalizePlayerKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const WRC_DRAFT_TIMER_SECONDS = 90;
const WRC_DRAFT_TOTAL_ROUNDS = 18;
const WRC_DRAFT_TOTAL_TEAMS = 12;
const WRC_DRAFT_OWNER_TEAM_IDS: Record<string, string> = {
  "Jonas": "team-jonas", "David R.": "team-davidr", "Jason": "team-jason", "Keith": "team-keith",
  "Dan": "team-dan", "Scott N.": "team-scottn", "Bill": "team-bill", "Jamie": "team-jamie",
  "Scott M.": "team-scottm", "David S.": "team-davids", "Shawn": "team-shawn", "Greg": "team-greg",
};

type PasskeyChallengeType = "registration" | "authentication";

function requireWrcPasskeyOrigin(origin: unknown) {
  if (!isWrcPasskeyOrigin(origin)) {
    throw new Error("Face ID sign-in is available from wrcfantasyfootball.com only.");
  }
}

async function createPasskeyChallenge(type: PasskeyChallengeType, challenge: string, teamId: string | null) {
  const id = nanoid(32);
  const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS).toISOString();
  await supabaseAdmin.from("team_passkey_challenges").delete().lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin.from("team_passkey_challenges").insert({
    id,
    challenge,
    challenge_type: type,
    team_id: teamId,
    expires_at: expiresAt,
  });
  if (error) throw new Error("Unable to start Face ID sign-in. Please try again.");
  return id;
}

async function loadUnusedPasskeyChallenge(id: string, type: PasskeyChallengeType, teamId: string | null) {
  let query = supabaseAdmin
    .from("team_passkey_challenges")
    .select("id, challenge, expires_at, used_at, team_id")
    .eq("id", id)
    .eq("challenge_type", type)
    .is("used_at", null);
  query = teamId ? query.eq("team_id", teamId) : query.is("team_id", null);
  const { data, error } = await query.maybeSingle();
  if (error || !data || new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("This Face ID request expired. Please try again.");
  }
  return data;
}

async function consumePasskeyChallenge(id: string) {
  const { data, error } = await supabaseAdmin
    .from("team_passkey_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .select("id");
  if (error || !data?.length) throw new Error("This Face ID request has already been used. Please try again.");
}

function nextDraftState(currentRound: number, currentPick: number) {
  const nextPick = currentPick + 1 >= WRC_DRAFT_TOTAL_TEAMS ? 0 : currentPick + 1;
  const nextRound = currentPick + 1 >= WRC_DRAFT_TOTAL_TEAMS ? currentRound + 1 : currentRound;
  const complete = nextRound > WRC_DRAFT_TOTAL_ROUNDS;
  return {
    current_round: complete ? currentRound : nextRound,
    current_pick: complete ? currentPick : nextPick,
    complete,
    paused: false,
    timer_seconds: WRC_DRAFT_TIMER_SECONDS,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  league: router({
    teams: publicProcedure.query(() => listPublicLeagueTeams()),
    draftLottery: publicProcedure.query(async () => {
      const { data, error } = await supabaseAdmin.from("draft_lottery").select("status, eligible_owners, result_owners, drawn_at, reveal_status, reveal_started_at").eq("id", 1).single();
      if (error || !data) throw new Error("Unable to load the draft lottery.");
      const revealStartedAt = data.reveal_started_at as string | null;
      const revealComplete = data.reveal_status === "running" && revealStartedAt !== null && Date.now() - new Date(revealStartedAt).getTime() >= 6 * 45_000;
      return { status: data.status as "pending" | "drawn", eligibleOwners: data.eligible_owners as string[], resultOwners: data.result_owners as string[] | null, appliedResultOwners: revealComplete ? data.result_owners as string[] : null, drawnAt: data.drawn_at as string | null, revealStatus: data.reveal_status as "pending" | "running", revealStartedAt };
    }),
    commissionerRunDraftLottery: commissionerProcedure.mutation(async ({ ctx }) => {
      const [{ data: lottery, error: lotteryError }, { data: draftState, error: draftError }] = await Promise.all([
        supabaseAdmin.from("draft_lottery").select("status").eq("id", 1).single(),
        supabaseAdmin.from("draft_state").select("started").eq("id", 1).single(),
      ]);
      if (lotteryError || !lottery || draftError || !draftState) throw new Error("Unable to start the draft lottery.");
      if (draftState.started) throw new Error("The lottery cannot run after the draft has started.");
      if (lottery.status === "drawn") throw new Error("The draft lottery has already been finalized.");
      const result = [...DRAFT_LOTTERY_OWNERS];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }
      if (!isValidDraftLotteryResult(result)) throw new Error("Unable to create a valid lottery result.");
      const { data, error } = await supabaseAdmin.from("draft_lottery").update({ status: "drawn", result_owners: result, drawn_by_team_id: ctx.teamSession.teamId, drawn_at: new Date().toISOString(), reveal_status: "pending", reveal_started_at: null }).eq("id", 1).eq("status", "pending").select("status, eligible_owners, result_owners, drawn_at, reveal_status, reveal_started_at").single();
      if (error || !data) throw new Error("The lottery was already run or could not be saved.");
      return { status: data.status as "drawn", eligibleOwners: data.eligible_owners as string[], resultOwners: data.result_owners as string[], drawnAt: data.drawn_at as string, revealStatus: data.reveal_status as "pending", revealStartedAt: null };
    }),
    commissionerStartDraftLotteryReveal: commissionerProcedure.mutation(async () => {
      const { data, error } = await supabaseAdmin.from("draft_lottery").update({ reveal_status: "running", reveal_started_at: new Date().toISOString() }).eq("id", 1).eq("status", "drawn").eq("reveal_status", "pending").select("reveal_status, reveal_started_at").single();
      if (error || !data) throw new Error("The lottery must be drawn once before the live reveal can start.");
      return { revealStatus: data.reveal_status as "running", revealStartedAt: data.reveal_started_at as string };
    }),
    login: publicProcedure
      .input(z.object({ teamId: z.string().min(1), pin: z.string().min(1).max(12) }))
      .mutation(async ({ input, ctx }) => {
        const ip = getClientIp(ctx.req.headers);
        assertLoginAllowed(input.teamId, ip);
        const team = await verifyLeagueTeamPin(input.teamId, input.pin);
        if (!team) {
          recordLoginFailure(input.teamId, ip);
          throw new Error("Incorrect PIN. Please try again.");
        }
        clearLoginFailures(input.teamId, ip);
        await writeWrcTeamSession(ctx.res, ctx.req, { teamId: team.id, isCommissioner: team.is_commissioner });
        return team;
      }),
    session: publicProcedure.query(async ({ ctx }) => {
      const session = await readWrcTeamSession(ctx.req);
      return session ? getPublicLeagueTeam(session.teamId) : null;
    }),
    passkeys: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("team_passkeys")
        .select("credential_id, created_at, last_used_at, device_type, backed_up")
        .eq("team_id", ctx.teamSession.teamId)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Unable to load Face ID settings.");
      return (data ?? []).map(passkey => ({
        credentialId: passkey.credential_id,
        createdAt: passkey.created_at,
        lastUsedAt: passkey.last_used_at,
        deviceType: passkey.device_type,
        backedUp: passkey.backed_up,
      }));
    }),
    startPasskeyRegistration: teamProcedure.mutation(async ({ ctx }) => {
      requireWrcPasskeyOrigin(ctx.req.headers.origin);
      const teamId = ctx.teamSession.teamId;
      const [{ data: team, error: teamError }, { data: passkeys, error: passkeysError }] = await Promise.all([
        supabaseAdmin.from("teams").select("id, name, owner").eq("id", teamId).single(),
        supabaseAdmin.from("team_passkeys").select("credential_id, transports").eq("team_id", teamId),
      ]);
      if (teamError || !team || passkeysError) throw new Error("Unable to start Face ID setup.");
      if (passkeys?.length) throw new Error("Face ID is already set up for this team. Remove it first to use a different device.");
      const options = await createPasskeyRegistrationOptions({
        teamId,
        teamName: team.name,
        ownerName: team.owner,
        existingCredentials: [],
      });
      const challengeId = await createPasskeyChallenge("registration", options.challenge, teamId);
      return { options, challengeId };
    }),
    finishPasskeyRegistration: teamProcedure
      .input(z.object({ challengeId: z.string().min(20).max(128), response: z.unknown() }))
      .mutation(async ({ input, ctx }) => {
        requireWrcPasskeyOrigin(ctx.req.headers.origin);
        const challenge = await loadUnusedPasskeyChallenge(input.challengeId, "registration", ctx.teamSession.teamId);
        await consumePasskeyChallenge(challenge.id);
        const verification = await verifyPasskeyRegistration({
          response: input.response as Parameters<typeof verifyPasskeyRegistration>[0]["response"],
          expectedChallenge: challenge.challenge,
        });
        if (!verification.verified) throw new Error("Face ID setup could not be verified. Please try again.");
        const registration = verification.registrationInfo;
        const { credential } = registration;
        const { error } = await supabaseAdmin.from("team_passkeys").insert({
          credential_id: credential.id,
          team_id: ctx.teamSession.teamId,
          public_key: Buffer.from(credential.publicKey).toString("base64url"),
          counter: credential.counter,
          transports: credential.transports ?? [],
          device_type: registration.credentialDeviceType,
          backed_up: registration.credentialBackedUp,
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error("This Face ID credential is already registered or could not be saved.");
        return { enrolled: true };
      }),
    passkeyLoginAvailable: publicProcedure
      .input(z.object({ teamId: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from("team_passkeys")
          .select("credential_id")
          .eq("team_id", input.teamId)
          .limit(1);
        if (error) throw new Error("Unable to check Face ID availability.");
        return { available: Boolean(data?.length) };
      }),
    startPasskeyLogin: publicProcedure
      .input(z.object({ teamId: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
      requireWrcPasskeyOrigin(ctx.req.headers.origin);
      const { data: passkeys, error } = await supabaseAdmin
        .from("team_passkeys")
        .select("credential_id, transports")
        .eq("team_id", input.teamId);
      if (error) throw new Error("Unable to start Face ID sign-in.");
      if (!passkeys?.length) throw new Error("Set up Face ID from Settings after signing in with your PIN.");
      const options = await createPasskeyAuthenticationOptions({
        credentials: passkeys.map(passkey => ({
          credentialId: passkey.credential_id,
          transports: normalizePasskeyTransports(passkey.transports),
        })),
      });
      const challengeId = await createPasskeyChallenge("authentication", options.challenge, input.teamId);
      return { options, challengeId };
      }),
    finishPasskeyLogin: publicProcedure
      .input(z.object({ challengeId: z.string().min(20).max(128), response: z.unknown() }))
      .mutation(async ({ input, ctx }) => {
        requireWrcPasskeyOrigin(ctx.req.headers.origin);
        const response = input.response as { id?: string };
        if (!response.id) throw new Error("Face ID sign-in did not return a credential.");
        const { data: passkey, error: passkeyError } = await supabaseAdmin
          .from("team_passkeys")
          .select("credential_id, team_id, public_key, counter, transports")
          .eq("credential_id", response.id)
          .maybeSingle();
        if (passkeyError || !passkey) throw new Error("This Face ID credential is not recognized.");
        const challenge = await loadUnusedPasskeyChallenge(input.challengeId, "authentication", passkey.team_id);
        await consumePasskeyChallenge(challenge.id);
        const verification = await verifyPasskeyAuthentication({
          response: input.response as Parameters<typeof verifyPasskeyAuthentication>[0]["response"],
          expectedChallenge: challenge.challenge,
          passkey: {
            credentialId: passkey.credential_id,
            publicKey: passkey.public_key,
            counter: Number(passkey.counter),
            transports: normalizePasskeyTransports(passkey.transports),
          },
        });
        if (!verification.verified) throw new Error("Face ID sign-in could not be verified. Please try again.");
        const { error: updateError } = await supabaseAdmin
          .from("team_passkeys")
          .update({
            counter: verification.authenticationInfo.newCounter,
            device_type: verification.authenticationInfo.credentialDeviceType,
            backed_up: verification.authenticationInfo.credentialBackedUp,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("credential_id", passkey.credential_id);
        if (updateError) throw new Error("Face ID sign-in could not be completed. Please try again.");
        const team = await getPublicLeagueTeam(passkey.team_id);
        if (!team) throw new Error("This team is no longer available.");
        await writeWrcTeamSession(ctx.res, ctx.req, { teamId: team.id, isCommissioner: team.is_commissioner });
        return team;
      }),
    removePasskey: teamProcedure
      .input(z.object({ credentialId: z.string().min(1).max(1024) }))
      .mutation(async ({ input, ctx }) => {
        const { data, error } = await supabaseAdmin
          .from("team_passkeys")
          .delete()
          .eq("credential_id", input.credentialId)
          .eq("team_id", ctx.teamSession.teamId)
          .select("credential_id");
        if (error || !data?.length) throw new Error("Face ID credential was not found.");
        return { removed: true, credentialId: input.credentialId };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearWrcTeamSession(ctx.res, ctx.req);
      return { success: true };
    }),
    lineups: publicProcedure
      .input(z.object({ teamId: z.string().min(1), week: z.number().int().min(1).max(22), season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from("lineups")
          .select("slot, player_name")
          .eq("team_id", input.teamId)
          .eq("week", input.week)
          .eq("season", input.season);
        if (error) throw new Error("Unable to load lineup");
        return data ?? [];
      }),
    saveLineup: teamProcedure
      .input(z.object({
        week: z.number().int().min(1).max(22),
        season: z.number().int().min(2020).max(2100),
        rows: z.array(z.object({
          slot: z.string().min(1).max(32),
          player_id: z.string().min(1).max(128),
          player_name: z.string().min(1).max(128),
          is_bench: z.boolean(),
        })).min(1).max(30),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { error: deleteError } = await supabaseAdmin
          .from("lineups")
          .delete()
          .eq("team_id", teamId)
          .eq("week", input.week)
          .eq("season", input.season);
        if (deleteError) throw new Error("Unable to replace lineup");

        const { error: insertError } = await supabaseAdmin.from("lineups").insert(
          input.rows.map(row => ({ ...row, team_id: teamId, week: input.week, season: input.season })),
        );
        if (insertError) throw new Error("Unable to save lineup");
        return { teamId, saved: input.rows.length };
      }),
    draftQueue: teamProcedure
      .input(z.object({ season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input, ctx }) => {
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .select("id, team_id, player_name, player_pos, player_nfl_team, rank, season")
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)
          .order("rank", { ascending: true });
        if (error) throw new Error("Unable to load draft queue");
        return data ?? [];
      }),
    addDraftQueueItem: teamProcedure
      .input(z.object({
        season: z.number().int().min(2020).max(2100),
        playerName: z.string().min(1).max(128),
        playerPos: z.string().min(1).max(8),
        playerNflTeam: z.string().max(8).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const validatedPlayer = input.playerNflTeam
          ? findDraftUniversePlayer({ name: input.playerName, pos: input.playerPos, nflTeam: input.playerNflTeam })
          : null;
        if (!validatedPlayer) {
          throw new Error("Player is not in the validated 2026 WRC draft pool");
        }
        const teamId = ctx.teamSession.teamId;
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("draft_queue")
          .select("id, rank")
          .eq("team_id", teamId)
          .eq("season", input.season)
          .eq("player_name", validatedPlayer.name)
          .maybeSingle();
        if (existingError) throw new Error("Unable to check draft queue");
        if (existing) throw new Error("This player is already in your queue");

        const { data: last, error: lastError } = await supabaseAdmin
          .from("draft_queue")
          .select("rank")
          .eq("team_id", teamId)
          .eq("season", input.season)
          .order("rank", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastError) throw new Error("Unable to load draft queue");
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .insert({
            team_id: teamId,
            season: input.season,
            player_name: validatedPlayer.name,
            player_pos: validatedPlayer.pos,
            player_nfl_team: validatedPlayer.nflTeam,
            rank: Number(last?.rank ?? 0) + 1,
          })
          .select("id, team_id, player_name, player_pos, player_nfl_team, rank, season")
          .single();
        if (error || !data) throw new Error("Unable to add draft queue player");
        return data;
      }),
    removeDraftQueueItem: teamProcedure
      .input(z.object({ id: z.number().int().positive(), season: z.number().int().min(2020).max(2100) }))
      .mutation(async ({ input, ctx }) => {
        const { data, error } = await supabaseAdmin
          .from("draft_queue")
          .delete()
          .eq("id", input.id)
          .eq("season", input.season)
          .eq("team_id", ctx.teamSession.teamId)
          .select("id");
        if (error || !data?.length) throw new Error("Draft queue item was not found");
        return { id: input.id };
      }),
    reorderDraftQueue: teamProcedure
      .input(z.object({ season: z.number().int().min(2020).max(2100), orderedIds: z.array(z.number().int().positive()).min(1).max(300) }))
      .mutation(async ({ input, ctx }) => {
        const { data: ownedRows, error: ownedError } = await supabaseAdmin
          .from("draft_queue")
          .select("id")
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)
          .in("id", input.orderedIds);
        if (ownedError || (ownedRows?.length ?? 0) !== input.orderedIds.length) throw new Error("One or more draft queue items are not owned by your team");
        const results = await Promise.all(input.orderedIds.map((id, index) => supabaseAdmin
          .from("draft_queue")
          .update({ rank: index + 1 })
          .eq("id", id)
          .eq("team_id", ctx.teamSession.teamId)
          .eq("season", input.season)));
        if (results.some(result => result.error)) throw new Error("Unable to reorder draft queue");
        return { saved: input.orderedIds.length };
      }),
    watchlist: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("watchlist")
        .select("player_name, pos, nfl_team, added_at")
        .eq("team_id", ctx.teamSession.teamId)
        .order("added_at", { ascending: false });
      if (error) throw new Error("Unable to load watchlist");
      return data ?? [];
    }),
    toggleWatchlistPlayer: teamProcedure
      .input(z.object({
        playerName: z.string().min(1).max(128),
        pos: z.string().min(1).max(8),
        nflTeam: z.string().min(1).max(8),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("watchlist")
          .select("player_name")
          .eq("team_id", teamId)
          .eq("player_name", input.playerName)
          .maybeSingle();
        if (existingError) throw new Error("Unable to check watchlist");

        if (existing) {
          const { data, error } = await supabaseAdmin
            .from("watchlist")
            .delete()
            .eq("team_id", teamId)
            .eq("player_name", input.playerName)
            .select("player_name");
          if (error || !data?.length) throw new Error("Unable to remove player from watchlist");
          return { action: "removed" as const, playerName: input.playerName };
        }

        const addedAt = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("watchlist")
          .insert({
            team_id: teamId,
            player_name: input.playerName,
            pos: input.pos,
            nfl_team: input.nflTeam,
            added_at: addedAt,
          })
          .select("player_name, pos, nfl_team, added_at")
          .single();
        if (error || !data) throw new Error("Unable to add player to watchlist");
        return { action: "added" as const, player: data };
      }),
    freeAgentColumnPreferences: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("free_agent_column_preferences")
        .select("visible_columns, updated_at")
        .eq("team_id", ctx.teamSession.teamId)
        .maybeSingle();
      if (error) throw new Error("Unable to load Free Agents column preferences");
      return {
        visibleColumns: Array.isArray(data?.visible_columns)
          ? data.visible_columns.filter((value): value is string => typeof value === "string")
          : null,
        updatedAt: data?.updated_at ?? null,
      };
    }),
    saveFreeAgentColumnPreferences: teamProcedure
      .input(z.object({
        visibleColumns: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).max(32)).max(40),
      }))
      .mutation(async ({ input, ctx }) => {
        const visibleColumns = Array.from(new Set(input.visibleColumns));
        const { data, error } = await supabaseAdmin
          .from("free_agent_column_preferences")
          .upsert({
            team_id: ctx.teamSession.teamId,
            visible_columns: visibleColumns,
            updated_at: new Date().toISOString(),
          }, { onConflict: "team_id" })
          .select("visible_columns, updated_at")
          .single();
        if (error || !data) throw new Error("Unable to save Free Agents column preferences");
        return {
          visibleColumns: Array.isArray(data.visible_columns)
            ? data.visible_columns.filter((value): value is string => typeof value === "string")
            : [],
          updatedAt: data.updated_at,
        };
      }),
    faabBidRoster: teamProcedure.query(async ({ ctx }) => {
      const teamId = ctx.teamSession.teamId;
      const [{ data: roster, error: rosterError }, { data: team, error: teamError }] = await Promise.all([
        supabaseAdmin
          .from("players")
          .select("id, name, position, nfl_team")
          .eq("team_id", teamId)
          .order("position"),
        supabaseAdmin
          .from("teams")
          .select("faab")
          .eq("id", teamId)
          .single(),
      ]);
      if (rosterError || teamError || !team) throw new Error("Unable to load FAAB bid details");
      return { roster: roster ?? [], faab: Number(team.faab ?? 0) };
    }),
    submitFaabBid: teamProcedure
      .input(z.object({
        playerId: z.string().min(1).max(128),
        playerName: z.string().min(1).max(128),
        playerPos: z.string().min(1).max(8),
        playerNflTeam: z.string().min(1).max(8),
        bidAmount: z.number().int().min(0).max(10_000),
        dropPlayerId: z.string().min(1).max(128).nullable(),
        week: z.number().int().min(1).max(22),
        season: z.number().int().min(2020).max(2100),
      }))
      .mutation(async ({ input, ctx }) => {
        const teamId = ctx.teamSession.teamId;
        const [{ data: team, error: teamError }, { data: roster, error: rosterError }, { data: targetPlayer, error: targetPlayerError }] = await Promise.all([
          supabaseAdmin.from("teams").select("name, faab").eq("id", teamId).single(),
          supabaseAdmin.from("players").select("id").eq("team_id", teamId),
          supabaseAdmin.from("players").select("team_id").eq("name", input.playerName).maybeSingle(),
        ]);
        if (teamError || !team || rosterError || targetPlayerError) throw new Error("Unable to validate this FAAB bid");
        const faab = Number(team.faab ?? 0);
        if (input.bidAmount > faab) throw new Error(`Bid exceeds your FAAB balance ($${faab} remaining).`);
        if (targetPlayer?.team_id) throw new Error("This player is already on a WRC roster.");
        if ((roster?.length ?? 0) >= 18 && !input.dropPlayerId) throw new Error("Select a player to drop before bidding with a full roster.");

        let dropPlayer: { id: string; name: string } | null = null;
        if (input.dropPlayerId) {
          const { data, error } = await supabaseAdmin
            .from("players")
            .select("id, name")
            .eq("id", input.dropPlayerId)
            .eq("team_id", teamId)
            .maybeSingle();
          if (error || !data) throw new Error("The selected drop player is not on your roster.");
          dropPlayer = data;
        }

        const { error } = await supabaseAdmin.from("faab_bids").insert({
          team_id: teamId,
          team_name: team.name,
          player_id: input.playerId,
          player_name: input.playerName,
          player_pos: input.playerPos,
          player_nfl_team: input.playerNflTeam,
          bid_amount: input.bidAmount,
          drop_player_id: dropPlayer?.id ?? null,
          drop_player_name: dropPlayer?.name ?? null,
          status: "pending",
          week: input.week,
          season: input.season,
        });
        if (error) throw new Error("Unable to submit FAAB bid");
        return { submitted: true, bidAmount: input.bidAmount };
      }),
    commissionerFaabBids: commissionerProcedure
      .input(z.object({ week: z.number().int().min(1).max(22), season: z.number().int().min(2020).max(2100) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin
          .from("faab_bids")
          .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name, status, week, season, created_at")
          .eq("week", input.week)
          .eq("season", input.season)
          .order("player_name", { ascending: true })
          .order("bid_amount", { ascending: false });
        if (error) throw new Error("Unable to load FAAB bids");
        return data ?? [];
      }),
    awardFaabBid: commissionerProcedure
      .input(z.object({ bidId: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        const { data: bid, error: bidError } = await supabaseAdmin
          .from("faab_bids")
          .select("id, team_id, team_name, player_id, player_name, player_pos, player_nfl_team, bid_amount, drop_player_id, drop_player_name, status, week, season")
          .eq("id", input.bidId)
          .single();
        if (bidError || !bid || bid.status !== "pending") throw new Error("This pending FAAB bid was not found.");

        const resolvedAt = new Date().toISOString();
        const [{ error: winError }, { error: loseError }, { data: winningTeam, error: teamError }] = await Promise.all([
          supabaseAdmin.from("faab_bids").update({ status: "won", resolved_at: resolvedAt }).eq("id", bid.id),
          supabaseAdmin.from("faab_bids").update({ status: "lost", resolved_at: resolvedAt })
            .eq("player_id", bid.player_id).eq("week", bid.week).eq("season", bid.season).eq("status", "pending").neq("id", bid.id),
          supabaseAdmin.from("teams").select("faab").eq("id", bid.team_id).single(),
        ]);
        if (winError || loseError || teamError || !winningTeam) throw new Error("Unable to resolve FAAB bids");
        const remainingFaab = Math.max(0, Number(winningTeam.faab ?? 0) - Number(bid.bid_amount));
        const { error: faabError } = await supabaseAdmin.from("teams").update({ faab: remainingFaab }).eq("id", bid.team_id);
        if (faabError) throw new Error("Unable to deduct the winning FAAB bid");

        const { error: addError } = await supabaseAdmin.from("players")
          .update({ team_id: bid.team_id, acquisition: "FA" })
          .eq("name", bid.player_name);
        if (addError) throw new Error("Unable to add the awarded player to the roster");
        if (bid.drop_player_id) {
          const { error: dropError } = await supabaseAdmin.from("players")
            .update({ team_id: null, acquisition: "FA" })
            .eq("id", bid.drop_player_id)
            .eq("team_id", bid.team_id);
          if (dropError) throw new Error("Unable to drop the selected player");
        }

        const moves = [{
          move_type: "ADD",
          team_name: bid.team_name,
          owner: bid.team_name,
          player_name: bid.player_name,
          player_pos: bid.player_pos,
          player_nfl_team: bid.player_nfl_team,
          faab_spent: bid.bid_amount,
          note: `FAAB $${bid.bid_amount} — Week ${bid.week}`,
        }];
        if (bid.drop_player_name) moves.push({
          move_type: "DROP",
          team_name: bid.team_name,
          owner: bid.team_name,
          player_name: bid.drop_player_name,
          player_pos: "—",
          player_nfl_team: "FA",
          faab_spent: null,
          note: `Dropped to make room for ${bid.player_name}`,
        });
        const { error: moveError } = await supabaseAdmin.from("roster_moves").insert(moves);
        if (moveError) throw new Error("FAAB was processed, but transaction history could not be written");
        return { awarded: true, bidId: bid.id, playerName: bid.player_name, teamName: bid.team_name, remainingFaab };
      }),
    protections: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("protections")
        .select("player_id, tier, forfeited_round")
        .eq("team_id", ctx.teamSession.teamId);
      if (error) throw new Error("Unable to load protections");
      return (data ?? []).map(row => ({ playerId: row.player_id, assignedRound: row.forfeited_round }));
    }),
    saveProtections: teamProcedure
      .input(z.object({
        slots: z.array(z.object({
          playerId: z.string().min(1).max(128),
          assignedRound: z.number().int().min(1).max(18).nullable(),
        })).max(3),
      }))
      .mutation(async ({ input, ctx }) => {
        if (isProtectionDeadlinePassed()) {
          throw new Error("The protection deadline has passed. Unprotected players are now in the draft pool.");
        }
        const teamId = ctx.teamSession.teamId;
        const { data: roster, error: rosterError } = await supabaseAdmin
          .from("players")
          .select("id, draft_round")
          .eq("team_id", teamId);
        if (rosterError) throw new Error("Unable to validate your roster protections");
        const validated = validateProtectionSubmission(
          input.slots,
          (roster ?? []).map(player => ({ id: player.id, draftRound: player.draft_round })),
        );
        const { error: deleteError } = await supabaseAdmin
          .from("protections")
          .delete()
          .eq("team_id", teamId);
        if (deleteError) throw new Error("Unable to replace protections");
        if (validated.length) {
          const { error: insertError } = await supabaseAdmin.from("protections").insert(
            validated.map(slot => ({
              team_id: teamId,
              player_id: slot.playerId,
              tier: slot.tier,
              forfeited_round: slot.forfeitedRound,
              submitted: true,
            })),
          );
          if (insertError) throw new Error("Unable to save protections");
        }
        return { slots: validated.map(slot => ({ playerId: slot.playerId, assignedRound: slot.forfeitedRound })) };
      }),
    tradeTeamData: teamProcedure
      .input(z.object({ teamName: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const { data: team, error: teamError } = await supabaseAdmin
          .from("teams")
          .select("id, faab")
          .eq("name", input.teamName)
          .maybeSingle();
        if (teamError || !team) throw new Error("Trade team was not found");
        const [{ data: roster, error: rosterError }, { data: picks, error: picksError }] = await Promise.all([
          supabaseAdmin.from("players").select("id, name, position, nfl_team").eq("team_id", team.id).order("position").order("name"),
          supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", team.id).in("year", [2026, 2027]).order("year").order("round"),
        ]);
        if (rosterError || picksError) throw new Error("Unable to load trade assets");
        return {
          teamId: team.id,
          faab: Number(team.faab ?? 0),
          roster: roster ?? [],
          ownedPicks: (picks ?? []).map(pick => ({ year: pick.year, round: pick.round, originalTeamId: pick.original_team_id })),
        };
      }),
    tradeInbox: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin
        .from("trade_proposals")
        .select("id, from_team_id, to_team_id, give_player_ids, receive_player_ids, faab_amount, receive_faab_amount, give_picks, receive_picks, note, status, created_at")
        .eq("to_team_id", ctx.teamSession.teamId)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Unable to load trade proposals");
      return data ?? [];
    }),
    createTradeProposal: teamProcedure
      .input(z.object({
        toTeamId: z.string().min(1).max(128),
        givePlayerNames: z.array(z.string().min(1).max(128)).max(30),
        receivePlayerNames: z.array(z.string().min(1).max(128)).max(30),
        giveFaab: z.number().int().min(0).max(10_000),
        receiveFaab: z.number().int().min(0).max(10_000),
        givePicks: z.array(z.object({ year: z.number().int().min(2026).max(2027), round: z.number().int().min(1).max(18), originalTeamId: z.string().min(1).max(128).optional() })).max(36),
        receivePicks: z.array(z.object({ year: z.number().int().min(2026).max(2027), round: z.number().int().min(1).max(18), originalTeamId: z.string().min(1).max(128).optional() })).max(36),
        note: z.string().max(1_000),
        counterToId: z.string().uuid().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        const fromTeamId = ctx.teamSession.teamId;
        if (input.toTeamId === fromTeamId) throw new Error("You cannot propose a trade to your own team.");
        const unique = <T,>(items: T[], key: (item: T) => string) => new Set(items.map(key)).size === items.length;
        if (!unique(input.givePlayerNames, name => name.toLowerCase()) || !unique(input.receivePlayerNames, name => name.toLowerCase())
          || !unique(input.givePicks, pick => `${pick.year}-${pick.round}-${pick.originalTeamId ?? "legacy"}`) || !unique(input.receivePicks, pick => `${pick.year}-${pick.round}-${pick.originalTeamId ?? "legacy"}`)) {
          throw new Error("Each trade asset may only be included once.");
        }
        const [fromTeamResponse, toTeamResponse, givePlayersResponse, receivePlayersResponse, givePicksResponse, receivePicksResponse] = await Promise.all([
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", fromTeamId).single(),
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", input.toTeamId).single(),
          input.givePlayerNames.length ? supabaseAdmin.from("players").select("name").eq("team_id", fromTeamId).in("name", input.givePlayerNames) : Promise.resolve({ data: [], error: null }),
          input.receivePlayerNames.length ? supabaseAdmin.from("players").select("name").eq("team_id", input.toTeamId).in("name", input.receivePlayerNames) : Promise.resolve({ data: [], error: null }),
          input.givePicks.length ? supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", fromTeamId).in("year", input.givePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
          input.receivePicks.length ? supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", input.toTeamId).in("year", input.receivePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (fromTeamResponse.error || toTeamResponse.error || !fromTeamResponse.data || !toTeamResponse.data
          || givePlayersResponse.error || receivePlayersResponse.error || givePicksResponse.error || receivePicksResponse.error) {
          throw new Error("Unable to validate trade assets");
        }
        if (Number(fromTeamResponse.data.faab ?? 0) < input.giveFaab || Number(toTeamResponse.data.faab ?? 0) < input.receiveFaab) {
          throw new Error("One team no longer has the FAAB included in this proposal.");
        }
        if ((givePlayersResponse.data?.length ?? 0) !== input.givePlayerNames.length || (receivePlayersResponse.data?.length ?? 0) !== input.receivePlayerNames.length) {
          throw new Error("One or more selected players are no longer on the proposed roster.");
        }
        const hasEveryPick = (owned: Array<{ year: number; round: number; original_team_id: string }> | null, picks: Array<{ year: number; round: number; originalTeamId?: string }>) =>
          picks.every(pick => owned?.some(candidate => candidate.year === pick.year && candidate.round === pick.round && (!pick.originalTeamId || candidate.original_team_id === pick.originalTeamId)));
        if (!hasEveryPick(givePicksResponse.data, input.givePicks) || !hasEveryPick(receivePicksResponse.data, input.receivePicks)) {
          throw new Error("One or more selected draft picks are no longer owned by the proposed team.");
        }
        if (input.counterToId) {
          const { data: original, error } = await supabaseAdmin.from("trade_proposals")
            .select("id, from_team_id, to_team_id, status").eq("id", input.counterToId).single();
          if (error || !original || original.status !== "pending" || original.to_team_id !== fromTeamId || original.from_team_id !== input.toTeamId) {
            throw new Error("Only the recipient of a pending proposal may send its counter-offer.");
          }
        }
        const { data: proposal, error: insertError } = await supabaseAdmin.from("trade_proposals").insert({
          from_team_id: fromTeamId,
          to_team_id: input.toTeamId,
          give_player_ids: input.givePlayerNames,
          receive_player_ids: input.receivePlayerNames,
          faab_amount: input.giveFaab,
          receive_faab_amount: input.receiveFaab,
          give_picks: input.givePicks,
          receive_picks: input.receivePicks,
          note: input.note.trim(),
          status: "pending",
          counter_to_id: input.counterToId,
        }).select("id").single();
        if (insertError || !proposal) throw new Error("Unable to create trade proposal");
        if (input.counterToId) {
          const { error } = await supabaseAdmin.from("trade_proposals").update({ status: "countered" }).eq("id", input.counterToId);
          if (error) throw new Error("Counter-offer was created, but the original proposal could not be closed.");
        }
        return { id: proposal.id, recipientName: toTeamResponse.data.name, isCounter: Boolean(input.counterToId) };
      }),
    respondToTradeProposal: teamProcedure
      .input(z.object({ proposalId: z.string().uuid(), action: z.enum(["accepted", "declined"]) }))
      .mutation(async ({ input, ctx }) => {
        const recipientTeamId = ctx.teamSession.teamId;
        const { data: proposal, error: proposalError } = await supabaseAdmin.from("trade_proposals")
          .select("id, from_team_id, to_team_id, give_player_ids, receive_player_ids, faab_amount, receive_faab_amount, give_picks, receive_picks, note, status")
          .eq("id", input.proposalId).eq("to_team_id", recipientTeamId).single();
        if (proposalError || !proposal || proposal.status !== "pending") throw new Error("This pending proposal is not available to your team.");
        if (input.action === "declined") {
          const { error } = await supabaseAdmin.from("trade_proposals").update({ status: "declined" }).eq("id", proposal.id).eq("to_team_id", recipientTeamId);
          if (error) throw new Error("Unable to decline trade proposal");
          return { status: "declined" as const };
        }

        const givePlayers = (proposal.give_player_ids ?? []) as string[];
        const receivePlayers = (proposal.receive_player_ids ?? []) as string[];
        const givePicks = (proposal.give_picks ?? []) as Array<{ year: number; round: number; originalTeamId?: string }>;
        const receivePicks = (proposal.receive_picks ?? []) as Array<{ year: number; round: number; originalTeamId?: string }>;
        const [fromTeamResponse, toTeamResponse, fromPlayersResponse, toPlayersResponse, fromPicksResponse, toPicksResponse] = await Promise.all([
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", proposal.from_team_id).single(),
          supabaseAdmin.from("teams").select("id, name, faab").eq("id", proposal.to_team_id).single(),
          givePlayers.length ? supabaseAdmin.from("players").select("name, position, nfl_team").eq("team_id", proposal.from_team_id).in("name", givePlayers) : Promise.resolve({ data: [], error: null }),
          receivePlayers.length ? supabaseAdmin.from("players").select("name, position, nfl_team").eq("team_id", proposal.to_team_id).in("name", receivePlayers) : Promise.resolve({ data: [], error: null }),
          givePicks.length ? supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", proposal.from_team_id).in("year", givePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
          receivePicks.length ? supabaseAdmin.from("traded_picks").select("year, round, original_team_id").eq("current_owner_team_id", proposal.to_team_id).in("year", receivePicks.map(pick => pick.year)) : Promise.resolve({ data: [], error: null }),
        ]);
        if (fromTeamResponse.error || toTeamResponse.error || !fromTeamResponse.data || !toTeamResponse.data || fromPlayersResponse.error || toPlayersResponse.error || fromPicksResponse.error || toPicksResponse.error) {
          throw new Error("Unable to validate trade assets for acceptance.");
        }
        const hasEveryPick = (owned: Array<{ year: number; round: number; original_team_id: string }> | null, picks: Array<{ year: number; round: number; originalTeamId?: string }>) =>
          picks.every(pick => owned?.some(candidate => candidate.year === pick.year && candidate.round === pick.round && (!pick.originalTeamId || candidate.original_team_id === pick.originalTeamId)));
        if ((fromPlayersResponse.data?.length ?? 0) !== givePlayers.length || (toPlayersResponse.data?.length ?? 0) !== receivePlayers.length
          || !hasEveryPick(fromPicksResponse.data, givePicks) || !hasEveryPick(toPicksResponse.data, receivePicks)
          || Number(fromTeamResponse.data.faab ?? 0) < Number(proposal.faab_amount ?? 0)
          || Number(toTeamResponse.data.faab ?? 0) < Number(proposal.receive_faab_amount ?? 0)) {
          throw new Error("This proposal can no longer be accepted because one or more assets changed.");
        }

        const fromTeam = fromTeamResponse.data;
        const toTeam = toTeamResponse.data;
        const [outgoingMoves, incomingMoves] = await Promise.all([
          Promise.all(givePlayers.map(name => supabaseAdmin.from("players").update({ team_id: toTeam.id }).eq("name", name).eq("team_id", fromTeam.id))),
          Promise.all(receivePlayers.map(name => supabaseAdmin.from("players").update({ team_id: fromTeam.id }).eq("name", name).eq("team_id", toTeam.id))),
        ]);
        if ([...outgoingMoves, ...incomingMoves].some(result => result.error)) throw new Error("Unable to move all trade players.");
        const fromFaab = Number(fromTeam.faab ?? 0) - Number(proposal.faab_amount ?? 0) + Number(proposal.receive_faab_amount ?? 0);
        const toFaab = Number(toTeam.faab ?? 0) - Number(proposal.receive_faab_amount ?? 0) + Number(proposal.faab_amount ?? 0);
        const [{ error: fromFaabError }, { error: toFaabError }, ...pickTransfers] = await Promise.all([
          supabaseAdmin.from("teams").update({ faab: fromFaab }).eq("id", fromTeam.id),
          supabaseAdmin.from("teams").update({ faab: toFaab }).eq("id", toTeam.id),
          ...givePicks.map(pick => {
            const update = supabaseAdmin.from("traded_picks").update({ current_owner_team_id: toTeam.id }).eq("year", pick.year).eq("round", pick.round).eq("current_owner_team_id", fromTeam.id);
            return pick.originalTeamId ? update.eq("original_team_id", pick.originalTeamId) : update;
          }),
          ...receivePicks.map(pick => {
            const update = supabaseAdmin.from("traded_picks").update({ current_owner_team_id: fromTeam.id }).eq("year", pick.year).eq("round", pick.round).eq("current_owner_team_id", toTeam.id);
            return pick.originalTeamId ? update.eq("original_team_id", pick.originalTeamId) : update;
          }),
        ]);
        if (fromFaabError || toFaabError || pickTransfers.some(result => result.error)) throw new Error("Unable to transfer all trade FAAB or draft picks.");
        const { error: statusError } = await supabaseAdmin.from("trade_proposals").update({ status: "accepted" }).eq("id", proposal.id).eq("to_team_id", recipientTeamId);
        if (statusError) throw new Error("Trade assets moved, but the proposal could not be finalized.");

        const playerMeta = new Map([...fromPlayersResponse.data ?? [], ...toPlayersResponse.data ?? []].map(player => [player.name, player]));
        const transactionRows = [
          ...givePlayers.map(name => ({ move_type: "TRADE", team_name: fromTeam.name, owner: fromTeam.name, player_name: name, player_pos: playerMeta.get(name)?.position ?? "—", player_nfl_team: playerMeta.get(name)?.nfl_team ?? "—", faab_spent: null, note: `Traded to ${toTeam.name}` })),
          ...receivePlayers.map(name => ({ move_type: "TRADE", team_name: toTeam.name, owner: toTeam.name, player_name: name, player_pos: playerMeta.get(name)?.position ?? "—", player_nfl_team: playerMeta.get(name)?.nfl_team ?? "—", faab_spent: null, note: `Traded to ${fromTeam.name}` })),
          ...givePicks.map(pick => ({ move_type: "TRADE", team_name: fromTeam.name, owner: fromTeam.name, player_name: `${pick.year} Rd ${pick.round} Pick`, player_pos: "PICK", player_nfl_team: "—", faab_spent: null, note: `Pick traded to ${toTeam.name}` })),
          ...receivePicks.map(pick => ({ move_type: "TRADE", team_name: toTeam.name, owner: toTeam.name, player_name: `${pick.year} Rd ${pick.round} Pick`, player_pos: "PICK", player_nfl_team: "—", faab_spent: null, note: `Pick traded to ${fromTeam.name}` })),
        ];
        if (transactionRows.length) {
          const { error } = await supabaseAdmin.from("roster_moves").insert(transactionRows);
          if (error) throw new Error("Trade completed, but transaction history could not be written.");
        }
        return { status: "accepted" as const, fromTeamName: fromTeam.name, toTeamName: toTeam.name };
      }),
    commissionerDraftAction: commissionerProcedure
      .input(z.object({ action: z.enum(["start", "togglePause", "skip", "reset"]) }))
      .mutation(async ({ input }) => {
        const { data: state, error: stateError } = await supabaseAdmin.from("draft_state").select("started, paused, complete, current_round, current_pick").eq("id", 1).single();
        if (stateError || !state) throw new Error("Unable to load draft state");
        if (input.action === "reset") {
          const { error: deleteError } = await supabaseAdmin.from("draft_picks").delete().neq("id", 0);
          if (deleteError) throw new Error("Unable to reset draft picks");
          const { error } = await supabaseAdmin.from("draft_state").update({
            started: false, paused: false, complete: false, current_round: 1, current_pick: 0,
            timer_seconds: WRC_DRAFT_TIMER_SECONDS, updated_at: new Date().toISOString(),
          }).eq("id", 1);
          if (error) throw new Error("Unable to reset draft state");
          return { action: "reset" as const };
        }
        const patch = input.action === "start"
          ? { started: true, paused: false, complete: false, current_round: 1, current_pick: 0, timer_seconds: WRC_DRAFT_TIMER_SECONDS }
          : input.action === "togglePause"
            ? { paused: !state.paused }
            : nextDraftState(state.current_round, state.current_pick);
        const { error } = await supabaseAdmin.from("draft_state").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
        if (error) throw new Error("Unable to update draft state");
        return { action: input.action };
      }),
    makeDraftPick: teamProcedure
      .input(z.object({ playerName: z.string().min(1).max(128), playerPos: z.string().min(1).max(8), playerNflTeam: z.string().min(1).max(8) }))
      .mutation(async ({ input, ctx }) => {
        const { data: state, error: stateError } = await supabaseAdmin.from("draft_state")
          .select("started, paused, complete, current_round, current_pick").eq("id", 1).single();
        if (stateError || !state) throw new Error("Unable to load draft state");
        if (!state.started || state.paused || state.complete) throw new Error("The draft is not currently accepting picks.");
        await releaseUnprotectedPlayers();
        const overall = (state.current_round - 1) * WRC_DRAFT_TOTAL_TEAMS + state.current_pick + 1;
        const { data: lottery } = await supabaseAdmin.from("draft_lottery").select("result_owners, reveal_status, reveal_started_at").eq("id", 1).maybeSingle();
        const revealComplete = lottery?.reveal_status === "running" && lottery?.reveal_started_at && Date.now() - new Date(lottery.reveal_started_at).getTime() >= 6 * 45_000;
        const resultOwners = revealComplete && isValidDraftLotteryResult(lottery?.result_owners) ? lottery.result_owners : null;
        const order = applyDraftLottery(DRAFT_PICKS_2026, resultOwners);
        const currentPick = order.find(pick => pick.overall === overall);
        if (!currentPick) throw new Error("Unable to identify the current draft pick.");
        const expectedTeamId = WRC_DRAFT_OWNER_TEAM_IDS[currentPick.owner];
        if (!ctx.teamSession.isCommissioner && ctx.teamSession.teamId !== expectedTeamId) throw new Error("It is not your team’s turn to draft.");
        const draftPlayer = findDraftUniversePlayer({ name: input.playerName, pos: input.playerPos, nflTeam: input.playerNflTeam });
        if (!draftPlayer) throw new Error("This player is not in the validated 2026 WRC draft pool.");
        const { data: existingPick, error: existingPickError } = await supabaseAdmin.from("draft_picks").select("id").eq("player_name", draftPlayer.name).maybeSingle();
        if (existingPickError) throw new Error("Unable to verify player availability");
        if (existingPick) throw new Error("This player has already been drafted.");
        const { data: rosteredPlayer, error: rosteredPlayerError } = await supabaseAdmin
          .from("players")
          .select("id, team_id")
          .ilike("name", draftPlayer.name)
          .maybeSingle();
        if (rosteredPlayerError) throw new Error("Unable to verify protected player availability.");
        if (rosteredPlayer?.team_id) {
          const { data: protection, error: protectionError } = await supabaseAdmin
            .from("protections")
            .select("player_id")
            .eq("player_id", rosteredPlayer.id)
            .maybeSingle();
          if (protectionError) throw new Error("Unable to verify protected player availability.");
          if (protection) throw new Error("This player is protected and cannot be drafted.");
        }

        const teamNameResponse = await supabaseAdmin.from("teams").select("name").eq("id", expectedTeamId).single();
        if (teamNameResponse.error || !teamNameResponse.data) throw new Error("Unable to identify the drafting team.");
        const { data: savedPick, error: pickError } = await supabaseAdmin.from("draft_picks").insert({
          round: state.current_round,
          pick: state.current_pick,
          overall,
          team_name: teamNameResponse.data.name,
          owner: currentPick.owner,
          player_name: draftPlayer.name,
          player_pos: draftPlayer.pos,
          player_nfl_team: draftPlayer.nflTeam,
        }).select("id, round, pick, overall, team_name, owner, player_name, player_pos, player_nfl_team, picked_at").single();
        if (pickError || !savedPick) throw new Error("Unable to record draft pick");
        const rosterResult = rosteredPlayer
          ? await supabaseAdmin.from("players").update({
              team_id: expectedTeamId,
              acquisition: `Rd ${state.current_round}`,
              draft_round: state.current_round,
              draft_pick: overall,
            }).eq("id", rosteredPlayer.id)
          : await supabaseAdmin.from("players").insert({
              team_id: expectedTeamId,
              name: draftPlayer.name,
              position: draftPlayer.pos,
              nfl_team: draftPlayer.nflTeam,
              acquisition: `Rd ${state.current_round}`,
              draft_round: state.current_round,
              draft_pick: overall,
              status: "active",
              season_fpts: 0,
              fpg: 0,
              bye_week: draftPlayer.bye ?? 0,
              stats: {},
              is_starter: false,
            });
        const rosterError = rosterResult.error;
        if (rosterError) throw new Error("Draft pick was saved, but the team roster could not be updated.");
        const { error: advanceError } = await supabaseAdmin.from("draft_state").update({
          ...nextDraftState(state.current_round, state.current_pick),
          updated_at: new Date().toISOString(),
        }).eq("id", 1).eq("current_round", state.current_round).eq("current_pick", state.current_pick);
        if (advanceError) throw new Error("Draft pick was saved, but the draft clock could not advance.");
        return { pick: savedPick, complete: state.current_round === WRC_DRAFT_TOTAL_ROUNDS && state.current_pick === WRC_DRAFT_TOTAL_TEAMS - 1 };
      }),
    commissionerFinalizeWeeklyResult: commissionerProcedure
      .input(z.object({ resultId: z.number().int().positive(), homeScore: z.number().finite().min(0).max(500), awayScore: z.number().finite().min(0).max(500) }))
      .mutation(async ({ input }) => {
        const { data: target, error: targetError } = await supabaseAdmin.from("weekly_results")
          .select("id, week, season").eq("id", input.resultId).single();
        if (targetError || !target) throw new Error("The selected weekly result was not found.");
        const { error: resultError } = await supabaseAdmin.from("weekly_results").update({
          home_score: input.homeScore,
          away_score: input.awayScore,
          is_final: true,
        }).eq("id", target.id);
        if (resultError) throw new Error("Unable to finalize the weekly result.");

        const [{ data: seasonResults, error: seasonResultsError }, { data: standings, error: standingsError }] = await Promise.all([
          supabaseAdmin.from("weekly_results").select("week, home_owner, away_owner, home_team_id, away_team_id, home_score, away_score, is_final").eq("season", target.season).eq("is_final", true).order("week"),
          supabaseAdmin.from("team_standings").select("team_id, wins, losses, ties, pts_for, pts_against, h2h_wins, h2h_losses, median_wins, median_losses, div_wins, div_losses, streak, division"),
        ]);
        if (seasonResultsError || standingsError || !standings) throw new Error("Result saved, but standings could not be recalculated.");
        const divisionByTeam = new Map(standings.map(standing => [standing.team_id, standing.division]));
        const recalculated = new Map(standings.map(standing => [standing.team_id, {
          wins: 0, losses: 0, ties: 0, pts_for: 0, pts_against: 0, h2h_wins: 0, h2h_losses: 0,
          median_wins: 0, median_losses: 0, div_wins: 0, div_losses: 0, streak: "",
        }]));
        const allSeasonResults = seasonResults ?? [];
        const resultsByWeek = new Map<number, typeof allSeasonResults>();
        for (const result of allSeasonResults) {
          const rows = resultsByWeek.get(result.week) ?? [];
          rows.push(result);
          resultsByWeek.set(result.week, rows);
        }
        const addOutcome = (teamId: string, ownScore: number, opponentScore: number, median: number, divisionGame: boolean) => {
          const row = recalculated.get(teamId);
          if (!row) return;
          row.pts_for += ownScore;
          row.pts_against += opponentScore;
          if (ownScore > opponentScore) {
            row.wins += 1; row.h2h_wins += 1; if (divisionGame) row.div_wins += 1;
            row.streak = row.streak.startsWith("W") ? `W${Number(row.streak.slice(1)) + 1}` : "W1";
          } else if (ownScore < opponentScore) {
            row.losses += 1; row.h2h_losses += 1; if (divisionGame) row.div_losses += 1;
            row.streak = row.streak.startsWith("L") ? `L${Number(row.streak.slice(1)) + 1}` : "L1";
          } else {
            row.ties += 1;
            row.streak = row.streak.startsWith("T") ? `T${Number(row.streak.slice(1)) + 1}` : "T1";
          }
          if (ownScore > median) row.median_wins += 1;
          else row.median_losses += 1;
        };
        Array.from(resultsByWeek.values()).forEach(rows => {
          const scores: number[] = rows.flatMap(row => [Number(row.home_score), Number(row.away_score)]).sort((a: number, b: number) => a - b);
          const middle = Math.floor(scores.length / 2);
          const median = scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2;
          rows.forEach(row => {
            const home = Number(row.home_score);
            const away = Number(row.away_score);
            const divisionGame = divisionByTeam.get(row.home_team_id) === divisionByTeam.get(row.away_team_id);
            addOutcome(row.home_team_id, home, away, median, divisionGame);
            addOutcome(row.away_team_id, away, home, median, divisionGame);
          });
        });
        const updates = await Promise.all(Array.from(recalculated.entries()).map(([teamId, values]) => supabaseAdmin.from("team_standings").update({
          ...values,
          streak: values.streak || "—",
        }).eq("team_id", teamId)));
        if (updates.some(update => update.error)) throw new Error("Result saved, but one or more standings rows could not be updated.");
        const targetWeekRows = resultsByWeek.get(target.week) ?? [];
        const targetScores: number[] = targetWeekRows.flatMap(row => [Number(row.home_score), Number(row.away_score)]).sort((a: number, b: number) => a - b);
        const targetMiddle = Math.floor(targetScores.length / 2);
        const median = targetScores.length % 2 ? targetScores[targetMiddle] : (targetScores[targetMiddle - 1] + targetScores[targetMiddle]) / 2;
        await supabaseAdmin.from("weekly_results").update({ league_median: median }).eq("season", target.season).eq("week", target.week);
        return { saved: true, median };
      }),
    submitManualTransaction: teamProcedure
      .input(z.object({
        targetTeamId: z.string().min(1).max(128),
        addPlayerName: z.string().min(1).max(128),
        addPlayerPos: z.string().min(1).max(8),
        addPlayerNflTeam: z.string().min(1).max(8),
        dropPlayerName: z.string().min(1).max(128),
        faab: z.number().int().min(0).max(10_000),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.teamSession.isCommissioner && input.targetTeamId !== ctx.teamSession.teamId) {
          throw new Error("You may only submit a transaction for your own team.");
        }
        const transactionPlayer = findDraftUniversePlayer({
          name: input.addPlayerName,
          pos: input.addPlayerPos,
          nflTeam: input.addPlayerNflTeam,
        });
        if (!transactionPlayer) throw new Error("This player is not in the validated 2026 WRC player universe.");
        const { data: targetTeam, error: teamError } = await supabaseAdmin.from("teams")
          .select("id, team_name, owner, faab").eq("id", input.targetTeamId).single();
        if (teamError || !targetTeam) throw new Error("The selected team was not found.");
        const balance = Number(targetTeam.faab ?? 0);
        if (input.faab > balance) throw new Error(`FAAB bid exceeds the team’s available balance ($${balance}).`);
        const { data: addPlayer, error: addPlayerError } = await supabaseAdmin.from("players")
          .select("id, team_id").ilike("name", transactionPlayer.name).maybeSingle();
        if (addPlayerError) throw new Error("Unable to verify the added player.");
        if (addPlayer?.team_id) throw new Error("The selected player is already on a WRC roster.");
        const { data: dropPlayer, error: dropPlayerError } = await supabaseAdmin.from("players")
          .select("id").ilike("name", input.dropPlayerName).eq("team_id", targetTeam.id).maybeSingle();
        if (dropPlayerError) throw new Error("Unable to verify the drop player.");
        if (!dropPlayer) throw new Error("The selected drop player is not on this roster.");
        const { error: movesError } = await supabaseAdmin.from("roster_moves").insert([
          {
            move_type: "ADD",
            team_name: targetTeam.team_name,
            owner: targetTeam.owner,
            player_name: transactionPlayer.name,
            player_pos: transactionPlayer.pos,
            player_nfl_team: transactionPlayer.nflTeam,
            faab_spent: input.faab,
          },
          {
            move_type: "DROP",
            team_name: targetTeam.team_name,
            owner: targetTeam.owner,
            player_name: input.dropPlayerName,
            player_pos: "—",
            player_nfl_team: "FA",
            faab_spent: null,
          },
        ]);
        if (movesError) throw new Error("Unable to write the transaction history.");
        if (input.faab > 0) {
          const { error: faabError } = await supabaseAdmin.from("teams")
            .update({ faab: balance - input.faab }).eq("id", targetTeam.id);
          if (faabError) throw new Error("Transaction was recorded, but FAAB could not be deducted.");
        }
        const addResult = addPlayer
          ? await supabaseAdmin.from("players").update({
              team_id: targetTeam.id,
              acquisition: "FA",
              draft_round: null,
              draft_pick: null,
            }).eq("id", addPlayer.id)
          : await supabaseAdmin.from("players").insert({
              team_id: targetTeam.id,
              name: transactionPlayer.name,
              position: transactionPlayer.pos,
              nfl_team: transactionPlayer.nflTeam,
              acquisition: "FA",
              draft_round: null,
              draft_pick: null,
              status: "active",
              season_fpts: 0,
              fpg: 0,
              bye_week: transactionPlayer.bye ?? 0,
              stats: {},
              is_starter: false,
            });
        if (addResult.error) throw new Error("Transaction was recorded, but the added player could not be assigned.");
        const { error: dropAssignmentError } = await supabaseAdmin.from("players")
          .update({ team_id: null, acquisition: "FA", draft_round: null, draft_pick: null })
          .eq("id", dropPlayer.id)
          .eq("team_id", targetTeam.id);
        if (dropAssignmentError) throw new Error("Transaction was recorded, but the dropped player could not be released.");
        return { submitted: true, teamName: targetTeam.team_name, remainingFaab: balance - input.faab };
      }),
    teamSettings: teamProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseAdmin.from("teams")
        .select("logo_url, theme_song_url")
        .eq("id", ctx.teamSession.teamId)
        .single();
      if (error || !data) throw new Error("Unable to load team settings.");
      return { logoUrl: data.logo_url ?? null, themeSongUrl: data.theme_song_url ?? null };
    }),
    publicTeams: publicProcedure.query(async () => {
      const teams = await listPublicLeagueTeams();
      const { data: logos } = await supabaseAdmin.from("teams").select("id, logo_url");
      const logoByTeamId = new Map((logos ?? []).map(row => [row.id, row.logo_url ?? null]));
      return teams.map(team => ({
        id: team.id,
        name: team.name,
        owner: team.owner,
        division: team.division,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        points_for: team.points_for,
        points_against: team.points_against,
        logo_url: logoByTeamId.get(team.id) ?? null,
      }));
    }),
    rosteredPlayers: publicProcedure.query(async () => {
      const { data, error } = await supabaseAdmin.from("players")
        .select("name, team_id, teams(name)")
        .not("team_id", "is", null);
      if (error) throw new Error("Unable to load rostered player data.");
      return (data ?? []).map(row => ({ name: row.name, teamId: row.team_id, teamName: (row.teams as { name?: string | null } | null)?.name ?? null }));
    }),
    playerOwnership: publicProcedure
      .input(z.object({ playerName: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const { data, error } = await supabaseAdmin.from("players")
          .select("team_id, acquisition, draft_round, teams(name, owner)")
          .ilike("name", input.playerName)
          .limit(1)
          .maybeSingle();
        if (error) throw new Error("Unable to load player ownership.");
        return data ? {
          teamId: data.team_id,
          acquisition: data.acquisition,
          draftRound: data.draft_round,
          teamName: (data.teams as { name?: string | null } | null)?.name ?? null,
          owner: (data.teams as { owner?: string | null } | null)?.owner ?? null,
        } : null;
      }),
    commissionerProtectionsOverview: commissionerProcedure.query(async () => {
      const [{ data: teams, error: teamsError }, { data: protections, error: protectionsError }] = await Promise.all([
        supabaseAdmin.from("teams").select("id, name, owner").order("name"),
        supabaseAdmin.from("protections").select("team_id, player_id, tier, forfeited_round, submitted, players(name)"),
      ]);
      if (teamsError || protectionsError) throw new Error("Unable to load protection overview.");
      return { teams: teams ?? [], protections: protections ?? [] };
    }),
    allProtections: publicProcedure.query(async () => {
      const { data, error } = await supabaseAdmin
        .from("protections")
        .select("team_id, player_id, forfeited_round, players(name, position, nfl_team)");
      if (error) throw new Error("Unable to load protections.");
      return data ?? [];
    }),
    commissionerReleaseUnprotectedPlayers: commissionerProcedure.mutation(async () => {
      if (!isProtectionDeadlinePassed()) {
        throw new Error("The protection deadline hasn't passed yet — releasing now would cut protected players before selections lock.");
      }
      return releaseUnprotectedPlayers();
    }),
    changeTeamPin: teamProcedure
      .input(z.object({ currentPin: z.string().min(1).max(12), newPin: z.string().min(6).max(12) }))
      .mutation(async ({ input, ctx }) => {
        const verified = await verifyLeagueTeamPin(ctx.teamSession.teamId, input.currentPin);
        if (!verified) throw new Error("Current PIN is incorrect.");
        assertStrongLeaguePin(input.newPin);
        const { error } = await supabaseAdmin.from("teams").update({ pin: input.newPin, pin_hash: input.newPin }).eq("id", ctx.teamSession.teamId);
        if (error) throw new Error("Unable to save the new PIN.");
        return { updated: true };
      }),
    commissionerTeamDirectory: commissionerProcedure.query(async () => {
      const { data, error } = await supabaseAdmin.from("teams").select("id, name, owner").order("name");
      if (error) throw new Error("Unable to load the team directory.");
      return data ?? [];
    }),
    commissionerSetTeamPin: commissionerProcedure
      .input(z.object({ teamId: z.string().min(1).max(128), newPin: z.string().min(6).max(12) }))
      .mutation(async ({ input }) => {
        assertStrongLeaguePin(input.newPin);
        const { data, error } = await supabaseAdmin.from("teams")
          .update({ pin: input.newPin, pin_hash: input.newPin })
          .eq("id", input.teamId)
          .select("name")
          .single();
        if (error || !data) throw new Error("Unable to reset the selected team PIN.");
        return { updated: true, teamName: data.name };
      }),
    uploadTeamMedia: teamProcedure
      .input(z.object({
        kind: z.enum(["logo", "theme"]),
        fileName: z.string().min(1).max(160),
        contentType: z.string().min(1).max(100),
        base64Data: z.string().min(1).max(14_000_000),
      }))
      .mutation(async ({ input, ctx }) => {
        const mediaRules = input.kind === "logo"
          ? { allowed: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]), maxBytes: 5 * 1024 * 1024, column: "logo_url" as const, folder: "logos" }
          : { allowed: new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/aac", "audio/x-m4a"]), maxBytes: 10 * 1024 * 1024, column: "theme_song_url" as const, folder: "theme-songs" };
        if (!mediaRules.allowed.has(input.contentType)) throw new Error("This file type is not supported.");
        const bytes = Buffer.from(input.base64Data, "base64");
        if (!bytes.length || bytes.length > mediaRules.maxBytes) throw new Error(`File must be under ${mediaRules.maxBytes / (1024 * 1024)}MB.`);
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const { url } = await storagePut(`teams/${ctx.teamSession.teamId}/${mediaRules.folder}/${Date.now()}-${safeName}`, bytes, input.contentType);
        const { error } = await supabaseAdmin.from("teams").update({ [mediaRules.column]: url }).eq("id", ctx.teamSession.teamId);
        if (error) throw new Error("File uploaded, but team settings could not be saved.");
        return { url };
      }),
    removeTeamMedia: teamProcedure
      .input(z.object({ kind: z.enum(["logo", "theme"]) }))
      .mutation(async ({ input, ctx }) => {
        const column = input.kind === "logo" ? "logo_url" : "theme_song_url";
        const { error } = await supabaseAdmin.from("teams").update({ [column]: null }).eq("id", ctx.teamSession.teamId);
        if (error) throw new Error("Unable to remove team media.");
        return { removed: true };
      }),
    finalizeWeeklyResultsFromTank: teamProcedure
      .input(z.object({ week: z.number().int().min(1).max(22), season: z.number().int().min(2020).max(2100) }))
      .mutation(async ({ input }) => finalizeWeeklyResultsFromTank(input.week, input.season)),
    commissionerSaveMoneyOwed: commissionerProcedure
      .input(z.object({ updates: z.array(z.object({ id: z.string().min(1).max(128), name: z.string().min(1).max(80), owed: z.number().finite().min(0).max(100_000) })).min(1).max(50) }))
      .mutation(async ({ input }) => {
        const { error } = await supabaseAdmin.from("money_owed").upsert(input.updates, { onConflict: "id" });
        if (error) throw new Error("Unable to save money owed.");
        return { saved: input.updates.length };
      }),
    commissionerSaveGowEntry: commissionerProcedure
      .input(z.object({ week: z.number().int().min(1).max(22), winner: z.string().min(1).max(80), team: z.string().min(1).max(120), opponent: z.string().max(120), score: z.string().min(1).max(80), amount: z.number().finite().min(0).max(10_000), season: z.number().int().min(2020).max(2100) }))
      .mutation(async ({ input }) => {
        const { error } = await supabaseAdmin.from("gow_history").upsert(input, { onConflict: "week,season" });
        if (error) throw new Error("Unable to save Game of the Week.");
        return { saved: true };
      }),
  }),

  fantasyPros: router({
    news: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional(), fpid: z.number().int().positive().optional(), feedVersion: z.number().int().optional() }).optional())
      .query(async ({ input }) => {
        const news = await getFantasyProsNews(input?.limit ?? 100, input?.fpid);
        if (input?.fpid) return news;
        const rankGroups = await Promise.all(["QB", "RB", "WR", "TE", "K"].map(position => getFantasyProsRanks(position, 1)));
        const current = attachFantasyProsPlayerNames(news, rankGroups.flat());
        const [archived] = await Promise.all([
          getArchivedFantasyProsNews(),
          archiveFantasyProsNews(current).catch(error => console.warn("[FantasyPros archive] Current-feed archive failed:", error)),
        ]);
        return mergeFantasyProsNews(current, archived);
      }),
    rosterNews: publicProcedure
      .input(z.object({
        players: z.array(z.object({ name: z.string().min(1), pos: z.string().optional() })).min(1).max(30),
        feedVersion: z.literal(2).optional(),
      }))
      .query(async ({ input }) => {
        const rosterKeys = new Set(input.players.map(player => normalizePlayerKey(player.name)));
        const positions = Array.from(new Set(input.players.map(player => player.pos).filter((pos): pos is "QB" | "RB" | "WR" | "TE" | "K" | "DST" => ["QB", "RB", "WR", "TE", "K", "DST"].includes(pos ?? ""))));
        const [leagueNews, ...rankGroups] = await Promise.all([
          getFantasyProsNews(100),
          ...positions.map(position => getFantasyProsRanks(position, 1)),
        ]);
        const playerIds = new Map(rankGroups.flat().map(rank => [normalizePlayerKey(rank.name), rank.playerId]));
        const recentLeagueMatches = leagueNews.filter(item => rosterKeys.has(normalizePlayerKey(item.playerName)));
        const rosterPlayersWithIds = input.players.filter(player => playerIds.has(normalizePlayerKey(player.name)));
        const playerSpecificGroups = await mapWithConcurrency(rosterPlayersWithIds, 4, async player => {
          const news = await getFantasyProsNews(6, playerIds.get(normalizePlayerKey(player.name)));
          return news.map(item => ({ ...item, playerName: item.playerName || player.name }));
        });
        const seen = new Set<number | string>();
        return [...recentLeagueMatches, ...playerSpecificGroups.flat()]
          .filter(item => rosterKeys.has(normalizePlayerKey(item.playerName)))
          .filter(item => {
            const key = item.id || `${item.playerName}-${item.title}-${item.published}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());
      }),
    injuries: publicProcedure
      .input(z.object({ year: z.number().int(), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsInjuries(input.year, input.week)),
    ranks: publicProcedure
      .input(z.object({ position: z.enum(["ALL", "QB", "RB", "WR", "TE", "K", "DST", "OP"]), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsRanks(input.position, input.week)),
    projections: publicProcedure
      .input(z.object({ position: z.enum(["QB", "RB", "WR", "TE", "K", "DST", "OP"]), week: z.number().int().min(0).max(18) }))
      .query(({ input }) => getFantasyProsProjections(input.position, input.week)),
  }),
});

export type AppRouter = typeof appRouter;
