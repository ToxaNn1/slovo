import Svg, { Path, Polygon } from 'react-native-svg';

/**
 * The design's geometric, slanted icon set (`docs/design/export/SlovoApp.dc.html`),
 * as polygons on a 100 × 100 box: the four tabs, and the controls of the
 * screens' icon buttons.
 */
const shapes = {
  feed: ['0,10 100,0 100,38 0,46 0,56 100,50 100,100 0,100'],
  games: ['50,0 100,50 50,100 0,50 22,50 50,78 78,50 50,22 22,50 0,50'],
  saved: ['12,8 88,0 88,100 50,74 12,100'],
  profile: ['30,0 70,0 74,40 50,48 26,40 30,0 30,0 0,100 8,58 92,54 100,100 0,100'],
  back: ['62.5,8.3 79.2,25 50,50 79.2,75 62.5,91.7 16.7,50'],
  close: ['0,15 15,0 50,35 85,0 100,15 65,50 100,85 85,100 50,65 15,100 0,85 35,50'],
  play: ['10,0 100,50 10,100'],
  favorite: [
    '50,4.2 62.5,37.5 95.8,37.5 70.8,58.3 79.2,95.8 50,75 20.8,95.8 29.2,58.3 4.2,37.5 37.5,37.5',
  ],
  share: [
    '50,0 79.2,26.9 58.3,26.9 58.3,61.5 41.7,61.5 41.7,26.9 20.8,26.9',
    '8.3,46.2 29.2,42.3 29.2,80.8 75,73.1 75,42.3 91.7,38.5 91.7,88.5 8.3,100',
  ],
} as const satisfies Record<string, readonly string[]>;

/** The gear of the settings: an octagon with a slanted hole. */
const settings =
  'M33.3,4.2 L66.7,4.2 L95.8,33.3 L95.8,66.7 L66.7,95.8 L33.3,95.8 L4.2,66.7 L4.2,33.3 Z M41.7,29.2 L66.7,33.3 L70.8,58.3 L50,70.8 L29.2,58.3 L33.3,37.5 Z';

export type IconName = keyof typeof shapes | 'settings';

/** One icon of the set, filled with one colour; VoiceOver skips it. */
export function Icon({ name, color, size }: { name: IconName; color: string; size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {name === 'settings' ? (
        <Path d={settings} fill={color} fillRule="evenodd" />
      ) : (
        shapes[name].map((points) => <Polygon key={points} points={points} fill={color} />)
      )}
    </Svg>
  );
}
