import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FeedPageFrame } from './feed-page';

/** The notch of an iPhone with Face ID. */
const top = 47;

describe('a Feed page frame on its own', () => {
  it.each([
    [false, 54],
    [true, 88],
  ])(
    "starts a Quick Question, in the Word card's frame, where the header ends (Search row %s)",
    async (toolsRow, clearance) => {
      await render(
        <FeedPageFrame
          position={2}
          header={{ top, toolsRow }}
          layout={{ style: 'hero', under: 'card' }}
        >
          <Text>Round</Text>
        </FeedPageFrame>,
      );

      const page = screen.getByTestId('feed-card-2');
      expect(page).toHaveStyle({ flex: 1, paddingTop: top });
      expect(screen.getByTestId('feed-card-2-frame')).toHaveStyle({
        flexGrow: 1,
        paddingTop: clearance,
        paddingHorizontal: 12,
        paddingBottom: 24,
      });
    },
  );
});
