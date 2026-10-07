// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RiskRegistry
/// @notice A public, permissionless notice board for risk SIGNALS about addresses.
///
/// A signal is one reporter's opinion ("this address showed patterns scoring N out
/// of 100 for reason R"). It is NOT a verdict, NOT proof of wrongdoing, and nobody
/// (including the author) can edit or remove another reporter's signal. Readers
/// should weigh who reported, how many reporters there are, and the evidence.
///
/// Design rules, kept deliberately small:
///  - one live signal per (reporter, subject): reporting again updates your own
///    signal instead of adding another, so one wallet cannot inflate the count;
///  - a reporter can retract their own signal at any time;
///  - no owner, no admin, no fees, no funds held, no upgrade path.
///
/// Sybil note: anyone can use many wallets, so the reporter count is a hint, not
/// proof. The contract is a demo of a public reputation primitive on Monad Testnet.
contract RiskRegistry {
    /// Reason codes are a shared vocabulary; the contract only bounds-checks them.
    /// 0 other, 1 very new wallet, 2 high-frequency counterparty, 3 single
    /// counterparty, 4 one-way outflow, 5 null-address interaction,
    /// 6 failed or unusual transaction, 7 contract deployment, 8 large transfer.
    uint8 public constant MAX_REASON_CODE = 8;
    uint8 public constant MAX_SCORE = 100;

    struct Signal {
        uint8 score; // 0..100
        uint8 reasonCode; // see above
        uint64 reportedAt; // block timestamp, 0 = no signal
    }

    struct Summary {
        uint32 reporterCount; // reporters with a live signal
        uint64 totalScore; // sum of live scores (average = totalScore / reporterCount)
        uint64 lastReportedAt; // block timestamp of the latest report or update
    }

    mapping(address subject => Summary) private _summaries;
    mapping(address subject => mapping(address reporter => Signal)) private _signals;

    event SignalRecorded(
        address indexed subject,
        address indexed reporter,
        uint8 score,
        uint8 reasonCode,
        uint32 reporterCount
    );
    event SignalRetracted(address indexed subject, address indexed reporter, uint32 reporterCount);

    error InvalidSubject();
    error ScoreTooHigh();
    error UnknownReasonCode();
    error NoSignalToRetract();

    /// @notice Record or update your own signal about `subject`.
    function report(address subject, uint8 score, uint8 reasonCode) external {
        if (subject == address(0) || subject == msg.sender) revert InvalidSubject();
        if (score > MAX_SCORE) revert ScoreTooHigh();
        if (reasonCode > MAX_REASON_CODE) revert UnknownReasonCode();

        Summary storage s = _summaries[subject];
        Signal storage existing = _signals[subject][msg.sender];

        if (existing.reportedAt == 0) {
            s.reporterCount += 1;
        } else {
            s.totalScore -= existing.score;
        }
        s.totalScore += score;
        s.lastReportedAt = uint64(block.timestamp);

        existing.score = score;
        existing.reasonCode = reasonCode;
        existing.reportedAt = uint64(block.timestamp);

        emit SignalRecorded(subject, msg.sender, score, reasonCode, s.reporterCount);
    }

    /// @notice Remove your own signal about `subject`.
    function retract(address subject) external {
        Signal storage existing = _signals[subject][msg.sender];
        if (existing.reportedAt == 0) revert NoSignalToRetract();

        Summary storage s = _summaries[subject];
        s.reporterCount -= 1;
        s.totalScore -= existing.score;
        delete _signals[subject][msg.sender];

        emit SignalRetracted(subject, msg.sender, s.reporterCount);
    }

    /// @notice What the chain knows about `subject`. averageScore is 0 when nobody reported.
    function getSummary(address subject)
        external
        view
        returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)
    {
        Summary storage s = _summaries[subject];
        reporterCount = s.reporterCount;
        averageScore = s.reporterCount == 0 ? 0 : uint8(s.totalScore / s.reporterCount);
        lastReportedAt = s.lastReportedAt;
    }

    /// @notice A single reporter's live signal about `subject` (reportedAt 0 = none).
    function getSignal(address subject, address reporter)
        external
        view
        returns (uint8 score, uint8 reasonCode, uint64 reportedAt)
    {
        Signal storage g = _signals[subject][reporter];
        return (g.score, g.reasonCode, g.reportedAt);
    }
}
