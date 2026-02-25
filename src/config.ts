import "dotenv/config";

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://memex:memex_dev@localhost:5432/memex",
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ID: process.env.NODE_ID ?? `node-${Date.now()}`,
} as const;

export const PROTOCOL = {
  TOKEN_NAME: "MEMEX",
  TOKEN_SYMBOL: "MEMEX",
  MAX_SUPPLY: 1_000_000_000,

  ALLOCATION: {
    REWARD_POOL: 0.60,
    ECOSYSTEM: 0.25,
    TREASURY: 0.15,
  },

  FEES: {
    VECTORS_STORE: 0.01,
    VECTORS_SEARCH: 0.0001,
    TASKS: 0.01,
  },

  FEE_SPLIT: {
    VALIDATORS: 0.70,
    CONTRIBUTORS: 0.20,
    TREASURY: 0.10,
  },

  STAKING: {
    MIN_STAKE: 10,
    SLASH_MALICIOUS: 0.20,
    SLASH_BAD_SUBMISSION: 0.50,
  },

  GOVERNANCE: {
    MIN_STAKE_TO_PROPOSE: 10,
    QUORUM_RATIO: 0.20,
    PASS_RATIO: 0.67,
    VOTING_PERIOD_EPOCH: 100,
    ACTIVATION_DELAY_EPOCH: 50,
  },

  REWARDS: {
    RELEASE_YEARS: 10,
    VALIDATORS_SHARE: 0.80,
    TREASURY_SHARE: 0.20,
  },

  FAUCET: {
    PER_AGENT_AMOUNT: 1,
  },

  SANDBOX: {
    DEFAULT_TIME_S: 30,
    DEFAULT_MEM_MB: 128,
  },
} as const;
