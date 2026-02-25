import { db } from "../db/connection.js";
import { proposals, votes, wallets, configVersions } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { PROTOCOL } from "../config.js";
import { AppError, forbidden, notFound, badRequest } from "../utils/errors.js";
import { getStake } from "./staking.service.js";

export async function createProposal(params: {
  proposerId: string;
  changes: Array<{ key: string; new_value: number }>;
  activationEpoch?: number;
}) {
  const stake = await getStake(params.proposerId);
  if (stake < PROTOCOL.GOVERNANCE.MIN_STAKE_TO_PROPOSE) {
    throw forbidden(`Min stake to propose is ${PROTOCOL.GOVERNANCE.MIN_STAKE_TO_PROPOSE} MEMEX, you have ${stake}`);
  }

  const validKeys = [
    "economy.fees.prices.vectors_store.flat",
    "economy.fees.prices.vectors_search.flat",
    "economy.fees.prices.tasks.flat",
    "economy.staking.min_stake",
  ];
  for (const change of params.changes) {
    if (!validKeys.includes(change.key)) {
      throw badRequest(`Invalid governance parameter: ${change.key}`);
    }
  }

  const proposalId = nanoid();
  await db.insert(proposals).values({
    proposalId,
    proposerId: params.proposerId,
    changes: params.changes,
    activationEpoch: params.activationEpoch ?? 0,
    status: "active",
  });

  return { proposal_id: proposalId, status: "active" };
}

export async function listProposals() {
  const rows = await db.select().from(proposals).orderBy(desc(proposals.createdAt));
  return rows.map((p) => ({
    proposal_id: p.proposalId,
    proposer_id: p.proposerId,
    changes: p.changes,
    status: p.status,
    activation_epoch: p.activationEpoch,
    votes_yes: Number(p.votesYes),
    votes_no: Number(p.votesNo),
  }));
}

export async function vote(proposalId: string, voterId: string, voteChoice: "yes" | "no") {
  const prop = await db.select().from(proposals).where(eq(proposals.proposalId, proposalId)).limit(1);
  if (prop.length === 0) throw notFound("Proposal", proposalId);
  if (prop[0].status !== "active") throw badRequest("Proposal is not active");

  const existingVote = await db.execute(
    sql`SELECT id FROM votes WHERE proposal_id = ${proposalId} AND voter_id = ${voterId} LIMIT 1`,
  );
  if ((existingVote as unknown[]).length > 0) throw badRequest("Already voted on this proposal");

  const stakeWeight = await getStake(voterId);
  if (stakeWeight <= 0) throw forbidden("Must have staked MEMEX to vote");

  const voteId = nanoid();
  await db.insert(votes).values({
    id: voteId,
    proposalId,
    voterId,
    vote: voteChoice,
    stakeWeight: stakeWeight.toString(),
  });

  const weightStr = stakeWeight.toString();
  if (voteChoice === "yes") {
    await db
      .update(proposals)
      .set({ votesYes: sql`${proposals.votesYes} + ${weightStr}::numeric` })
      .where(eq(proposals.proposalId, proposalId));
  } else {
    await db
      .update(proposals)
      .set({ votesNo: sql`${proposals.votesNo} + ${weightStr}::numeric` })
      .where(eq(proposals.proposalId, proposalId));
  }

  return { status: "vote_recorded" };
}

export async function getCurrentConfig() {
  const rows = await db.select().from(configVersions).orderBy(desc(configVersions.version)).limit(2);

  if (rows.length === 0) {
    return {
      current: {
        version: 0,
        effective_epoch: 0,
        fees: {
          vectors_store: PROTOCOL.FEES.VECTORS_STORE,
          vectors_search: PROTOCOL.FEES.VECTORS_SEARCH,
          tasks: PROTOCOL.FEES.TASKS,
        },
        staking: { min_stake: PROTOCOL.STAKING.MIN_STAKE },
      },
      scheduled: null,
    };
  }

  const current = rows[0];
  const scheduled = rows.length > 1 ? rows[1] : null;

  return {
    current: {
      version: current.version,
      effective_epoch: current.effectiveEpoch,
      fees: current.fees,
      staking: current.staking,
    },
    scheduled: scheduled
      ? {
          version: scheduled.version,
          effective_epoch: scheduled.effectiveEpoch,
          fees: scheduled.fees,
          staking: scheduled.staking,
        }
      : null,
  };
}
