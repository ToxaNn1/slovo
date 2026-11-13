import { withoutStress } from '@slovo/core';
import type { StyleProp, TextStyle } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { useEdition } from '../providers/EditionProvider';
import { capitalised } from './capitalised';

/**
 * The other Definitions of an Entry, a line each, numbered on from 2: the
 * primary Definition is the first.
 */
export function NumberedDefinitions({
  definitions,
  style,
}: {
  definitions: readonly string[];
  style: StyleProp<TextStyle>;
}) {
  const { voice } = useEdition();
  return definitions.map((definition, index) => {
    const number = String(index + 2);
    return (
      <WholeLinesText
        key={index}
        // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
        accessibilityLabel={withoutStress(`${number}. ${definition}`)}
        {...voice}
        style={style}
      >
        {`${number}. ${capitalised(definition, voice.accessibilityLanguage)}`}
      </WholeLinesText>
    );
  });
}
