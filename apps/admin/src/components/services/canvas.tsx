import { SERVICE_BLOCK, type Service } from '@slovo/contracts/admin-api';
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { BlockUsage, nearLimitOf, type UsageAnswer } from './usage';

/** Each Service's usage read, by the Service's id. */
export type UsageById = ReadonlyMap<string, UsageAnswer>;

/** A block's size on the canvas, in CSS pixels: the backend places a new Service by it. */
const BLOCK = SERVICE_BLOCK;
/** The room around the outermost blocks. */
const MARGIN = 40;

/** The canvas zooms between these scales, a step at a time, as Railway's does. */
const ZOOM = { min: 0.3, max: 2, step: 0.1 } as const;
/** The room kept under the canvas: its frame reaches down to the window's bottom less this. */
const FIT_BOTTOM = 40;
/** The frame's least height, so a short window still shows the canvas. */
const MIN_HEIGHT = 420;
/** The dots' spacing at 100 %. */
const DOTS = 22;

/** Where the canvas is seen from: its scale and its shift in the frame, in CSS pixels. */
interface View {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** The scale kept within the zoom's range, on its 1 % grid so the steps stay even. */
const zoomOf = (scale: number) =>
  Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(scale * 100) / 100));

/** The view at another scale, the frame's point `at` staying where it is under the pointer. */
function zoomAt(view: View, scale: number, at: { x: number; y: number }): View {
  const next = zoomOf(scale);
  const by = next / view.scale;
  return { scale: next, x: at.x - (at.x - view.x) * by, y: at.y - (at.y - view.y) * by };
}

/** The frame's height: down to the window's bottom, never below the least one. */
function heightOf(frame: HTMLElement): number {
  return Math.max(MIN_HEIGHT, window.innerHeight - frame.getBoundingClientRect().top - FIT_BOTTOM);
}

/**
 * The view that fits the whole canvas in the frame, centred, never above
 * 100 %. A frame with no size yet (not laid out) sees it at 100 % from its
 * corner.
 */
function fitOf(frame: HTMLElement, width: number, height: number): View {
  const box = frame.getBoundingClientRect();
  if (box.width === 0) return { scale: 1, x: 0, y: 0 };
  const scale = zoomOf(Math.min(1, box.width / width, box.height / height));
  return {
    scale,
    x: Math.round((box.width - width * scale) / 2),
    y: Math.round((box.height - height * scale) / 2),
  };
}

/** Where a line between blocks starts and ends: the middle of each block. */
const middleOf = ({ position }: Service) => ({
  x: position.x + BLOCK.width / 2,
  y: position.y + BLOCK.height / 2,
});

/** The block's glyph: a terminal prompt, as on Railway's canvas. */
function Glyph() {
  return (
    <span
      aria-hidden
      className="grid size-7 flex-none place-items-center rounded-md border border-border bg-muted font-mono text-[11px] text-muted-foreground dark:border-white/15 dark:bg-white/5 dark:text-white/80"
    >
      &gt;_
    </span>
  );
}

/**
 * The Services on a Railway-like canvas (ADR 0164): each block at its fixed
 * place, and a line for each link, solid for a constant link and dashed for
 * a scheduled run. It follows the admin's Theme (ADR 0171): white with black
 * dots in the light one, black with white dots in the dark one. It zooms,
 * opens fitted to the window and moves anywhere by dragging its empty room
 * or with the wheel.
 */
