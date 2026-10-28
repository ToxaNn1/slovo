import type { EditionStrings } from '@slovo/contracts';
import { CommunityCountersLine, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

const strings = {
  knowledge: {
    communityCounters: {
      known: { one: '{known} of {count} reader know', other: '{known} of {count} readers know' },
      saved: 'saved by {saved}',
      line: '{known} · {saved}',
    },
  },
} as unknown as EditionStrings;

async function renderLine(line: Parameters<typeof CommunityCountersLine>[0]['line']) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <CommunityCountersLine line={line} />
    </EditionProvider>,
  );
}

describe('CommunityCountersLine', () => {
  it('says who know the Entry of how many readers, in the plural of the total, and who saved it', async () => {
    await renderLine({ known: 0, total: 1, saved: 0 });

    expect(screen.getByText('0 of 1 reader know · saved by 0')).toBeOnTheScreen();
  });

  it('is one element VoiceOver reads as one sentence, without the dot', async () => {
    await renderLine({ known: 3, total: 5, saved: 2 });

    expect(screen.getByTestId('community-counters')).toHaveAccessibleName(
      '3 of 5 readers know, saved by 2',
    );
  });

  it('draws nothing without a line', async () => {
    await renderLine(undefined);

    expect(screen.queryByTestId('community-counters')).toBeNull();
  });
});
