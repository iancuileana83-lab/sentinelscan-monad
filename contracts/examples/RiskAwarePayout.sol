// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISentinelRegistry} from "../interfaces/ISentinelRegistry.sol";
import {ISentinelGuard} from "../interfaces/ISentinelGuard.sol";

/// @title RiskAwarePayout
/// @notice A small example of how ANOTHER contract can build on RiskRegistry and GuardedPay. Two patterns:
///
///  1. `payIfNotFlagged`: your own rule on top of the registry. Here: refuse when at least `minReporters` reporters
///     recorded an average score of `maxAverageScore` or more. You choose the numbers; the registry only supplies data.
///  2. `payThroughGuard`: hand the decision to GuardedPay, which applies its fixed rule on-chain, and forward the
///     payment through it.
///
/// The registry holds opinions of anonymous wallets, not facts: anyone can use many wallets, so a flag is a reason to
/// look closer, not proof. Example code for learning: no owner, no funds kept, not audited, testnet only.
contract RiskAwarePayout {
    ISentinelRegistry public immutable registry;
    ISentinelGuard public immutable guard;
    uint8 public immutable maxAverageScore;
    uint32 public immutable minReporters;

    event PaidByOwnPolicy(address indexed payer, address indexed recipient, uint256 amount, uint8 averageScore, uint32 reporters);
    event PaidThroughGuard(address indexed payer, address indexed recipient, uint256 amount);

    error NoValue();
    error RecipientFlagged(uint8 averageScore, uint32 reporters);
    error TransferFailed();

    constructor(ISentinelRegistry registry_, ISentinelGuard guard_, uint8 maxAverageScore_, uint32 minReporters_) {
        registry = registry_;
        guard = guard_;
        maxAverageScore = maxAverageScore_;
        minReporters = minReporters_;
    }

    /// @notice Your own rule, read from the registry. Useful for allowlists, payroll, marketplaces, airdrops.
    function isFlagged(address who) public view returns (bool flagged, uint8 averageScore, uint32 reporters) {
        (reporters, averageScore, ) = registry.getSummary(who);
        flagged = reporters >= minReporters && averageScore >= maxAverageScore;
    }

    /// @notice Pattern 1: pay `recipient` unless this contract's own policy flags them.
    function payIfNotFlagged(address payable recipient) external payable {
        if (msg.value == 0) revert NoValue();
        (bool flagged, uint8 averageScore, uint32 reporters) = isFlagged(recipient);
        if (flagged) revert RecipientFlagged(averageScore, reporters);

        emit PaidByOwnPolicy(msg.sender, recipient, msg.value, averageScore, reporters);
        (bool ok, ) = recipient.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Pattern 2: let GuardedPay decide. Its errors (Blocked, ConfirmationRequired) bubble up unchanged.
    function payThroughGuard(address payable recipient, bool acknowledgeRisk) external payable {
        guard.pay{value: msg.value}(recipient, acknowledgeRisk);
        emit PaidThroughGuard(msg.sender, recipient, msg.value);
    }
}