export function ServicesCanvas({
  services,
  usage,
  onOpen,
}: {
  readonly services: readonly Service[];
  readonly usage: UsageById;
  readonly onOpen: (service: Service) => void;
}) {
  const byId = new Map(services.map((service) => [service.id, service]));
  const width = Math.max(0, ...services.map(({ position }) => position.x)) + BLOCK.width + MARGIN;
  const height = Math.max(0, ...services.map(({ position }) => position.y)) + BLOCK.height + MARGIN;
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [frameHeight, setFrameHeight] = useState(MIN_HEIGHT);
  const fit = () => {
    if (frame.current !== null) setView(fitOf(frame.current, width, height));
  };
  // The frame reaches down to the window's bottom, and the canvas opens fitted to it.
  useLayoutEffect(() => {
    if (frame.current !== null) setFrameHeight(heightOf(frame.current));
  }, []);
  useLayoutEffect(fit, [width, height, frameHeight]);
  // The wheel or two fingers on a trackpad move the canvas; with Ctrl or ⌘,
  // or a trackpad's pinch, they zoom it under the pointer. Never the page.
  useEffect(() => {
    const element = frame.current;
    if (element === null) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const box = element.getBoundingClientRect();
        const at = { x: event.clientX - box.left, y: event.clientY - box.top };
        setView((current) => zoomAt(current, current.scale * Math.exp(-event.deltaY / 300), at));
      } else {
        setView((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }));
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, []);
  /**
   * A press on the canvas's empty room drags it, as on Railway, anywhere,
   * until it is let go. A press on a block, or with any button but the main
   * one, leaves it to the block.
   */
  const panFrom = (event: ReactPointerEvent<HTMLElement>) => {
    const onBlock = event.target instanceof Element && event.target.closest('button') !== null;
    if (event.button !== 0 || onBlock) return;
    const start = { x: event.clientX - view.x, y: event.clientY - view.y };
    const onMove = (move: PointerEvent) => {
      setView((current) => ({ ...current, x: move.clientX - start.x, y: move.clientY - start.y }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  /** The frame's middle, where the bar's buttons zoom around. */
  const middle = () => {
    const box = frame.current?.getBoundingClientRect();
    return { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
  };
  const { scale, x, y } = view;
  return (
    <div
      className="relative overflow-hidden rounded-[20px] border border-border bg-white bg-[radial-gradient(rgb(0_0_0/0.22)_1px,transparent_1px)] bg-size-[22px_22px] text-foreground dark:border-white/10 dark:bg-black dark:bg-[radial-gradient(rgb(255_255_255/0.22)_1px,transparent_1px)] dark:text-white"
      style={{
        backgroundSize: `${String(DOTS * scale)}px ${String(DOTS * scale)}px`,
        backgroundPosition: `${String(x)}px ${String(y)}px`,
      }}
    >
      <ZoomBar
        scale={scale}
        onZoom={(by) => {
          setView((current) => zoomAt(current, current.scale + by, middle()));
        }}
        onFit={fit}
      />
      <div
        ref={frame}
        className="relative cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
        style={{ height: frameHeight }}
        onPointerDown={panFrom}
      >
        <div
          role="group"
          aria-label="Полотно Сервісів"
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width,
            height,
            transform: `translate(${String(x)}px, ${String(y)}px) scale(${String(scale)})`,
          }}
        >
          <svg
            role="img"
            aria-label="Зв’язки між Сервісами"
            className="absolute inset-0 text-black/40 dark:text-white/45"
            width={width}
            height={height}
          >
            {services.flatMap((from) =>
              from.links.flatMap((link) => {
                const to = byId.get(link.to);
                if (to === undefined) return [];
                const start = middleOf(from);
                const end = middleOf(to);
                return [
                  <line
                    key={`${from.id}-${to.id}`}
                    aria-label={`${from.name} → ${to.name}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    {...(link.kind === 'scheduled' ? { strokeDasharray: '6 6' } : {})}
                  />,
                ];
              }),
            )}
          </svg>
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              aria-label={service.name}
              {...usageDescription(service, usage)}
              onClick={() => {
                onOpen(service);
              }}
              className={`absolute flex items-center gap-3 rounded-[14px] border ${nearLimitOf(usage.get(service.id)) ? 'border-warn' : 'border-border dark:border-white/15'} cursor-pointer bg-surface px-4 text-left shadow-[0_8px_24px_rgb(0_0_0/0.08)] hover:border-border-strong focus-visible:outline-2 focus-visible:outline-foreground dark:bg-[#13111c] dark:shadow-[0_8px_24px_rgb(0_0_0/0.5)] dark:hover:border-white/40 dark:focus-visible:outline-white`}
              style={{
                left: `${String(service.position.x)}px`,
                top: `${String(service.position.y)}px`,
                width: BLOCK.width,
                height: BLOCK.height,
              }}
            >
              <Glyph />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-semibold leading-tight">{service.name}</span>
                <UsageOf service={service} usage={usage} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The zoom of the canvas: smaller, the scale, larger and «Вмістити», in its bottom left corner, as on Railway. */
function ZoomBar({
  scale,
  onZoom,
  onFit,
}: {
  readonly scale: number;
  readonly onZoom: (by: number) => void;
  readonly onFit: () => void;
}) {
  const button =
    'grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-40 dark:hover:bg-white/10 dark:focus-visible:outline-white';
  return (
    <div
      role="toolbar"
      aria-label="Масштаб полотна"
      className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-[0_8px_24px_rgb(0_0_0/0.08)] dark:border-white/15 dark:bg-[#13111c] dark:shadow-[0_8px_24px_rgb(0_0_0/0.5)]"
    >
      <button
        type="button"
        aria-label="Зменшити"
        className={button}
        disabled={scale <= ZOOM.min}
        onClick={() => {
          onZoom(-ZOOM.step);
        }}
      >
        −
      </button>
      <span className="min-w-12 text-center font-mono text-xs tabular-nums">{`${String(Math.round(scale * 100))} %`}</span>
      <button
        type="button"
        aria-label="Збільшити"
        className={button}
        disabled={scale >= ZOOM.max}
        onClick={() => {
          onZoom(ZOOM.step);
        }}
      >
        +
      </button>
      <button type="button" className={`${button} text-xs`} onClick={onFit}>
        Вмістити
      </button>
    </div>
  );
}

/** The Services as a list of cards, for a phone: each card opens the same panel. */
export function ServiceCards({
  services,
  usage,
  onOpen,
}: {
  readonly services: readonly Service[];
  readonly usage: UsageById;
  readonly onOpen: (service: Service) => void;
}) {
  return (
    <ul aria-label="Сервіси" className="flex flex-col gap-2">
      {services.map((service) => (
        <li key={service.id}>
          <button
            type="button"
            aria-label={service.name}
            {...usageDescription(service, usage)}
            onClick={() => {
              onOpen(service);
            }}
            className={`flex w-full items-center gap-3 rounded-[14px] border ${nearLimitOf(usage.get(service.id)) ? 'border-warn' : 'border-border'} bg-surface px-4 py-3 text-left`}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold">{service.name}</span>
              <UsageOf service={service} usage={usage} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The id of a block's usage, which describes its button. */
const usageIdOf = (service: Service) => `usage-${service.id}`;

/** The block's button is described by its usage, when the Service has one. */
function usageDescription(service: Service, usage: UsageById) {
  return usage.has(service.id) ? { 'aria-describedby': usageIdOf(service) } : {};
}

/** A block's usage bar, when its Service's usage is read. */
function UsageOf({ service, usage }: { readonly service: Service; readonly usage: UsageById }) {
  const read = usage.get(service.id);
  return read === undefined ? null : <BlockUsage id={usageIdOf(service)} read={read} />;
}
