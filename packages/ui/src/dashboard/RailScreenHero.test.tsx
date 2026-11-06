import { EditionProvider, RailScreenHero } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Hero = ComponentProps<typeof RailScreenHero>;

/** Renders the hero with a description unless `withDescription` is false. */
async function renderHero(props: Partial<Hero> = {}, withDescription = true) {
  const back = { label: 'Home', onPress: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
        <RailScreenHero
          id="hero"
          glyph="circle"
          kicker="Category · 4 words"
          title="Gentle words"
          {...(withDescription && { description: 'Words that sound soft.' })}
          progress="Known 1 of 4"
          done={0.25}
          mascot="waits"
          back={back}
          {...props}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return back;
}

describe('RailScreenHero', () => {
  it('shows the kicker, the title as a header, the description and the progress, and goes back', async () => {
    const back = await renderHero();

    expect(screen.getByText('Category · 4 words')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Gentle words' })).toBeTruthy();
    expect(screen.getByTestId('hero-description')).toHaveTextContent('Words that sound soft.');
    expect(screen.getByTestId('hero-progress')).toHaveTextContent('Known 1 of 4');
    expect(screen.queryByTestId('hero-action')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));

    expect(back.onPress).toHaveBeenCalledTimes(1);
  });

  it('draws no description when the screen has none, as a Collection’s', async () => {
    await renderHero({}, false);

    expect(screen.getByRole('header', { name: 'Gentle words' })).toBeTruthy();
    expect(screen.queryByTestId('hero-description')).toBeNull();
  });

  it('draws the add button not yet pressed, and its press adds', async () => {
    const onPress = jest.fn();
    await renderHero({ action: { kind: 'toggle', label: 'Add', on: false, onPress } });

    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).not.toBeSelected();

    await fireEvent.press(add);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws the add button pressed once the copy is kept', async () => {
    await renderHero({
      action: { kind: 'toggle', label: 'In the mix', on: true, onPress: jest.fn() },
    });

    expect(screen.getByRole('button', { name: 'In the mix' })).toBeSelected();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  it('draws the Collection menu button in the right slot, and its press opens the menu', async () => {
    const onPress = jest.fn();
    await renderHero({ action: { kind: 'menu', label: 'Collection menu', onPress } });

    const menu = screen.getByRole('button', { name: 'Collection menu' });
    expect(menu).not.toBeSelected();
    expect(screen.queryByText('Collection menu')).toBeNull();

    await fireEvent.press(menu);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
