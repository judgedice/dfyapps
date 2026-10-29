/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUBMIT_URL?: string;
  /** Which survey in src/surveys/ to build. Defaults to workflow-survey. */
  readonly VITE_SURVEY?: string;
}
