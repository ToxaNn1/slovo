'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { ACCOUNT_NAME } from '@slovo/contracts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DecorBackground, EmptyStateIllustration, OrnamentBand } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { WholeWordsText } from '../primitives/WholeWordsText';
import {
  accountMark,
  minTouchTarget,
  onboardingRosetteWidth,
  overlineType,
  sampleNotification,
  space,
  typeSize,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How long a step takes to slide in, and how far from the side it starts. */
const SLIDE_MS = 320;
const SLIDE_DISTANCE = 40;
/**
 * How far the largest text sizes of iOS may scale the step's text, so no word
 * breaks in the middle: the bigger of the two is for running text.
 */
const HEADLINE_MAX_FONT_SCALE = 1.3;
const TEXT_MAX_FONT_SCALE = 1.5;
/** The design's hero Lemma, `Lemma, hero`: Literata 500, 76 / 1. */
const HERO_LEMMA = { fontSize: typeSize.heroLemma, lineHeight: typeSize.heroLemma } as const;
/** A page dot of the progress: the current one is the longer. */
const DOT = { height: 4, width: 16, currentWidth: 44, gap: space[3] } as const;

/**
 * One step of the onboarding, over the whole screen: the wordmark and
 * «Пропустити» at the top end, the step's content, the progress dots and the
 * step's buttons. It slides in from the side; with Reduce Motion it appears
 * where it is. VoiceOver reads the step top to bottom and says its number
 * once: with the dots on the welcome, with the overline «КРОК N З M» on the
 * steps after it.
 */
function OnboardingStep({
  step,
  total,
  onSkip,
  children,
  footer,
  testID,
  fromTop = false,
}: {
  /** This step's number, from 1. */
  step: number;
  total: number;
  /** Finishes the onboarding at once. */
  onSkip: () => void;
  children: ReactNode;
  /** The step's buttons, pinned under the content. */
  footer: ReactNode;
  testID?: string;
  /** Whether the content starts under the top row, as the form steps do, instead of sitting on the footer. */
  fromTop?: boolean;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { top, bottom } = useSafeAreaInsets();
  const { onboarding } = strings;
  const numbers = { step: String(step), total: String(total) };

  // Reanimated skips the motion when Reduce Motion is on, so the step just appears.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  // A step after the welcome replaces the one VoiceOver was on: start at its number.
  const overline = useRef<Text>(null);
  useEffect(() => {
    const node = findNodeHandle(overline.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * SLIDE_DISTANCE }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.step,
        slide,
        { backgroundColor: colors.background, paddingTop: top, paddingBottom: bottom },
      ]}
    >
      <DecorBackground />
      <View style={styles.topRow}>
        <Text
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          style={[styles.wordmark, { color: colors.accent, fontFamily: fontFamilies.word }]}
        >
          {strings.splash.wordmark}
        </Text>
        <Pressable
          testID="onboarding-skip"
          accessibilityRole="button"
          {...voice}
          onPress={onSkip}
          hitSlop={space[2]}
          style={styles.skip}
        >
          <Text
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            style={[styles.skipLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {onboarding.skip}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, fromTop && styles.contentFromTop]}
        showsVerticalScrollIndicator={false}
      >
        {step > 1 && (
          <Text
            ref={overline}
            testID="onboarding-step"
            accessibilityLabel={fill(onboarding.stepLabel, numbers)}
            {...voice}
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            style={[styles.overline, { color: colors.accent, fontFamily: fontFamilies.ui }]}
          >
            {fill(onboarding.step, numbers)}
          </Text>
        )}
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <View
          testID="onboarding-progress"
          // The overline says the number on the steps that have one.
          accessible={step === 1}
          accessibilityLabel={fill(onboarding.stepLabel, numbers)}
          {...voice}
          style={styles.dots}
        >
          {Array.from({ length: total }, (_, index) => (
            <View
              key={index}
              style={{
                height: DOT.height,
                width: index + 1 === step ? DOT.currentWidth : DOT.width,
                backgroundColor: index + 1 === step ? colors.accent : colors.line,
              }}
            />
          ))}
        </View>
        {footer}
      </View>
    </Animated.View>
  );
}

/** The Word the welcome shows large. */
export interface HeroWord {
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
  readonly definition: string;
}

/**
 * The welcome: what SLOVO is. A hero Word with its Definition, the ornament band,
 * the Edition's promise and «Почати». The hero Word is left out when the
 * Language Pack has none to show.
 */
export function OnboardingWelcome({
  step,
  total,
  hero,
  onStart,
  onSkip,
}: {
  /** This step's number, from 1: the Core's order puts the welcome first. */
  step: number;
  total: number;
  hero: HeroWord | undefined;
  onStart: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { welcome } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding"
      step={step}
      total={total}
      onSkip={onSkip}
      footer={<PrimaryButton testID="onboarding-start" label={welcome.start} onPress={onStart} />}
    >
      {hero === undefined ? null : (
        <View style={styles.hero}>
          <WholeWordsText
            text={hero.lemma}
            size={HERO_LEMMA}
            tracking={-0.02}
            testID="onboarding-hero-lemma"
            accessibilityLabel={hero.accessibilityLabel}
            {...voice}
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{ color: colors.ink, fontFamily: fontFamilies.word, fontWeight: '500' }}
          />
          <Text
            testID="onboarding-hero-definition"
            {...voice}
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[
              styles.definition,
              { color: colors.inkSecondary, fontFamily: fontFamilies.word },
            ]}
          >
            {hero.definition}
          </Text>
        </View>
      )}
      {/* In a row, since the band fills the width with `flex`. */}
      <View style={styles.band}>
        <OrnamentBand />
      </View>
      <Text
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {welcome.title}
      </Text>
      <Text
        {...voice}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {welcome.subtitle}
      </Text>
    </OnboardingStep>
  );
}

