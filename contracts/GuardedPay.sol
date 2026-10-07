// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev The one function of RiskRegistry that GuardedPay reads.
interface IRiskRegistry {
    function getSummary(address subject)
        external
        view
        returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt);
}

/// @title GuardedPay
/// @notice A tiny demo of an on-chain guard: a payment goes through RiskRegistry first.
///
/// `pay` forwards the sent MON to the recipient in the same transaction, after looking at the
/// public signals recorded about that recipient:
///   - Allow:   not enough reporters, or the average score is low. The payment is sent.
///   - Confirm: the average score is at or above `confirmScore`. The payment is sent only if the
///              payer passes `acknowledgeRisk = true`; otherwise it reverts so the payer sees why.
///   - Block:   the average score is at or above `blockScore` from at least `minReportersToBlock`
///              reporters. The payment is refused, even with an acknowledgement.
///
/// Why two reporter minimums: a single anonymous wallet must not be able to stop payments to
/// someone, so one reporter can at most make a payer confirm. Blocking needs several reporters.
/// That is still a heuristic: anyone can use many wallets, and the registry holds opinions, not
/// facts. The guard reads the on-chain plain average; the off-chain reputation weights are not
/// used here.
///
/// No owner, no admin, no custody: the contract keeps no funds and no state. The thresholds are
/// fixed at deployment. Demo only, not audited, testnet only.
contract GuardedPay {
    enum Decision {
        Allow,
        Confirm,
        Block
    }

    IRiskRegistry public immutable registry;
    uint8 public immutable confirmScore;
    uint8 public immutable blockScore;
    uint32 public immutable minReportersToConfirm;
    uint32 public immutable minReportersToBlock;

    event Paid(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        Decision decision,
        uint8 averageScore,
        uint32 reporters
    );

    error InvalidRecipient();
    error NoValue();
    error Blocked(uint8 averageScore, uint32 reporters);
    error ConfirmationRequired(uint8 averageScore, uint32 reporters);
    error TransferFailed();
    error BadSettings();

    constructor(
        address registry_,
        uint8 confirmScore_,
        uint8 blockScore_,
        uint32 minReportersToConfirm_,
        uint32 minReportersToBlock_
    ) {
        if (registry_ == address(0) || confirmScore_ > blockScore_ || blockScore_ > 100 || minReportersToConfirm_ == 0 || minReportersToBlock_ < minReportersToConfirm_) {
            revert BadSettings();
        }
        registry = IRiskRegistry(registry_);
        confirmScore = confirmScore_;
        blockScore = blockScore_;
        minReportersToConfirm = minReportersToConfirm_;
        minReportersToBlock = minReportersToBlock_;
    }

    /// @notice What `pay` would do for `recipient` right now, without sending anything.
    function quote(address recipient)
        public
        view
        returns (Decision decision, uint8 averageScore, uint32 reporters)
    {
        (reporters, averageScore, ) = registry.getSummary(recipient);
        if (reporters >= minReportersToBlock && averageScore >= blockScore) {
            decision = Decision.Block;
        } else if (reporters >= minReportersToConfirm && averageScore >= confirmScore) {
            decision = Decision.Confirm;
        } else {
            decision = Decision.Allow;
        }
    }

    /// @notice Send the attached MON to `recipient` unless the registry says to stop.
    function pay(address payable recipient, bool acknowledgeRisk) external payable {
        if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient();
        if (msg.value == 0) revert NoValue();

        (Decision decision, uint8 averageScore, uint32 reporters) = quote(recipient);
        if (decision == Decision.Block) revert Blocked(averageScore, reporters);
        if (decision == Decision.Confirm && !acknowledgeRisk) revert ConfirmationRequired(averageScore, reporters);

        emit Paid(msg.sender, recipient, msg.value, decision, averageScore, reporters);
        (bool ok, ) = recipient.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
    }
}
