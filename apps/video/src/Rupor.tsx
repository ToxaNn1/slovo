import decor from '../../../editions/uk/decor/decor.json';
import { dark, light } from './look';

type Shape = { path: string; fill?: string; stroke?: string; width?: number; opacity?: number };
type State = keyof typeof decor.mascot.eyes;

const mascot = decor.mascot;

/**
 * The Mascot Рупор drawn from the Edition's vector, as the app draws it:
 * red body and black ink on cream, cream body and black ink on red,
 * red body and cream ink on the dark ground.
 */
export function Rupor({
  state,
  width,
  ground = 'cream',
}: {
  state: State;
  width: number;
  ground?: 'cream' | 'red' | 'dark';
}) {
  const paints = {
    cream: { body: light.accent, ink: light.ink, accent: light.accent },
    red: { body: light.background, ink: light.ink, accent: light.ink },
    dark: { body: dark.accent, ink: dark.ink, accent: dark.accent },
  }[ground];
  const paint = (role: string) => (role in paints ? paints[role as keyof typeof paints] : role);
  const shapes = (list: readonly Shape[]) =>
    list.map((shape, index) =>
      shape.fill !== undefined ? (
        <path key={index} d={shape.path} fill={paint(shape.fill)} opacity={shape.opacity ?? 1} />
      ) : (
        <path
          key={index}
          d={shape.path}
          fill="none"
          stroke={paint(shape.stroke ?? 'ink')}
          strokeWidth={shape.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={shape.opacity ?? 1}
        />
      ),
    );
  return (
    <svg
      width={width}
      height={(width * mascot.height) / mascot.width}
      viewBox={`0 0 ${mascot.width} ${mascot.height}`}
      style={{ overflow: 'visible' }}
    >
      {(state === 'shouts' || state === 'celebrates') && shapes(mascot.rays)}
      {shapes(mascot.figure)}
      {shapes(mascot.shine)}
      {shapes(mascot.eyes[state])}
      {shapes(mascot.hat)}
      {state === 'celebrates' && shapes(mascot.confetti)}
    </svg>
  );
}
