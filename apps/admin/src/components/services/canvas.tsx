import type { Service } from '@slovo/contracts/admin-api';

/** A block's size on the canvas, in CSS pixels. */
const BLOCK = { width: 200, height: 88 } as const;
/** The room around the outermost blocks. */
const MARGIN = 40;

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
      className="grid size-7 flex-none place-items-center rounded-md border border-white/15 bg-white/5 font-mono text-[11px] text-white/80"
    >
      &gt;_
    </span>
  );
}

/**
 * The Services on a Railway-like canvas (ADR 0164): each block at its fixed
 * place, and a line for each link, solid for a constant link and dashed for
 * a scheduled run. The black background with white dots is dark in every
 * admin theme: the canvas sets the dark theme for itself.
 */
export function ServicesCanvas({
  services,
  onOpen,
}: {
  readonly services: readonly Service[];
  readonly onOpen: (service: Service) => void;
}) {
  const byId = new Map(services.map((service) => [service.id, service]));
  const width = Math.max(0, ...services.map(({ position }) => position.x)) + BLOCK.width + MARGIN;
  const height = Math.max(0, ...services.map(({ position }) => position.y)) + BLOCK.height + MARGIN;
  return (
    <div
      data-theme="dark"
      className="overflow-auto rounded-[20px] border border-white/10 bg-black bg-[radial-gradient(rgb(255_255_255/0.22)_1px,transparent_1px)] bg-size-[22px_22px] text-white"
    >
      <div
        role="group"
        aria-label="Полотно Сервісів"
        className="relative"
        style={{ width, height }}
      >
        <svg
          role="img"
          aria-label="Зв’язки між Сервісами"
          className="absolute inset-0"
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
                  stroke="rgb(255 255 255 / 0.45)"
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
            onClick={() => {
              onOpen(service);
            }}
            className="absolute flex items-center gap-3 rounded-[14px] border border-white/15 bg-[#13111c] px-4 text-left shadow-[0_8px_24px_rgb(0_0_0/0.5)] hover:border-white/40 focus-visible:outline-2 focus-visible:outline-white"
            style={{
              left: `${String(service.position.x)}px`,
              top: `${String(service.position.y)}px`,
              width: BLOCK.width,
              height: BLOCK.height,
            }}
          >
            <Glyph />
            <span className="text-sm font-semibold leading-tight">{service.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The Services as a list of cards, for a phone: each card opens the same panel. */
export function ServiceCards({
  services,
  onOpen,
}: {
  readonly services: readonly Service[];
  readonly onOpen: (service: Service) => void;
}) {
  return (
    <ul aria-label="Сервіси" className="flex flex-col gap-2">
      {services.map((service) => (
        <li key={service.id}>
          <button
            type="button"
            onClick={() => {
              onOpen(service);
            }}
            className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold">{service.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
