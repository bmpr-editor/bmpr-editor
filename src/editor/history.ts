import type { Page } from '../model/document';
export interface History {
  past: Page[][];
  present: Page[];
  future: Page[][];
}
export type Action =
  { type: 'reset'; pages: Page[] } | { type: 'commit'; pages: Page[] } | { type: 'undo' | 'redo' };
export function historyReducer(state: History, action: Action): History {
  if (action.type === 'reset') return { past: [], present: action.pages, future: [] };
  if (action.type === 'commit') {
    if (JSON.stringify(action.pages) === JSON.stringify(state.present)) return state;
    return { past: [...state.past.slice(-99), state.present], present: action.pages, future: [] };
  }
  if (action.type === 'undo' && state.past.length)
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1)!,
      future: [state.present, ...state.future],
    };
  if (action.type === 'redo' && state.future.length)
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  return state;
}
