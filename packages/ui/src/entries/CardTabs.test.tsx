import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useEffect, type ComponentRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { EditionProvider, FontSizeProvider } from '@slovo/ui';
import { CardGroundContext, CardTabs } from './CardTabs';
import { useWholeBlock, WholeLinesText } from '../primitives/WholeLines';
import { useWordTextSizes } from '../providers/FontSizeProvider';
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
          wordCard: {
            tabMore: 'More',
            tabLess: 'Less',
            tabSource: 'Source',
            ownSource: 'Our own editing',
          },
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
  it('gives every pair of names the same air, never under the least, their names centred, under a 2 px line (check 15.11)', async () => {
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
        // Each column is its name and an equal share of the room left, so the air between
        // names is the same; a long name shrinks its column, and the padding stays between.
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        paddingHorizontal: entryCardFrame.tabBar.nameGap / 2,
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

describe("an Entry card's tab content", () => {
  it('draws only the selected tab on opening, so a Feed swipe mounts one tab, and another on its first visit', async () => {
    await renderTabs();

    expect(screen.getByText('Essence content')).toBeOnTheScreen();
    expect(screen.queryByText('Example content')).toBeNull();
    expect(screen.queryByText('Word history content')).toBeNull();

    await fireEvent.press(screen.getByTestId('word-tab-example'));
    expect(screen.getByText('Example content')).toBeOnTheScreen();
    expect(screen.queryByText('Essence content')).toBeNull();
    expect(screen.queryByText('Word history content')).toBeNull();
  });
});

/** Names the text size it is drawn at. */
function DrawnAt() {
  const { size } = useWordTextSizes();
  return <Text testID="drawn-at">{size}</Text>;
}

describe("an Entry card's tab on the three-step ladder", () => {
  it('steps down one step at a time to the system step, then keeps the frame and offers More', async () => {
    await render(
      <GestureHandlerRootView>
        <EditionProvider
          edition={{ locale: 'en' }}
          strings={testStrings({
            wordCard: { tabMore: 'More', tabLess: 'Less', tabSource: 'Source' },
          })}
        >
          <FontSizeProvider size={'largest'}>
            <CardTabs testID="word" tabs={tabs} nameOf={(tab) => names[tab.key]}>
              {() => <DrawnAt />}
            </CardTabs>
          </FontSizeProvider>
        </EditionProvider>
      </GestureHandlerRootView>,
    );
    const layout = async (testID: string, height: number) => {
      await fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
      });
    };
    await layout('word-tab-panel', 200);
    expect(screen.getByTestId('drawn-at')).toHaveTextContent('largest');

    // Too tall at every step: each layout takes the next step down, until the floor clamps.
    for (const step of ['larger', 'system', 'system']) {
      await layout('word-tab-content', 2000);
      expect(screen.getByTestId('drawn-at')).toHaveTextContent(step);
    }
    await layout('word-tab-more', 16);

    expect(screen.getByTestId('word-tab-more')).toBeOnTheScreen();
    expect(screen.getByTestId('word-tab-clip')).toHaveStyle({
      overflow: 'hidden',
      height: 200 - 16 - entryCardFrame.moreGap,
    });
    // At the floor it goes no further down.
    await layout('word-tab-content', 2000);
    expect(screen.getByTestId('drawn-at')).toHaveTextContent('system');
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
    // The text keeps clear of the scroll bar at the right edge (owner 14.11).
    expect(StyleSheet.flatten(scroll.props['contentContainerStyle'])).toMatchObject({
      paddingRight: entryCardFrame.scrollGutter,
    });
  });
});

// Review 1128 (2, 3): the last line shown fades into its owner's ground, at the end of its text.
const ground = '#123456';
/** The chips drawn, which Jest measures apart from the text. */
const chips = new Set<unknown>();

/** A block under the text, as a row of link chips. */
function Chip() {
  const { ref, onLayout } = useWholeBlock();
  useEffect(() => {
    chips.add(ref.current);
  }, [ref]);
  return <View testID="chip" ref={ref} onLayout={onLayout} />;
}

