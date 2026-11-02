import { formatCount, goal, shareOfGoal } from '../goal';
import { useCountUp } from './useCountUp';

/** The mission's progress bar towards a million, with the count and its share. */
export function GoalProgress() {
  const shown = useCountUp(goal.confirmed);
  const share = (goal.confirmed / goal.target) * 100;
  const width = Math.max(share * (shown / goal.confirmed), 0.8);
  return (
    <>
      <div className="h-[22px] overflow-hidden rounded-md bg-tile">
        <div
          className="h-full bg-red [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)]"
          style={{ width: `${String(width)}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-[15px] leading-none font-semibold text-mute">
        <span>
          <span className="font-word text-lg font-extrabold text-ink tabular-nums">
            {formatCount(shown)}
          </span>{' '}
          з {formatCount(goal.target)}
        </span>
        <span className="font-word text-sm font-extrabold text-red">
          {shareOfGoal(goal.confirmed, goal.target)}
        </span>
      </div>
    </>
  );
}
