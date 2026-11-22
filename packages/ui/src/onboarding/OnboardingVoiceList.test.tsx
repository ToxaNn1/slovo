import { EditionProvider, OnboardingVoiceList } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const voices = [
  { id: 'anna', name: 'Anna', description: 'Calm' },
  { id: 'boris', name: 'Boris', description: 'Low' },
];

async function renderList({ playing = false, silent = false } = {}) {
  const onChoose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <OnboardingVoiceList
          testID="voices"
          voices={voices}
          chosen="boris"
          playing={playing}
          silent={silent}
          syllables={['ho', 'rí', 'zon']}
          rest=" · noun"
          onChoose={onChoose}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return onChoose;
}

describe('OnboardingVoiceList', () => {
  it('shows a row per voice with what it sounds like, the chosen one selected', async () => {
    await renderList();

    expect(screen.getByText('Calm')).toBeTruthy();
    expect(screen.getByText('Low')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Boris' }).props).toMatchObject({
      accessibilityState: { selected: true },
    });
    expect(screen.getByRole('button', { name: 'Anna' }).props).toMatchObject({
      accessibilityState: { selected: false },
    });
    expect(screen.getByTestId('voices-boris-play', { includeHiddenElements: true })).toBeTruthy();
  });

  it('chooses the voice tapped', async () => {
    const onChoose = await renderList();

    await fireEvent.press(screen.getByRole('button', { name: 'Anna' }));

    expect(onChoose).toHaveBeenCalledWith('anna');
  });

  it('shows the sample Word and bars on the chosen row while it reads', async () => {
    await renderList({ playing: true });

    expect(screen.getByText('ho-rí-zon · noun')).toBeTruthy();
    expect(screen.queryByText('Low')).toBeNull();
    expect(screen.getByTestId('voices-boris-bars', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('voices-anna-play', { includeHiddenElements: true })).toBeTruthy();
  });

  it('still chooses a voice while the sample cannot sound', async () => {
    const onChoose = await renderList({ silent: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Anna' }));

    expect(onChoose).toHaveBeenCalledWith('anna');
  });
});
