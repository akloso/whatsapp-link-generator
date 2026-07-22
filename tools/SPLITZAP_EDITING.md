# Splitzap editing

Do not edit these files manually:

```text
public/splitzap-assets/chunk-*.js
```

They are generated files.

## First-time setup

Run this once to create the editable source HTML from the currently hosted Splitzap chunks:

```bash
npm run splitzap:extract
```

This creates:

```text
tools/splitzap-source.html
```

## Future changes

1. Edit only:

```text
tools/splitzap-source.html
```

2. Rebuild hosted files:

```bash
npm run splitzap:build
```

3. Commit the changed files.

## What gets generated

```text
public/splitzap-app.html
public/splitzap-assets/chunk-00.js
public/splitzap-assets/chunk-01.js
...
```

## Simple rule

- Calculator changes: edit `tools/splitzap-source.html`
- Header/footer/menu changes: edit React files
- Never manually edit chunk files