/**
 * The Mix step. «Оберіть свій Мікс», what it is for, the choices of the Mix
 * (`children`, the shell's: the Mix is the composition's) and «Далі».
 */
export function OnboardingMix({
  step,
  total,
  onNext,
  onSkip,
  children,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { mix } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding-mix"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={<PrimaryButton testID="onboarding-next" label={mix.next} onPress={onNext} />}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {mix.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {mix.subtitle}
        </Text>
      </View>
      {/* A block of its own: the choices space themselves, not by the step's gap. */}
      <View>{children}</View>
    </OnboardingStep>
  );
}

/** The notification the last step shows as a sample. */
export interface SampleNotificationLook {
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
  /** The notification's body: the primary Definition, cut as the real one is. */
  readonly body: string;
  /** When it would come, e.g. «09:00»; left out with no Notification time. */
  readonly time: string | undefined;
}

/**
 * The notifications step. «Слово саме прийде до вас», a sample of the Word of
 * the Day's notification (left out when there is none to show), the Notification
 * times (`children`, the shell's: the times are the Notifications module's),
 * «Дозволити сповіщення» and the quiet «Пізніше».
 */
export function OnboardingNotifications({
  step,
  total,
  sample,
  onAllow,
  onLater,
  onSkip,
  children,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  sample: SampleNotificationLook | undefined;
  onAllow: () => void;
  onLater: () => void;
  onSkip: () => void;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { notifications } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding-notifications"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={
        <>
          <PrimaryButton testID="onboarding-allow" label={notifications.allow} onPress={onAllow} />
          <LaterButton testID="onboarding-later" onPress={onLater} />
        </>
      }
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {notifications.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {notifications.subtitle}
        </Text>
      </View>
      {sample !== undefined && <SampleNotification sample={sample} />}
      {/* A block of its own: the times space themselves, not by the step's gap. */}
      <View>{children}</View>
    </OnboardingStep>
  );
}

