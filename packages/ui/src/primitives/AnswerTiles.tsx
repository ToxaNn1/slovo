import { StyleSheet, View } from 'react-native';

import { PressedTile } from './PressedTile';
import { WholeWordsText } from './WholeWordsText';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { answerOption, roundLayout, space, typeStyle } from '../tokens';

/** One answer of `AnswerTiles`. */
export interface AnswerTile {
  id: string;
  label: string;
  /** Its own id; its face takes `-face` after it. */
  testID: string;
}

/**
 * A question's answers on the tiles of a Game's options (board 07, owner
 * 16.11): a cream tile per answer, the picked one red. VoiceOver reads each
 * tile as a button with its selected state.
 */
export function AnswerTiles({
  options,
  picked,
  onPick,
}: {
  options: readonly AnswerTile[];
  picked: string | undefined;
  onPick: (id: string) => void;
}) {
  const tokens = useTokens();
  const keyInk = useSchemeColors('light').ink;
  return (
    <View style={styles.tiles}>
      {options.map(({ id, label, testID }) => {
        const on = id === picked;
        return (
          <PressedTile
            key={id}
            testID={testID}
            tone={on ? 'accent' : 'tile'}
            radius={answerOption.radius}
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={() => {
              onPick(id);
            }}
            faceStyle={styles.tile}
          >
            <WholeWordsText
              text={label}
              typeRole="roundOptionSentence"
              style={[
                typeStyle('roundOptionSentence', tokens),
                { color: on ? keyInk : tokens.colors.ink },
              ]}
            />
          </PressedTile>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { gap: roundLayout.gap },
  tile: {
    minHeight: answerOption.minHeight,
    justifyContent: 'center',
    paddingVertical: space[2],
    paddingLeft: answerOption.paddingLeft,
    paddingRight: answerOption.paddingRight,
  },
});
