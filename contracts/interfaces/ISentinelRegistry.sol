// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISentinelRegistry
/// @notice The interface of RiskRegistry on Monad Testnet (0xb0C3Be753788a5962DE52db929f49df02700AFd4), for contracts
///         that want to read it. A signal is one reporter's opinion about an address: a score from 0 to 100 and a
///         reason code. It is NOT a verdict, and anyone can use many wallets, so treat the numbers as hints.
interface ISentinelRegistry {
    event SignalRecorded(address indexed subject, address indexed reporter, uint8 score, uint8 reasonCode, uint32 reporterCount);
    event SignalRetracted(address indexed subject, address indexed reporter, uint32 reporterCount);

    /// @return reporterCount distinct reporters with a live signal about `subject`
    /// @return averageScore plain average of their scores (0 when nobody reported)
    /// @return lastReportedAt timestamp of the latest report or update (0 when nobody reported)
    function getSummary(address subject) external view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt);

    /// @return score this reporter's live score about `subject`
    /// @return reasonCode this reporter's reason code (0 other, 1 very new wallet, 2 high-frequency counterparty,
    ///         3 single counterparty, 4 one-way outflow, 5 null-address interaction, 6 failed or unusual transaction,
    ///         7 contract deployment, 8 large transfer)
    /// @return reportedAt timestamp, 0 when this reporter has no live signal
    function getSignal(address subject, address reporter) external view returns (uint8 score, uint8 reasonCode, uint64 reportedAt);

    /// @notice Record or update the caller's own signal about `subject`.
    function report(address subject, uint8 score, uint8 reasonCode) external;

    /// @notice Remove the caller's own signal about `subject`.
    function retract(address subject) external;
}
