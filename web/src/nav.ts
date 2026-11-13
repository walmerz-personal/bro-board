// Which screen is showing, and how each button changes it.

import type { Board, Category, Item } from './board';
import { paginate } from './board';

export type Screen =
  | { name: 'home'; page: number }
  | { name: 'items'; categoryId: string; page: number }
  | { name: 'message'; phrase: string; icon: string; categoryId: string }
  | { name: 'big'; phrase: string; icon: string; categoryId: string };

/** A stack of screens. The last one is showing. Back removes it. */
export type NavState = Screen[];

export type NavAction =
  | { type: 'openCategory'; category: Category }
  | { type: 'openItem'; item: Item }
  | { type: 'more' }
  | { type: 'showBig' }
  | { type: 'back' }
  | { type: 'home' };

export const initialNav: NavState = [{ name: 'home', page: 0 }];

export function current(state: NavState): Screen {
  return state[state.length - 1];
}

export function navReducer(board: Board, state: NavState, action: NavAction): NavState {
  const screen = current(state);
  switch (action.type) {
    case 'openCategory': {
      const { category } = action;
      if (category.items && category.items.length > 0) {
        return [...state, { name: 'items', categoryId: category.id, page: 0 }];
      }
      return [
        ...state,
        { name: 'message', phrase: category.phrase ?? category.label, icon: category.icon, categoryId: category.id },
      ];
    }
    case 'openItem': {
      const categoryId = screen.name === 'items' ? screen.categoryId : '';
      return [...state, { name: 'message', phrase: action.item.phrase, icon: action.item.icon, categoryId }];
    }
    case 'more': {
      // "More" swaps the page in place, so Back always goes up a level.
      if (screen.name === 'home') {
        const pages = paginate(board.categories).length;
        return [...state.slice(0, -1), { ...screen, page: (screen.page + 1) % pages }];
      }
      if (screen.name === 'items') {
        const items = board.categories.find((c) => c.id === screen.categoryId)?.items ?? [];
        const pages = paginate(items).length;
        return [...state.slice(0, -1), { ...screen, page: (screen.page + 1) % pages }];
      }
      return state;
    }
    case 'showBig':
      return screen.name === 'message'
        ? [...state, { name: 'big', phrase: screen.phrase, icon: screen.icon, categoryId: screen.categoryId }]
        : state;
    case 'back':
      if (state.length > 1) return state.slice(0, -1);
      // On the home screen, Back returns to the first page.
      return initialNav;
    case 'home':
      return initialNav;
  }
}
