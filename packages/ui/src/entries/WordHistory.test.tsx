import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EditionProvider } from '@slovo/ui';
import { CardTabs } from './CardTabs';
import { WordHistory } from './WordCard';
import { testStrings } from '../test-strings';

const tabs = [{ key: 'essence' }] as const;

/** An Essence tab that holds only the Word History. */
async function renderTab(onShown: () => void) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({
          wordCard: { history: 'History', tabMore: 'More', tabLess: 'Less' },
        })}
      >
        <CardTabs testID="word" tabs={tabs} nameOf={() => 'Essence'}>
          {() => <WordHistory history="It left the language." onShown={onShown} />}
        </CardTabs>
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

const layout = async (testID: string, height: number, y = 0) => {
  await fireEvent(screen.getByTestId(testID), 'layout', {
    nativeEvent: { layout: { x: 0, y, width: 358, height } },
  });
};

/** Draws the tab too tall for its room at every size, so it is clamped above `cut`. */
const clamp = async () => {
  await layout('word-tab-panel', 200);
  for (let size = 0; size < 4 && screen.queryByTestId('word-tab-more') === null; size++)
    await layout('word-tab-content', 2000);
  await layout('word-tab-more', 16);
};

describe('the Word History counted as opened (owner 20.11: when the reader sees it)', () => {
  it('counts it once the tab that holds it fits its room on screen', async () => {
    const onShown = jest.fn();
    await renderTab(onShown);
    expect(onShown).not.toHaveBeenCalled();

    await layout('word-tab-panel', 400);
    await layout('word-tab-content', 300);
    await layout('word-history', 60, 100);

    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('counts it in a clamped tab only once a scroll brings it into view', async () => {
    const onShown = jest.fn();
    await renderTab(onShown);
    await clamp();
    await layout('word-history', 60, 1500);
    expect(onShown).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('word-tab-more'));
    await layout('word-history', 60, 1500);
    await fireEvent(screen.getByTestId('word-tab-scroll'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 170 } },
    });
    expect(onShown).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId('word-tab-scroll'), 'scrollEndDrag', {
      nativeEvent: {
        contentOffset: { x: 0, y: 1400 },
        layoutMeasurement: { width: 358, height: 170 },
        contentSize: { width: 358, height: 2000 },
      },
    });
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('counts it in a clamped tab where it sits above the cut', async () => {
    const onShown = jest.fn();
    await renderTab(onShown);
    await clamp();
    await layout('word-history', 60, 20);

    expect(onShown).toHaveBeenCalledTimes(1);
  });
});
