import { createContent, systemRandom, type Content } from '@slovo/core';
import { createPackReader } from '@slovo/language-pack/reader';
import { Placeholder } from '@slovo/ui';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import languagePack from 'slovo-edition/language-pack';
import { useMemo, useState, type ReactNode } from 'react';

import { editionStrings } from './edition';

const DATABASE_NAME = 'language-pack.db';

async function openReadOnly(db: SQLiteDatabase): Promise<void> {
  // expo-sqlite has no read-only open mode; this refuses every write instead.
  await db.execAsync('PRAGMA query_only = ON');
}

/**
 * Copies the Language Pack bundled with the app into place on every launch,
 * so the app always reads the pack it shipped with, and opens it read-only.
 */
export function LanguagePackProvider({ children }: { children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return <Placeholder testID="language-pack-failed" message={editionStrings.loadFailed} />;
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      assetSource={{ assetId: languagePack, forceOverwrite: true }}
      onInit={openReadOnly}
      onError={(error) => {
        console.error('Could not open the Language Pack', error);
        setFailed(true);
      }}
    >
      {children}
    </SQLiteProvider>
  );
}

/** The Core's content, read from the bundled Language Pack. */
export function useContent(): Content {
  const db = useSQLiteContext();
  return useMemo(() => createContent({ port: createPackReader(db), random: systemRandom }), [db]);
}
