import { barWidth, formatCount, GOAL, shareOfGoal } from '../goal';
import { useCountUp } from './useCountUp';

/** The mission's count towards a hundred thousand, its bar and its share of the way. */
export function GoalProgress({ count }: { count: number }) {
  const shown = useCountUp(count);
  return (
    <>
      <div className="font-word text-[calc(8vw_+_24px)] leading-[0.95] font-black tracking-[-0.05em] text-red tabular-nums">
        {formatCount(shown)}
      </div>
      <div className="-mt-2 text-[17px] font-semibold">рідкісних слів уже в SLOVO</div>
      <div className="h-5 overflow-hidden rounded-[10px] bg-coal-sunk">
        <div
          className="h-full rounded-[10px] bg-red"
          style={{ width: `${String(barWidth(shown, GOAL))}%` }}
        />
      </div>
      <div className="flex justify-between text-base font-semibold">
        <span className="whitespace-nowrap">{shareOfGoal(count, GOAL)} шляху</span>
        <span className="whitespace-nowrap">{formatCount(GOAL)}</span>
      </div>
    </>
  );
}
