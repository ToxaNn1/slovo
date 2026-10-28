import { describe, expect, it, vi } from 'vitest';

import { createMenuFollowUp } from './menu-follow-up';

const books = { id: 'c1', name: 'Books' };

function followUp() {
  const rename = vi.fn();
  const remove = vi.fn();
  const share = vi.fn();
  return { rename, remove, share, ...createMenuFollowUp({ rename, remove, share }) };
}

describe('a Collection menu follow-up', () => {
  it('starts the rename only once the menu has slid away', () => {
    const { rename, chooseRename, dismissed } = followUp();

    chooseRename(books);
    expect(rename).not.toHaveBeenCalled();

    dismissed();
    expect(rename).toHaveBeenCalledExactlyOnceWith(books);
  });

  it('asks to delete only once the menu has slid away', () => {
    const { remove, chooseDelete, dismissed } = followUp();

    chooseDelete(books);
    expect(remove).not.toHaveBeenCalled();

    dismissed();
    expect(remove).toHaveBeenCalledExactlyOnceWith(books);
  });

  it('shares only once the menu has slid away', () => {
    const { share, rename, remove, chooseShare, dismissed } = followUp();

    chooseShare(books);
    expect(share).not.toHaveBeenCalled();

    dismissed();
    expect(share).toHaveBeenCalledExactlyOnceWith(books);
    expect(rename).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('does nothing when the menu is cancelled', () => {
    const { rename, remove, dismissed } = followUp();

    dismissed();
    expect(rename).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('acts once per choice', () => {
    const { rename, chooseRename, dismissed } = followUp();

    chooseRename(books);
    dismissed();
    dismissed();
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it('forgets a choice when the menu opens again', () => {
    const { rename, chooseRename, opened, dismissed } = followUp();

    chooseRename(books);
    opened();
    dismissed();
    expect(rename).not.toHaveBeenCalled();
  });
});
