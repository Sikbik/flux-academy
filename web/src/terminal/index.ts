/**
 * The sandbox terminal. Import the view and the engine from here.
 *
 *   import { TerminalView, GoalTracker, createSession } from '@/terminal';
 */
export * from './engine';
export { SCENARIOS, type ScenarioMeta, scenarioById } from './scenarios';
export { makeSolver, type TerminalHandle, TerminalView, type TerminalViewProps } from './TerminalView';
export { GoalTracker, type GoalTrackerProps } from './view/GoalTracker';
export { renderInline } from './view/inline';
export { scriptSignature, useTerminalSession } from './view/useTerminalSession';
