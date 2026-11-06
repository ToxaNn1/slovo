import { EditionProvider, NarratorVoicePicker } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { testStrings } from '../test-strings';
import { coreTokens } from '../tokens';

const strings = testStrings({
  settings: {
    narratorVoice: {
      reading: 'READS · {name}',
      choose: 'CHOOSE A VOICE',
      play: 'Listen',
      pause: 'Stop',
    },
  },
});

const voices = [
  { id: 'anna', name: 'Anna', description: 'Female · calm' },
  { id: 'ben', name: 'Ben', description: 'Male · low' },
];

const sample = {
  word: 'w_0l24ku',
  syllables: ['af', 'ter', 'glow'],
  stressed: 0,
  caption: 'af-ter-glow · n.',
};

function draw(props: Partial<ComponentProps<typeof NarratorVoicePicker>> = {}) {
  return render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <NarratorVoicePicker
        voices={voices}
        chosen="ben"
        sample={sample}
        playing={false}
        onChoose={() => undefined}
        onToggle={() => undefined}
        testID="narrator-voice"
        {...props}
      />
    </EditionProvider>,
  );
}

describe('NarratorVoicePicker', () => {
  it('shows the sample Word read by the chosen voice, named in capitals, over the voices to choose from', async () => {
    await draw();

    expect(screen.getByText('READS · BEN')).toBeOnTheScreen();
    expect(screen.getByText('af')).toBeOnTheScreen();
    expect(screen.getByText('glow')).toBeOnTheScreen();
    expect(screen.getByText('af-ter-glow · n.')).toBeOnTheScreen();
    expect(screen.getByText('CHOOSE A VOICE')).toBeOnTheScreen();
    expect(screen.getByText('Female · calm')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anna' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Ben' })).toBeSelected();
  });

  it("draws the bars in the chosen voice's own height pattern", async () => {
    const heights = () =>
      screen
        .getByTestId('narrator-voice-bars', { includeHiddenElements: true })
        .children.map((bar) => {
          const style = StyleSheet.flatten(
            (bar as { props: { style?: StyleProp<ViewStyle> } }).props.style,
          );
          return style.height;
        });
    const first = await draw({ chosen: 'anna' });
    const anna = heights();
    await first.unmount();
    await draw({ chosen: 'ben' });

    expect(anna).toHaveLength(16);
    expect(heights()).not.toEqual(anna);
  });

  it('chooses the voice of the tile tapped', async () => {
    const onChoose = jest.fn();
    await draw({ onChoose });

    await fireEvent.press(screen.getByRole('button', { name: 'Anna' }));

    expect(onChoose).toHaveBeenCalledWith('anna');
  });

  it('reads the sample on the play button and stops it on the same button while the voice reads', async () => {
    const onToggle = jest.fn();
    const { rerender } = await draw({ onToggle });

    await fireEvent.press(screen.getByRole('button', { name: 'Listen' }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await rerender(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <NarratorVoicePicker
          voices={voices}
          chosen="ben"
          sample={sample}
          playing
          onChoose={() => undefined}
          onToggle={onToggle}
          testID="narrator-voice"
        />
      </EditionProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Listen' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('lights the stressed syllable in the colour on the accent, the others in the ink', async () => {
    await draw();

    const { ink, onAccent } = coreTokens.colors.light;
    expect(screen.getByText('af')).toHaveStyle({ color: onAccent });
    expect(screen.getByText('ter')).toHaveStyle({ color: ink });
    expect(screen.getByText('glow')).toHaveStyle({ color: ink });
  });
});
