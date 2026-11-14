import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { Icon } from '../primitives/Icon';
import { profileHeader, typeStyle } from '../tokens';

/** Who the Profile header greets: the reader by name, or no one yet, with the invitation to add a name. */
export type ProfileReader =
  | { readonly kind: 'named'; readonly name: string }
  | { readonly kind: 'unnamed'; readonly invitation: string };

/**
 * The Profile's header (board 11, t8): the avatar with the first letter of
 * the reader's name, the name and «Рівень N — назва» under it. Without a name,
 * a neutral avatar and the invitation to add one. Without a `reader` (the
 * reader's name switched off), the Level alone.
 */
export function ProfileHeader({
  reader,
  level,
}: {
  reader?: ProfileReader | undefined;
  /** «Рівень N — назва», while the Level is shown. */
  level?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const levelLine = level !== undefined && (
    <Text
      {...voice}
      testID="profile-header-level"
      style={[
        typeStyle(reader === undefined ? 'profileName' : 'profileHeaderLevel', tokens),
        { color: reader === undefined ? colors.ink : colors.muted },
      ]}
    >
      {level}
    </Text>
  );
  return (
    <View
      testID="profile-header"
      accessible
      style={[styles.header, { backgroundColor: colors.surfaceSunken }]}
    >
      {reader?.kind === 'named' && (
        <View testID="profile-avatar" style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text
            testID="profile-avatar-letter"
            {...voice}
            style={[typeStyle('profileAvatarLetter', tokens), { color: colors.onAccent }]}
          >
            {firstLetterOf(reader.name)}
          </Text>
        </View>
      )}
      {reader?.kind === 'unnamed' && (
        <View
          testID="profile-avatar-neutral"
          style={[styles.avatar, { backgroundColor: colors.tile }]}
        >
          <Icon name="profile" color={colors.muted} size={profileHeader.avatar.mark} />
        </View>
      )}
      <View style={styles.lines}>
        {reader !== undefined && (
          <Text
            {...voice}
            testID={reader.kind === 'named' ? 'profile-name' : 'profile-invitation'}
            numberOfLines={1}
            style={[
              typeStyle('profileName', tokens),
              { color: reader.kind === 'named' ? colors.ink : colors.muted },
            ]}
          >
            {reader.kind === 'named' ? reader.name : reader.invitation}
          </Text>
        )}
        {levelLine}
      </View>
    </View>
  );
}

/** The name's first letter, a whole character even past the Basic Multilingual Plane, in capitals. */
function firstLetterOf(name: string): string {
  const [first = ''] = Array.from(name);
  return first.toLocaleUpperCase();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: profileHeader.gap,
    padding: profileHeader.padding,
    borderRadius: profileHeader.radius,
  },
  avatar: {
    width: profileHeader.avatar.side,
    height: profileHeader.avatar.side,
    borderRadius: profileHeader.avatar.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lines: { flex: 1, minWidth: 0, gap: profileHeader.lines },
});