/** The quiet «Пізніше» under a step's main button, which goes on without it. */
function LaterButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      {...voice}
      onPress={onPress}
      style={styles.later}
    >
      <Text
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[styles.laterLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {strings.onboarding.notifications.later}
      </Text>
    </Pressable>
  );
}

/** A Word the Rarity Test asks about. */
export interface RarityTestQuestion {
  readonly rarity: number;
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
}

/** A screen of the Rarity Test, which its caller draws in its own frame. */
export interface RarityTestScreen {
  readonly testID: string;
  /** The screen's buttons, pinned under the content. */
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/** Where the Rarity Test is: the Word asked about, or the floor it set. */
type RarityTestPhase =
  | { readonly kind: 'asking'; readonly answers: readonly { rarity: number; known: boolean }[] }
  | { readonly kind: 'result'; readonly floor: number };

/** A Rarity Test screen's title, as VoiceOver's header. */
function RarityTestTitle({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
      style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

/**
 * The Rarity Test's questions and result, the same in onboarding and from
 * Settings: each Word in turn by its Lemma with Stress under «{n} з {total}»,
 * with «Знаю» and «Не знаю»; the last answer applies them all, and the result
 * says «Ваш рівень: від {n}» over «Далі». The caller draws each screen in its
 * own frame.
 */
export function RarityTestQuestions({
  testID,
  words,
  onApply,
  onDone,
  frame,
}: {
  /** The prefix of the screens' and buttons' testIDs. */
  testID: string;
  /** The Words to ask about, in the order asked. */
  words: readonly RarityTestQuestion[];
  /**
   * Applies the answers and resolves to the Rarity Floor they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (answers: readonly { rarity: number; known: boolean }[]) => Promise<number | undefined>;
  /** Goes on from the result, or at once when the answers set no floor. */
  onDone: () => void;
  frame: (screen: RarityTestScreen) => ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const [phase, setPhase] = useState<RarityTestPhase>({ kind: 'asking', answers: [] });
  /** Whether the answers are applied, so a second tap on the last Word applies nothing. */
  const applied = useRef(false);
  /** «3 з 10» over the Word asked about. */
  const progressOf = (asked: number) =>
    fill(strings.rarityTest.progress, { n: String(asked + 1), total: String(words.length) });
  // VoiceOver stays on the buttons, so it says where the test is and each next Word.
  const asked = phase.kind === 'asking' ? phase.answers.length : 0;
  const spoken = asked > 0 ? words[asked] : undefined;
  const announcement =
    spoken === undefined ? undefined : `${progressOf(asked)}, ${spoken.accessibilityLabel}`;
  useEffect(() => {
    if (announcement !== undefined) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  const answer = (known: boolean) => {
    if (phase.kind !== 'asking') return;
    const word = words[phase.answers.length];
    if (word === undefined) return;
    const answers = [...phase.answers, { rarity: word.rarity, known }];
    setPhase({ kind: 'asking', answers });
    if (answers.length < words.length || applied.current) return;
    applied.current = true;
    void onApply(answers).then((floor) => {
      if (floor === undefined) onDone();
      else setPhase({ kind: 'result', floor });
    });
  };

  if (phase.kind === 'result') {
    return frame({
      testID: `${testID}-result`,
      footer: (
        <PrimaryButton
          testID={`${testID}-next`}
          label={strings.onboarding.mix.next}
          onPress={onDone}
        />
      ),
      children: (
        <RarityTestTitle>
          {fill(strings.rarityTest.result, { n: String(phase.floor) })}
        </RarityTestTitle>
      ),
    });
  }
  const word = words[phase.answers.length];
  const applying = word === undefined;
  return frame({
    testID: `${testID}-question`,
    footer: (
      <>
        <PrimaryButton
          testID={`${testID}-known`}
          label={strings.knowledge.known}
          busy={applying}
          onPress={() => {
            answer(true);
          }}
        />
        <SecondaryButton
          testID={`${testID}-unknown`}
          label={strings.knowledge.unknown}
          disabled={applying}
          onPress={() => {
            answer(false);
          }}
        />
      </>
    ),
    children: word !== undefined && (
      <>
        <Text
          testID={`${testID}-progress`}
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.counter, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {progressOf(phase.answers.length)}
        </Text>
        <WholeWordsText
          text={word.lemma}
          size={HERO_LEMMA}
          tracking={-0.02}
          testID={`${testID}-lemma`}
          accessibilityLabel={word.accessibilityLabel}
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{ color: colors.ink, fontFamily: fontFamilies.word, fontWeight: '500' }}
        />
      </>
    ),
  });
}

/**
 * The Rarity Test step, after the Mix: «Перевірити рівень» with «Почати» and
 * the quiet «Пізніше», which goes on past it; «Почати» starts the test
 * (`RarityTestQuestions`), and the result's «Далі» goes on. «Пропустити»
 * finishes the onboarding at any point, setting nothing.
 */
export function OnboardingRarityTest({
  step,
  total,
  words,
  onApply,
  onNext,
  onSkip,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  /** The Words to ask about, in the order asked. */
  words: readonly RarityTestQuestion[];
  /**
   * Applies the answers and resolves to the Rarity Floor they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (answers: readonly { rarity: number; known: boolean }[]) => Promise<number | undefined>;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <RarityTestQuestions
        testID="onboarding-rarity"
        words={words}
        onApply={onApply}
        onDone={onNext}
        frame={(screen) => <OnboardingStep step={step} total={total} onSkip={onSkip} {...screen} />}
      />
    );
  }
  return (
    <OnboardingStep
      testID="onboarding-rarity-test"
      step={step}
      total={total}
      onSkip={onSkip}
      footer={
        <>
          <PrimaryButton
            testID="onboarding-rarity-start"
            label={strings.onboarding.welcome.start}
            onPress={() => {
              setStarted(true);
            }}
          />
          <LaterButton testID="onboarding-rarity-later" onPress={onNext} />
        </>
      }
    >
      <View style={styles.heading}>
        <RarityTestTitle>{strings.rarityTest.start}</RarityTestTitle>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.rarityTest.subtitle}
        </Text>
      </View>
    </OnboardingStep>
  );
}

/**
 * The SLOVO ID step, with the Account on: «Збережіть свої слова», what SLOVO
 * ID keeps, the rosette of the empty states (Decor slot 4), «Увійти через
 * SLOVO ID» with SLOVO ID's mark, which opens the SLOVO ID screen, and
 * «Продовжити без акаунта».
 */
export function OnboardingAccount({
  step,
  total,
  onSignIn,
  onContinue,
  onSkip,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  onSignIn: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { account } = strings.onboarding;
  const name = { name: ACCOUNT_NAME };
  return (
    <OnboardingStep
      testID="onboarding-account"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={
        <>
          <PrimaryButton
            testID="onboarding-sign-in"
            label={fill(account.signIn, name)}
            mark={<AccountMark />}
            onPress={onSignIn}
          />
          <SecondaryButton
            testID="onboarding-continue"
            label={account.continueWithout}
            onPress={onContinue}
          />
        </>
      }
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {account.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {fill(account.subtitle, name)}
        </Text>
      </View>
      <View style={styles.rosette}>
        <EmptyStateIllustration width={onboardingRosetteWidth} />
      </View>
    </OnboardingStep>
  );
}

/** SLOVO ID's mark: its first letter on the background colour, inside the primary button's ink fill. */
function AccountMark() {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={[styles.accountMark, { backgroundColor: colors.background }]}>
      <Text
        allowFontScaling={false}
        style={[styles.accountMarkLetter, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {Array.from(ACCOUNT_NAME)[0]}
      </Text>
    </View>
  );
}

/** What a notification of the app looks like on the lock screen, as a sample of the real one. */
function SampleNotification({ sample }: { sample: SampleNotificationLook }) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice, strings } = useEdition();
  const { wordmark } = strings.splash;
  const label = [
    strings.onboarding.notifications.sample,
    wordmark,
    sample.time,
    sample.accessibilityLabel,
    sample.body,
  ]
    .filter((part) => part !== undefined)
    .join('. ');
  return (
    <View
      testID="onboarding-sample"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[
        styles.sample,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          shadowColor: colors.ink,
        },
      ]}
    >
      <View style={[styles.appIcon, { backgroundColor: colors.ink }]}>
        <Text
          style={[styles.appIconMark, { color: colors.background, fontFamily: fontFamilies.word }]}
        >
          {Array.from(wordmark)[0]}
        </Text>
      </View>
      <View style={styles.sampleText}>
        <View style={styles.sampleTop}>
          <Text
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            numberOfLines={1}
            style={[styles.sampleApp, { color: colors.ink, fontFamily: fontFamilies.ui }]}
          >
            {wordmark}
          </Text>
          {sample.time !== undefined && (
            <Text
              testID="onboarding-sample-time"
              maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
              style={[styles.sampleTime, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {sample.time}
            </Text>
          )}
        </View>
        <Text
          testID="onboarding-sample-lemma"
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[styles.sampleLemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {sample.lemma}
        </Text>
        <Text
          testID="onboarding-sample-body"
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.sampleBody, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
        >
          {sample.body}
        </Text>
      </View>
    </View>
  );
}

const SIDE = space[8];

const styles = StyleSheet.create({
  step: { flex: 1 },
  topRow: {
    minHeight: minTouchTarget + space[4],
    paddingHorizontal: SIDE,
    paddingTop: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    flexShrink: 1,
    fontSize: typeSize.subhead,
    fontWeight: '500',
    letterSpacing: typeSize.subhead * 0.32,
  },
  skip: {
    flexShrink: 0,
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
  },
  skipLabel: { fontSize: typeSize.body, fontWeight: '600' },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SIDE,
    paddingTop: space[5],
    gap: space[5],
  },
  contentFromTop: { justifyContent: 'flex-start' },
  overline: overlineType,
  heading: { gap: space[2] },
  band: { flexDirection: 'row' },
  hero: { gap: space[2] },
  definition: { fontSize: typeSize.subhead, lineHeight: typeSize.subhead * 1.3, fontWeight: '500' },
  title: {
    fontSize: typeSize.onboardingTitle,
    lineHeight: typeSize.onboardingTitle * 1.15,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: typeSize.blockHeading,
    lineHeight: typeSize.blockHeading * 1.5,
    paddingBottom: space[4],
  },
  footer: { paddingHorizontal: SIDE, paddingTop: space[3], paddingBottom: space[4], gap: space[5] },
  dots: { flexDirection: 'row', alignItems: 'center', gap: DOT.gap },
  counter: { fontSize: typeSize.body, fontWeight: '600' },
  later: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  laterLabel: { fontSize: typeSize.button, fontWeight: '600' },
  sample: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  appIcon: {
    width: sampleNotification.iconSize,
    height: sampleNotification.iconSize,
    borderRadius: sampleNotification.iconRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconMark: { fontSize: typeSize.subhead, fontWeight: '600' },
  rosette: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  accountMark: {
    width: accountMark.size,
    height: accountMark.size,
    borderRadius: accountMark.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMarkLetter: { fontSize: accountMark.letterSize, fontWeight: '600' },
  sampleText: { flex: 1, gap: sampleNotification.lineGap },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  sampleApp: { flexShrink: 1, fontSize: typeSize.meta, fontWeight: '600' },
  sampleTime: { fontSize: typeSize.meta },
  sampleLemma: {
    fontSize: typeSize.blockHeading,
    lineHeight: typeSize.blockHeading * 1.3,
    fontWeight: '600',
  },
  sampleBody: { fontSize: typeSize.caption, lineHeight: typeSize.caption * 1.35 },
});
