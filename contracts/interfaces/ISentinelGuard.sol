// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISentinelGuard
/// @notice The interface of GuardedPay on Monad Testnet (0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD): a payment that
///         is forwarded only after the public registry has been consulted. Thresholds are fixed at deployment
///         (confirm from an average of 40, refuse from 70 with at least 2 reporters).
interface ISentinelGuard {
    enum Decision {
        Allow,
        Confirm,
        Block
    }

    error InvalidRecipient();
    error NoValue();
    error Blocked(uint8 averageScore, uint32 reporters);
    error ConfirmationRequired(uint8 averageScore, uint32 reporters);
    error TransferFailed();

    /// @notice What `pay` would do for `recipient` right now. Sends nothing.
    function quote(address recipient) external view returns (Decision decision, uint8 averageScore, uint32 reporters);

    /// @notice Forward `msg.value` to `recipient` unless the registry says to stop. A Confirm decision reverts unless
    ///         `acknowledgeRisk` is true; a Block decision always reverts.
    function pay(address payable recipient, bool acknowledgeRisk) external payable;
}
