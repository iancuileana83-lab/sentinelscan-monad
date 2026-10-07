import { useState, useEffect } from 'react';
import {
  Sparkles,
  Loader2,
  FileSearch,
  Brain,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import type { RiskExplanation } from '@/lib/riskExplainer';

interface RiskExplainerProps {
  explanation: RiskExplanation;
  type: 'wallet' | 'transaction';
}

export default function RiskExplainer({ explanation, type }: RiskExplainerProps) {
  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);

  useEffect(() => {
    setAnalyzing(true);
    const timer = setTimeout(() => setAnalyzing(false), 1400);
    return () => clearTimeout(timer);
  }, [explanation]);

  return (
    <div className="rounded-2xl border border-line bg-card2/30 overflow-hidden">
      {/* Header button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-card2/50 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand-ink">
            <Sparkles size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-ink">
              Risk explanation
            </h3>
            <p className="text-xs text-faint">
              Plain-language summary of {type} risk findings
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-muted" />
        ) : (
          <ChevronDown size={20} className="text-muted" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {analyzing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative w-12 h-12 mb-3">
                <div className="absolute inset-0 rounded-full border-4 border-line" />
                <div className="absolute inset-0 rounded-full border-4 border-brand border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-ink2 font-medium">
                Analyzing on-chain findings...
              </p>
              <p className="text-xs text-faint mt-1">
                Generating plain-language risk explanation
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="p-4 bg-card2/50 border border-line rounded-xl">
                <p className="text-sm text-ink leading-relaxed">
                  {explanation.summary}
                </p>
              </div>

              {/* Detected evidence */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileSearch size={16} className="text-brand-ink" />
                  <h4 className="text-sm font-semibold text-ink">
                    Detected On-Chain Evidence
                  </h4>
                  <span className="text-xs text-faint bg-card2/40 px-2 py-0.5 rounded-full">
                    {explanation.detectedEvidence.length} items
                  </span>
                </div>
                <div className="space-y-2">
                  {explanation.detectedEvidence.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-card2/40 border border-line rounded-lg"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-brand mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-brand-ink">
                          {item.label}
                        </span>
                        <p className="text-sm text-ink2 mt-0.5">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk interpretation */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-brand-ink" />
                  <h4 className="text-sm font-semibold text-ink">
                    Risk Interpretation
                  </h4>
                  <span className="text-xs text-faint bg-card2/40 px-2 py-0.5 rounded-full">
                    Generated analysis
                  </span>
                </div>
                <div className="space-y-2">
                  {explanation.interpretation.map((para, i) => (
                    <p
                      key={i}
                      className="text-sm text-muted leading-relaxed p-3 bg-card2/60 border border-line rounded-lg"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="flex items-start gap-3 p-4 bg-warn/5 border border-warn/20 rounded-xl">
                <Lightbulb
                  size={18}
                  className="flex-shrink-0 text-warn mt-0.5"
                />
                <div>
                  <h4 className="text-sm font-semibold text-warn mb-1">
                    Recommendation
                  </h4>
                  <p className="text-sm text-ink2 leading-relaxed">
                    {explanation.recommendation}
                  </p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2.5 px-1">
                <ShieldCheck
                  size={14}
                  className="flex-shrink-0 text-faint mt-0.5"
                />
                <p className="text-xs text-faint leading-relaxed">
                  The "Detected On-Chain Evidence" section lists facts directly
                  retrieved from the blockchain. The "Risk Interpretation" section
                  is generated analysis of those facts — it describes risk
                  likelihood and patterns, not definitive proof of fraud. Always
                  conduct additional due diligence for high-value decisions.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
