import { ActionRow } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

function row(share: boolean, marks?: boolean) {
  return (
    <ActionRow
      marks={marks === true ? <Text testID="marks">marks</Text> : undefined}
      favorite={<Text testID="favorite">♡</Text>}
      share={share ? <Text testID="share">share</Text> : undefined}
      collection={<Text testID="collection">+</Text>}
      hide={<Text testID="hide">×</Text>}
    />
  );
}

describe('ActionRow', () => {
  it('has a share button when it is given one', async () => {
    await render(row(true));

    expect(screen.getByTestId('share')).toBeTruthy();
    expect(screen.getByTestId('favorite')).toBeTruthy();
  });

  it('leaves the share slot out, and keeps the other three, without one', async () => {
    await render(row(false));

    expect(screen.queryByTestId('share')).toBeNull();
    for (const id of ['favorite', 'collection', 'hide']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it('has the mark buttons when it is given them', async () => {
    await render(row(true, true));

    expect(screen.getByTestId('marks')).toBeTruthy();
  });

  it('has no mark buttons without them', async () => {
    await render(row(true));

    expect(screen.queryByTestId('marks')).toBeNull();
  });

  it('spreads the heart and Collections alone over the row without share and hide, as on a Synonym Row', async () => {
    await render(
      <ActionRow
        favorite={<Text testID="favorite">♡</Text>}
        collection={<Text testID="collection">+</Text>}
      />,
    );

    const [slots] = screen.getByTestId('action-row').children;
    expect(typeof slots === 'string' ? [] : slots?.children).toHaveLength(2);
  });

  it('has a slot for the report flag when it is given one', async () => {
    await render(
      <ActionRow
        favorite={<Text testID="favorite">♡</Text>}
        collection={<Text testID="collection">+</Text>}
        report={<Text testID="report">⚑</Text>}
      />,
    );

    const [slots] = screen.getByTestId('action-row').children;
    const children = typeof slots === 'string' ? [] : (slots?.children ?? []);
    expect(children).toHaveLength(3);
    expect(screen.getByTestId('report')).toBeOnTheScreen();
  });
});
