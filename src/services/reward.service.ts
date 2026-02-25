import { PROTOCOL } from "../config.js";

const TOTAL_REWARD_POOL = PROTOCOL.MAX_SUPPLY * PROTOCOL.ALLOCATION.REWARD_POOL;
const ANNUAL_RELEASE = TOTAL_REWARD_POOL / PROTOCOL.REWARDS.RELEASE_YEARS;

export function calculateEpochReward(epochNumber: number, epochsPerYear: number): {
  validatorsReward: number;
  treasuryReward: number;
} {
  const perEpochRelease = ANNUAL_RELEASE / epochsPerYear;
  return {
    validatorsReward: perEpochRelease * PROTOCOL.REWARDS.VALIDATORS_SHARE,
    treasuryReward: perEpochRelease * PROTOCOL.REWARDS.TREASURY_SHARE,
  };
}

export function calculateFeeSplit(feeAmount: number): {
  validatorShare: number;
  contributorShare: number;
  treasuryShare: number;
} {
  return {
    validatorShare: feeAmount * PROTOCOL.FEE_SPLIT.VALIDATORS,
    contributorShare: feeAmount * PROTOCOL.FEE_SPLIT.CONTRIBUTORS,
    treasuryShare: feeAmount * PROTOCOL.FEE_SPLIT.TREASURY,
  };
}
