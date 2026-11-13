import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { EditionProvider } from '@slovo/ui';
import { CardTabs } from './CardTabs';
import { testStrings } from '../test-strings';
import { entryCardFrame, typeRoles } from '../tokens';

type Key = 'essence' | 'example' | 'history';
const tabs: readonly [{ readonly key: Key }, ...{ readonly key: Key }[]] = [
  { key: 'essence' },
  { key: 'example' },
  { key: 'history' },
];
const names: Record<Key, string> = {
  essence: 'Essence',
  example: 'Example',
  history: 'Word history',
};

async function renderTabs(sources?: readonly string[]) {
  // The opened tab scrolls in a gesture-handler scroll view, which needs the app's gesture root.
  await render(
    <GestureHandlerRootView>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({
          wordCard: { tabMore: 'More', tabLess: 'Less', tabSource: 'Source' },
        })}
      >
        <CardTabs testID="word" tabs={tabs} nameOf={(tab) => names[tab.key]} sources={sources}>
          {(tab) => <Text>{names[tab.key]} content</Text>}
        </CardTabs>
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

const label = (name: string) => screen.getByText(name, { exact: true });

describe("an Entry card's tab bar (board XEntry2)", () => {
  it('sets the tabs as a grid of equal columns, their names centred, under a 2 px line', async () => {
    await renderTabs();

    // The tab bar is the tabs' parent, the `tablist`.
    const tablist = screen.getByTestId('word-tab-essence').parent;
    expect(tablist).toHaveProp('accessibilityRole', 'tablist');
    expect(tablist).toHaveStyle({
      flexDirection: 'row',
      borderTopWidth: entryCardFrame.tabBar.line,
    });
    for (const { key } of tabs)
      expect(screen.getByTestId(`word-tab-${key}`)).toHaveStyle({
        flex: 1,
        height: entryCardFrame.tabBar.height,
        alignItems: 'center',
        justifyContent: 'center',
      });
    expect(label('Word history')).toHaveStyle({ textAlign: 'center' });
    expect(screen.getByTestId('word-tab-content')).toHaveStyle({ gap: entryCardFrame.panelGap });
    expect(entryCardFrame.panelGap).toBe(14);
  });

  it('names the selected tab in the heavier role in ink and the others in the lighter one', async () => {
    await renderTabs();

    expect(label('Essence')).toHaveStyle({
      fontSize: typeRoles.cardTabSelected.size,
      fontWeight: typeRoles.cardTabSelected.weight,
    });
    expect(label('Example')).toHaveStyle({
      fontSize: typeRoles.cardTab.size,
      fontWeight: typeRoles.cardTab.weight,
    });

    await fireEvent.press(screen.getByTestId('word-tab-example'));
    expect(label('Example')).toHaveStyle({ fontWeight: typeRoles.cardTabSelected.weight });
    expect(label('Essence')).toHaveStyle({ fontWeight: typeRoles.cardTab.weight });
  });

  it('marks the selected tab with the red bar from 18 % to 82 % of its column, over the line', async () => {
    await renderTabs();

    expect(screen.getByTestId('word-tab-essence-bar')).toHaveStyle({
      position: 'absolute',
      top: entryCardFrame.tabMark.top,
      left: entryCardFrame.tabMark.inset,
      right: entryCardFrame.tabMark.inset,
    });
    expect(entryCardFrame.tabMark).toMatchObject({ top: -2, inset: '18%' });
    expect(screen.queryByTestId('word-tab-example-bar')).toBeNull();
  });
});

describe("an Entry card's clamped tab (owner 13.11)", () => {
  it('puts the More link in the room right under the clip, its touch target in hitSlop', async () => {
    await renderTabs();
    const layout = async (testID: string, height: number) => {
      await fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
    };
    await layout('word-tab-panel', 200);
    // Too tall at every size down to the floor, so the tab is clamped.
    for (let size = 0; size < 4 && screen.queryByTestId('word-tab-more') === null; size++)
      await layout('word-tab-content', 2000);
    await layout('word-tab-more', 16);

    const panel = screen.getByTestId('word-tab-panel');
    const clip = screen.getByTestId('word-tab-clip');
    const more = screen.getByTestId('word-tab-more');
    // The clip and the link under it with a little air, in the room; with no line reported the
    // clip takes what the link and the air leave (owner 13.11).
    expect(clip.parent).toBe(panel);
    expect(more.parent).toBe(panel);
    expect(clip).toHaveStyle({ overflow: 'hidden', height: 200 - 16 - entryCardFrame.moreGap });
    expect(more).toHaveStyle({ marginTop: entryCardFrame.moreGap });
    expect(more).not.toHaveStyle({ minHeight: 44 });
    expect(more).toHaveProp('hitSlop', { top: 14, bottom: 14 });
  });

  it('opens into a scroll that fills the room down to the Less link, where the More link was (owner 13.11)', async () => {
    await renderTabs();
    const layout = async (testID: string, height: number) => {
      await fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
    };
    await layout('word-tab-panel', 200);
    for (let size = 0; size < 4 && screen.queryByTestId('word-tab-more') === null; size++)
      await layout('word-tab-content', 2000);
    await layout('word-tab-more', 16);
    await fireEvent.press(screen.getByTestId('word-tab-more'));

    const panel = screen.getByTestId('word-tab-panel');
    const scroll = screen.getByTestId('word-tab-scroll');
    const less = screen.getByTestId('word-tab-less');
    // The Less link sits in the room under the scroll, as the More link did, so the room keeps its
    // height and the scroll (a scroll view grows and shrinks to fill its column) takes all of
    // it but the link's line and the same little air.
    expect(less.parent).toBe(panel);
    expect(panel.children.at(-1)).toBe(less);
    expect(within(panel).getByTestId('word-tab-scroll')).toBe(scroll);
    expect(less).toHaveStyle({ marginTop: entryCardFrame.moreGap });
    expect(less).not.toHaveStyle({ minHeight: 44 });
    expect(less).toHaveProp('hitSlop', { top: 14, bottom: 14 });
  });
});

describe("an Entry card's Source tab (ADR 0116)", () => {
  it('comes last and names each source on its own line, with no prefix', async () => {
    await renderTabs(['A dictionary', 'A style guide']);

    const tablist = screen.getByTestId('word-tab-essence').parent;
    const last = tablist?.children.at(-1);
    expect(last).toBe(screen.getByTestId('word-tab-source'));
    expect(screen.getByTestId('word-tab-source')).toHaveProp('accessibilityLabel', 'Source');

    await fireEvent.press(screen.getByTestId('word-tab-source'));

    expect(screen.queryByText('Essence content')).toBeNull();
    expect(screen.getByTestId('word-source-0')).toHaveTextContent('A dictionary', { exact: true });
    expect(screen.getByTestId('word-source-1')).toHaveTextContent('A style guide', { exact: true });
  });

  it('is not there without sources', async () => {
    await renderTabs([]);
    expect(screen.queryByTestId('word-tab-source')).toBeNull();
  });

  it('is not there when the card is given no sources (the switch is off)', async () => {
    await renderTabs();
    expect(screen.queryByTestId('word-tab-source')).toBeNull();
  });

  it('gives a card of one tab a tab bar of two', async () => {
    await render(
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({ wordCard: { tabSource: 'Source' } })}
      >
        <CardTabs
          testID="tip"
          tabs={[{ key: 'rule' }]}
          nameOf={() => 'Rule'}
          sources={['A dictionary']}
        >
          {() => <Text>Rule content</Text>}
        </CardTabs>
      </EditionProvider>,
    );
    expect(screen.getByTestId('tip-tab-rule')).toBeOnTheScreen();
    expect(screen.getByTestId('tip-tab-source')).toBeOnTheScreen();
  });
});
