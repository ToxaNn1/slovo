import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ContextType,
  type RefObject,
} from 'react';
import {
  Text,
  View,
  type LayoutChangeEvent,
  type TextLayoutEvent,
  type TextProps,
  type ViewProps,
} from 'react-native';

import type { DrawnLine } from './whole-lines-cut';

type HostRef = ComponentRef<typeof View>;

type Report = (id: string, lines?: readonly DrawnLine[]) => void;

/**
 * Where the texts and blocks of clamped content report their lines, by the
 * content's view, and how each hears that the content was laid out again.
 */
const WholeLinesContext = createContext<
  | {
      readonly content: RefObject<HostRef | null>;
      readonly report: Report;
      readonly onRelayout: (remeasure: () => void) => () => void;
    }
  | undefined
>(undefined);

/**
 * The lines drawn in content that may be clamped at whole lines only (ADR
 * 0091), which every `WholeLinesText` and `useWholeBlock` in a
 * `WholeLinesView` given `report` gives, where they are in that view.
 */
export function useDrawnLines() {
  const [byId, setById] = useState<Readonly<Record<string, readonly DrawnLine[]>>>({});
  // Kept the same across renders by hand, not left to the compiler: a text forgets its lines when
  // `report` changes, and reports them again only on its next layout.
  const report = useCallback<Report>((id, drawn) => {
    setById(({ [id]: _gone, ...rest }) => (drawn === undefined ? rest : { ...rest, [id]: drawn }));
  }, []);
  return { lines: Object.values(byId).flat(), report };
}

/**
 * The view of content whose texts and blocks report where their lines are
 * drawn in it. A text reports on its own layout only, and a block on its own
 * size, but they move when something above them changes its height (a
 * `WholeWordsText` that scales its words down after its first pass): each
 * time the content is laid out again, every one of them measures where it is
 * once more, so the cut never reads a line where it was drawn before.
 */
export function WholeLinesView({ report, onLayout, ...props }: ViewProps & { report: Report }) {
  const content = useRef<HostRef>(null);
  const remeasures = useRef(new Set<() => void>());
  const value = useMemo(
    () => ({
      content,
      report,
      onRelayout: (remeasure: () => void) => {
        remeasures.current.add(remeasure);
        return () => {
          remeasures.current.delete(remeasure);
        };
      },
    }),
    [report],
  );
  return (
    <WholeLinesContext.Provider value={value}>
      <View
        {...props}
        ref={content}
        onLayout={(event) => {
          onLayout?.(event);
          for (const remeasure of remeasures.current) remeasure();
        }}
      />
    </WholeLinesContext.Provider>
  );
}

/** A line drawn in one host view, by its top and height in that view. */
interface DrawnRow {
  readonly y: number;
  readonly height: number;
}

/** Reports `lines`, drawn in `view`, by where `view` is in the content now. */
function measureIn(
  context: ContextType<typeof WholeLinesContext>,
  id: string,
  view: HostRef | null,
  lines: readonly DrawnRow[],
) {
  const content = context?.content.current;
  if (content == null || view === null || lines.length === 0) return;
  view.measureLayout(content, (_left, top) => {
    context?.report(
      id,
      lines.map((line) => ({ top: top + line.y, bottom: top + line.y + line.height })),
    );
  });
}

/** Reports lines drawn in one host view, given relative to it, as lines in the content. */
function useReport() {
  const context = useContext(WholeLinesContext);
  const id = useId();
  const ref = useRef<HostRef>(null);
  /** The lines last drawn, relative to the host view, measured again wherever the view now is. */
  const drawn = useRef<readonly DrawnRow[]>([]);
  useEffect(() => {
    const unsubscribe = context?.onRelayout(() => {
      measureIn(context, id, ref.current, drawn.current);
    });
    return () => {
      unsubscribe?.();
      context?.report(id);
    };
  }, [context, id]);
  const report = (lines: readonly DrawnRow[]) => {
    drawn.current = lines;
    measureIn(context, id, ref.current, lines);
  };
  return { ref, report };
}

/** A `Text` whose lines clamped content is cut between, never through (ADR 0091). */
export function WholeLinesText({ onTextLayout, ...props }: TextProps) {
  const { ref, report } = useReport();
  return (
    <Text
      {...props}
      ref={ref}
      onTextLayout={(event: TextLayoutEvent) => {
        onTextLayout?.(event);
        report(event.nativeEvent.lines);
      }}
    />
  );
}

/**
 * A view, such as a chip, that clamped content shows whole or not at all (ADR
 * 0091), with `below` more under it that it draws past its bottom (a shadow).
 */
export function useWholeBlock(below = 0): {
  ref: RefObject<HostRef | null>;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const { ref, report } = useReport();
  return {
    ref,
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      report([{ y: 0, height: nativeEvent.layout.height + below }]);
    },
  };
}