/** A clamped tab of ten lines of 28 drawn 12 in and 4 down, the sixth `last` wide, a chip after the fourth with `withChip`. */
async function renderClamped({ last, withChip = false }: { last: number; withChip?: boolean }) {
  // Jest measures no view, and its views share one measureLayout: each text sits 12 in and 4 down
  // in the content, the chip 120 down.
  jest
    .spyOn(Text.prototype as ComponentRef<typeof Text>, 'measureLayout')
    .mockImplementation(function (this: unknown, _content, done) {
      if (chips.has(this)) done(0, 120, 358, 50);
      else done(12, 4, 300, 28);
    });
  await render(
    <GestureHandlerRootView>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={testStrings({ wordCard: { tabMore: 'More', tabLess: 'Less' } })}
      >
        <CardGroundContext value={ground}>
          <CardTabs testID="word" tabs={tabs} nameOf={(tab) => names[tab.key]}>
            {() => (
              <>
                <WholeLinesText testID="lines">Lines</WholeLinesText>
                {withChip && <Chip />}
              </>
            )}
          </CardTabs>
        </CardGroundContext>
      </EditionProvider>
    </GestureHandlerRootView>,
  );
  const layout = async (testID: string, height: number) => {
    await fireEvent(screen.getByTestId(testID), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
    });
  };
  await layout('word-tab-panel', 200);
  for (let size = 0; size < 4 && screen.queryByTestId('word-tab-more') === null; size++)
    await layout('word-tab-content', 2000);
  await layout('word-tab-more', 16);
  const count = withChip ? 4 : 10;
  await fireEvent(screen.getByTestId('lines'), 'textLayout', {
    nativeEvent: {
      lines: Array.from({ length: count }, (_, index) => ({
        x: 0,
        y: index * 28,
        width: index === 5 ? last : 300,
        height: 28,
      })),
    },
  });
  if (withChip) await layout('chip', 50);
}

/** The stops of the gradient drawn under `node`, as react-native-svg hands them to the native view. */
function gradientOf(node: ReturnType<typeof screen.getByTestId>): unknown {
  if (node.type === 'RNSVGLinearGradient') return node.props['gradient'];
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = gradientOf(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe("an Entry card's clamped tab fade (review 1128)", () => {
  it('fades the last line shown at the end of its text into the ground its owner gives', async () => {
    // The room under the link and its air is 200 − 16 − 8 = 176: the sixth line, 144–172, is the last.
    await renderClamped({ last: 250 });

    const fade = screen.getByTestId('word-tab-fade', { includeHiddenElements: true });
    expect(StyleSheet.flatten(fade.props['style'])).toMatchObject({
      position: 'absolute',
      top: 144,
      left: 12 + 250 - entryCardFrame.moreFade,
    });
    expect(fade).toHaveProp('width', entryCardFrame.moreFade);
    expect(fade).toHaveProp('height', 28);
    // The gradient runs from the ground, clear, to the ground, opaque (react-native-svg packs ARGB).
    expect(gradientOf(fade)).toEqual([0, 0x123456, 1, 0xff123456 | 0]);
  });

  it('fades no further left than where a short line starts', async () => {
    await renderClamped({ last: 30 });

    const fade = screen.getByTestId('word-tab-fade', { includeHiddenElements: true });
    expect(StyleSheet.flatten(fade.props['style'])).toMatchObject({ top: 144, left: 0 });
    expect(fade).toHaveProp('width', 12 + 30);
  });

  it('fades nothing when the clip ends under a block, such as a row of chips', async () => {
    // Four lines, 4–116, then the chip 120–170, the last whole row above 176.
    await renderClamped({ last: 300, withChip: true });

    expect(screen.getByTestId('word-tab-clip')).toHaveStyle({ height: 170 });
    expect(screen.queryByTestId('word-tab-fade', { includeHiddenElements: true })).toBeNull();
  });
});

describe("an Entry card's Source tab", () => {
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

  it("is not there when the only source is the Edition's own editing", async () => {
    await renderTabs(['Our own editing']);
    expect(screen.queryByTestId('word-tab-source')).toBeNull();
    expect(screen.getByTestId('word-tab-essence')).toBeTruthy();
  });

  it("leaves the Edition's own editing out of the sources it names", async () => {
    await renderTabs(['Our own editing', 'A dictionary']);

    await fireEvent.press(screen.getByTestId('word-tab-source'));

    expect(screen.getByTestId('word-source-0')).toHaveTextContent('A dictionary', { exact: true });
    expect(screen.queryByTestId('word-source-1')).toBeNull();
  });

  it('is not there without sources', async () => {
    await renderTabs([]);
    expect(screen.getByTestId('word-tab-essence')).toBeOnTheScreen();
    expect(screen.queryByTestId('word-tab-source')).toBeNull();
  });

  it('is not there when the card is given no sources (the switch is off)', async () => {
    await renderTabs();
    expect(screen.getByTestId('word-tab-essence')).toBeOnTheScreen();
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
