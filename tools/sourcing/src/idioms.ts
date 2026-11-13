import {
  IdiomSchema,
  IdiomTypeSchema,
  type Example,
  type IdiomInput,
  type IdiomType,
} from '@slovo/contracts';
import type { EditionFolder } from '@slovo/language-pack/edition';

import { errorMessage } from './error-message';
import { fetchGoroh, gorohUrl, parsePhraseology, type GorohPhraseologism } from './goroh';
import {
  draftIssues,
  runSourcing,
  type DraftContext,
  type KindDraft,
  type KindOutcome,
  type ParsedLine,
  type PipelineOptions,
  type SourcingKind,
  type SourcingResult,
} from './pipeline';
import type { Flag } from './review-report';
import { authorOf } from './source-words';
import { citedAs, unstressed } from './text';

export type IdiomSourcingOptions = PipelineOptions & {
  /** The Lemmas to read, one per line: `<lemma> [idiom|proverb]`, `idiom` by default; `#` starts a comment. */
  readonly idiomList: string;
};

/**
 * Drafts Idioms from goroh «Фразеологія»: every phraseologism the page lists
 * for a Lemma becomes a draft, cited to the dictionary goroh names for it,
 * and they are written with a review report to the `idioms` folder of the
 * review folder. What goroh attributes to a language model is refused
 * (ADR 0012); proper names are left out, since their story is their etymology.
 */
export function sourceIdioms(options: IdiomSourcingOptions): Promise<SourcingResult> {
  return runSourcing(options.idiomList, options, idiomsKind);
}

interface IdiomRequest {
  readonly lemma: string;
  readonly idiomType: IdiomType;
}

/** The Idiom Types a line may name; place names are not sourced from goroh. */
const LINE_TYPES: readonly IdiomType[] = ['idiom', 'proverb'];

const idiomsKind: SourcingKind<IdiomRequest> = {
  entryKind: 'idiom',
  folder: 'idioms',
  idPrefix: 'i_',
  parseLine,
  start: (context) => (request) => draftLemma(request, context),
};

/** Reads `<lemma> [idiom|proverb]`. */
function parseLine(content: string): ParsedLine<IdiomRequest> {
  const [lemma, typeText = 'idiom', ...rest] = content.split(/\s+/);
  if (lemma === undefined || rest.length > 0) {
    return { ok: false, text: undefined, errors: ['Expected "<lemma> [idiom|proverb]"'] };
  }
  const text = lemma.normalize('NFC');
  const errors: string[] = [];
  if (lemma !== unstressed(lemma)) errors.push(`Write the Lemma "${lemma}" without stress marks`);
  const idiomType = IdiomTypeSchema.safeParse(typeText);
  if (!idiomType.success || !LINE_TYPES.includes(idiomType.data)) {
    errors.push(`Idiom Type "${typeText}" is not one of ${LINE_TYPES.join(', ')}`);
  }
  if (!idiomType.success || errors.length > 0) return { ok: false, text, errors };
  return { ok: true, text, request: { lemma: text, idiomType: idiomType.data } };
}

async function draftLemma(request: IdiomRequest, context: DraftContext): Promise<KindOutcome> {
  let page: string | undefined;
  try {
    page = await fetchGoroh(context.client, 'Фразеологія', request.lemma);
  } catch (error) {
    return { drafts: [], flags: [{ kind: 'fetch-failed', message: errorMessage(error) }] };
  }
  const phraseologisms = page === undefined ? [] : parsePhraseology(page);
  if (phraseologisms.length === 0) {
    return {
      drafts: [],
      flags: [{ kind: 'no-entry', message: 'goroh has no «Фразеологія» page for it' }],
    };
  }
  const byModel = phraseologisms.filter((block) => block.languageModel);
  const properNames = phraseologisms.filter((block) => !block.languageModel && block.properName);
  const uncited = phraseologisms.filter(
    (block) => !block.languageModel && !block.properName && block.dictionary === '',
  );
  const drafted = phraseologisms.filter(
    (block) => !block.languageModel && !block.properName && block.dictionary !== '',
  );
  const flags: Flag[] = [];
  const leftOut = (blocks: readonly GorohPhraseologism[], why: string) => {
    if (blocks.length === 0) return;
    const expressions = blocks.map((block) => block.expression).join('; ');
    flags.push({ kind: 'check', message: `Left out, ${why}: ${expressions}` });
  };
  leftOut(byModel, 'goroh attributes them to a language model (ADR 0012)');
  leftOut(properNames, 'proper names, whose story is their etymology');
  leftOut(uncited, 'goroh cites no dictionary for them');
  return {
    drafts: drafted.map((block) => draftIdiom(block, request, context)),
    flags,
  };
}

/** «Словник прислів'їв та приказок…», a dictionary of proverbs and sayings. */
const PROVERB_DICTIONARY = /^Словник прислів['’ʼ]їв та приказок/u;

/** An Idiom as drafted: the sources may leave the primary Definition open, and then it fails the schema. */
type IdiomDraft = Omit<IdiomInput, 'primaryDefinition'> &
  Partial<Pick<IdiomInput, 'primaryDefinition'>>;

function draftIdiom(
  block: GorohPhraseologism,
  request: IdiomRequest,
  context: DraftContext,
): KindDraft {
  const expression = unstressed(block.expression).normalize('NFC');
  const [primaryDefinition, ...extraDefinitions] = block.definitions;
  const examples = block.examples.map(({ text, citation }): Example => {
    const author = authorOf(citation);
    return author === undefined ? { text } : { text, author };
  });
  const idiom: IdiomDraft = {
    id: context.newId(),
    expression,
    idiomType: request.idiomType,
    ...(primaryDefinition === undefined ? {} : { primaryDefinition }),
    ...(extraDefinitions.length === 0 ? {} : { extraDefinitions }),
    ...(examples.length === 0 ? {} : { examples }),
    sources: [{ ...citedAs(block.dictionary), url: gorohUrl('Фразеологія', request.lemma) }],
  };
  return {
    entry: idiom,
    headword: block.expression,
    issues: checkDraft(idiom, context.edition),
    // That dictionary also holds idioms proper («Лити воду»), so it only raises the question.
    flags:
      request.idiomType !== 'proverb' && PROVERB_DICTIONARY.test(block.dictionary)
        ? [
            {
              kind: 'check',
              message: `Idiom Type ${request.idiomType} from the line, but goroh cites ${block.dictionary}: is it a proverb?`,
            },
          ]
        : [],
    summary: {
      text: expression,
      group: request.idiomType,
      examples: examples.length,
      definition: primaryDefinition ?? '',
    },
  };
}

/** The schema's verdict, then the build's own checks against the Edition, as `field: message`. */
function checkDraft(idiom: IdiomDraft, edition: EditionFolder): string[] {
  return draftIssues(IdiomSchema, (valid) => edition.checkNewIdioms([valid]), '(idiom)', idiom);
}
