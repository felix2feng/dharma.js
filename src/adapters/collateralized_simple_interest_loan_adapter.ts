import * as Web3 from "web3";
import { ContractsAPI } from "src/apis";
import { Assertions } from "src/invariants";
import { BigNumber } from "utils/bignumber";
import * as singleLineString from "single-line-string";

const MAX_COLLATERAL_TOKEN_INDEX_HEX = TermsContractParameters.generateHexValueOfLength(39);
const MAX_COLLATERAL_AMOUNT_HEX = TermsContractParameters.generateHexValueOfLength(62);
const MAX_GRACE_PERIOD_IN_DAYS_HEX = TermsContractParameters.generateHexValueOfLength(64);

export interface CollateralizedTermsContractParameters {
    collateralTokenIndex: BigNumber;
    collateralAmount: BigNumber;
    gracePeriodInDays: BigNumber;
}

export namespace TermsContractParameters {
    export function generateHexValueOfLength(length: number): string {
        return "0x" + "f".repeat(length);
    }

    export function bitShiftLeft(target: BigNumber, numPlaces: number): BigNumber {
        const binaryTargetString = target.toString(2);
        const binaryTargetStringShifted = binaryTargetString + "0".repeat(numPlaces);
        return new BigNumber(binaryTargetStringShifted, 2);
    }
}

export const CollateralizedAdapterErrors = {
    INVALID_TOKEN_INDEX: (tokenIndex: BigNumber) =>
        singleLineString`Token Registry does not track a token at index
                         ${tokenIndex.toString()}.`,
    INVALID_COLLATERAL_AMOUNT_VALUE: () =>
        singleLineString`Collateral amount cannot be negative or greater than 2^92 - 1.`,
    GRACE_PERIOD_IS_NEGATIVE: () => singleLineString`The grace period cannot be negative.`,
    GRACE_PERIOD_EXCEEDS_MAXIMUM: () =>
        singleLineString`The grace period exceeds the maximum value of 2^8 - 1`,
};

export class CollateralizedLoanTerms {
    private assert: Assertions;

    constructor(web3: Web3, contracts: ContractsAPI) {
        this.assert = new Assertions(web3, contracts);
    }

    public packParameters(params: CollateralizedTermsContractParameters): string {
        const { collateralTokenIndex, collateralAmount, gracePeriodInDays } = params;

        this.assertCollateralTokenIndexWithinBounds(collateralTokenIndex);
        this.assertCollateralAmountWithinBounds(collateralAmount);

        const collateralTokenIndexShifted = TermsContractParameters.bitShiftLeft(
            collateralTokenIndex,
            100,
        );
        const collateralAmountShifted = TermsContractParameters.bitShiftLeft(collateralAmount, 8);
        const gracePeriodInDaysShifted = TermsContractParameters.bitShiftLeft(gracePeriodInDays, 0);

        const baseTenParameters = collateralTokenIndexShifted
            .plus(collateralAmountShifted)
            .plus(gracePeriodInDaysShifted);

        return `0x${baseTenParameters.toString(16).padStart(64, "0")}`;
    }

    private assertCollateralTokenIndexWithinBounds(collateralTokenIndex: BigNumber) {
        if (collateralTokenIndex.lt(0) || collateralTokenIndex.gt(MAX_COLLATERAL_TOKEN_INDEX_HEX)) {
            throw new Error(CollateralizedAdapterErrors.INVALID_TOKEN_INDEX(collateralTokenIndex));
        }
    }

    private assertCollateralAmountWithinBounds(collateralAmount: BigNumber) {
        if (collateralAmount.lt(0) || collateralAmount.gt(MAX_COLLATERAL_AMOUNT_HEX)) {
            throw new Error(CollateralizedAdapterErrors.INVALID_COLLATERAL_AMOUNT_VALUE());
        }
    }

    private assertGracePeriodInDaysWithinBounds(gracePeriodInDays: BigNumber) {
        // Grace period can't be negative.
        if (gracePeriodInDays.lt(0)) {
            throw new Error(CollateralizedAdapterErrors.GRACE_PERIOD_IS_NEGATIVE());
        }

        // Grace period has a maximum value that cannot be exceeded due to how we pack params.
        if (gracePeriodInDays.gt(MAX_GRACE_PERIOD_IN_DAYS_HEX)) {
            throw new Error(CollateralizedAdapterErrors.GRACE_PERIOD_EXCEEDS_MAXIMUM());
        }
    }
}
