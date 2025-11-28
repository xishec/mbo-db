# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    # MBO DB Application

    ## Overview

    React + TypeScript + Vite application for managing and exploring band capture data with Firebase backend.

    ## Development

    Install dependencies and start dev server:

    ```bash
    npm install
    npm run dev
    ```

    Build production bundle:

    ```bash
    npm run build
    ```

    ## Advanced Table Filters (Captures View)

    The `Captures` view supports multi-filter advanced searching in addition to global search and species dropdown.

    How to add a filter:
    1. Choose a Column.
    2. Pick an Operator.
    3. (If required) Enter a Value.
    4. Click Add.

    Active filters show as chips; remove individually with the close icon or all at once with Clear.

    Supported operators:
    - Text columns: `contains`, `starts`, `ends`, `=`, `≠`
    - Numeric columns (`WingChord`, `Weight`, `D18`, `D20`, `D22`): `>`, `>=`, `<`, `<=`, plus `=` / `≠`
    - Presence: `exists`, `not exists`

    Filter logic: all active filters AND together, then AND with species filter and free-text search. Sorting and pagination apply to the filtered result set.

    To extend filters (e.g., date ranges), add a new operator and case inside `evaluateFilter` in `src/components/Captures.tsx`.

    ## Linting & Type Checking

    Run ESLint:
    ```bash
    npm run lint
    ```

    The project uses TypeScript project references (`tsconfig.app.json`, `tsconfig.node.json`).

    ## Original Vite Template Notes

    The underlying template started from the standard React + Vite setup. For React compiler guidance, see official docs: https://react.dev/learn/react-compiler/installation

    For expanding ESLint configuration with type-aware rules:

    ```js
    export default defineConfig([
      globalIgnores(['dist']),
      {
        files: ['**/*.{ts,tsx}'],
        extends: [
          tseslint.configs.recommendedTypeChecked,
          // or tseslint.configs.strictTypeChecked,
          tseslint.configs.stylisticTypeChecked,
        ],
        languageOptions: {
          parserOptions: {
            project: ['./tsconfig.node.json', './tsconfig.app.json'],
            tsconfigRootDir: import.meta.dirname,
          },
        },
      },
    ])
    ```

    React-specific lint plugins:

    ```js
    import reactX from 'eslint-plugin-react-x'
    import reactDom from 'eslint-plugin-react-dom'
    ```

    Add them to your extends array as needed.
