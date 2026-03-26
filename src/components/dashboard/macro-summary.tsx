interface MacroSummaryProps {
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
}

function MacroItem({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-text-secondary">
        <span className="font-medium" style={{ color, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(consumed)}
        </span>
        <span className="text-text-disabled" style={{ fontVariantNumeric: "tabular-nums" }}>
          /{target}g
        </span>
      </span>
    </div>
  );
}

export function MacroSummary({
  proteinConsumed,
  proteinTarget,
  carbsConsumed,
  carbsTarget,
  fatConsumed,
  fatTarget,
}: MacroSummaryProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <MacroItem label="P" consumed={proteinConsumed} target={proteinTarget} color="#6CB4EE" />
      <MacroItem label="C" consumed={carbsConsumed} target={carbsTarget} color="#FFB347" />
      <MacroItem label="F" consumed={fatConsumed} target={fatTarget} color="#B19CD9" />
    </div>
  );
}
