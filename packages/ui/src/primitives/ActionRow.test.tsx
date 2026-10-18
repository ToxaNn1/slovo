import { ActionRow } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

function row(share: boolean) {
  return (
    <ActionRow
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
});
