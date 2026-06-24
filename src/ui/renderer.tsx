/**
 * Ink render helper.
 *
 * Provides a thin wrapper around Ink's `render()` that handles
 * cleanup (unmount) when the component tree is disposed.
 */

import { render as inkRender } from "ink";
import type { ReactNode } from "react";

let currentInstance: ReturnType<typeof inkRender> | null = null;

/**
 * Render a React element to the terminal via Ink.
 *
 * If a previous render is still mounted it will be unmounted first,
 * so callers can safely call `renderUI` multiple times.
 */
export function renderUI(element: ReactNode): void {
  // Unmount any previous instance to avoid "already running" errors
  if (currentInstance) {
    currentInstance.unmount();
    currentInstance = null;
  }

  currentInstance = inkRender(element);
}

/**
 * Unmount the currently-rendered Ink tree, if any.
 *
 * Call this before the process exits to restore the terminal to its
 * original state.
 */
export function cleanupUI(): void {
  if (currentInstance) {
    currentInstance.unmount();
    currentInstance = null;
  }
}

/**
 * Return a promise that resolves when the current Ink render exits
 * on its own (e.g. the user presses Ctrl+C or the component calls
 * `process.exit()` internally).
 */
export function waitUntilExit(): Promise<void> {
  return currentInstance ? currentInstance.waitUntilExit().then(() => undefined) : Promise.resolve();
}
