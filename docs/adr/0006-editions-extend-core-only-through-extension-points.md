# Editions extend the Core only through switches, extension points and decor

An Edition can change what it gets from the Core in three ways only:

- turn Core features on or off with Feature Switches;
- plug its own behaviour or UI into Extension Points the Core defines (Game modes, Word card sections, language services);
- supply Decor and design tokens.

It can never replace Core files or whole screens. The rule for anything an Edition needs: if it is useful to every Edition, it goes into the Core behind a Feature Switch; otherwise it goes in through an Extension Point, and if no Extension Point fits, we add one to the Core first.

## Considered Options

- **Free override of any Core file or screen per Edition**: rejected. With many Editions it turns the factory into N silent forks, where every Core change risks breaking some Edition unnoticed.
