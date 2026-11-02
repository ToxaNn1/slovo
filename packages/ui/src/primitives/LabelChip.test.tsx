import { EditionProvider, LabelChip } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

function renderChip(role?: 'header') {
  return render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <LabelChip
        testID="register"
        text="coll."
        accessibilityLabel="colloquial"
        {...(role === undefined ? {} : { accessibilityRole: role })}
        size="tight"
      />
    </EditionProvider>,
  );
}

describe('LabelChip', () => {
  it('shows its text and reads its own label', async () => {
    await renderChip();
    expect(screen.getByText('coll.')).toBeOnTheScreen();
    expect(screen.getByLabelText('colloquial')).toBeOnTheScreen();
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('heads a group when it is given the header role', async () => {
    await renderChip('header');
    expect(screen.getByRole('header', { name: 'colloquial' })).toBeOnTheScreen();
  });
});
