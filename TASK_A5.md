---
name: "A5: Extract TaskBoard context menu wiring"
description: Create QuickActionService to DRY up duplicate context menu registration and runQuickAction logic
type: feature
---

# A5: Extract TaskBoard context menu wiring

## Goal

Extract duplicate context menu registration logic and the 50-line `runQuickAction()` function into a dedicated `QuickActionService`. This eliminates DRY violations in `main.ts` and makes quick-action patterns testable in isolation.

## Scope

### Current State

In `main.ts` (~458 lines):
1. `showTaskContextMenu()` — registers context menu with action items
2. `registerNativeContextMenus()` — duplicates similar menu registration logic
3. `runQuickAction()` — 50-line function that resolves action path and executes

The menu items and action resolution are hardcoded and repeated in multiple places.

### What to Extract

Create `src/integration/QuickActionService.ts`:

```typescript
export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  action: (task: Task, currentFilePath?: string) => Promise<void> | void;
}

export interface QuickActionCallbacks {
  openTask?: (task: Task) => Promise<void>;
  createTask?: (parent?: Task) => Promise<void>;
  // ... other callbacks
}

export class QuickActionService {
  /**
   * Build array of menu items for a task context menu.
   * Returns flat list of actions that can be displayed as menu items.
   */
  buildQuickActionMenuItems(
    task: Task,
    callbacks: QuickActionCallbacks,
  ): QuickAction[] {
    // Return standard actions: open, complete, defer, block, duplicate, etc.
  }
  
  /**
   * Resolve the target path for a quick action.
   * Maps action type to actual task/file reference.
   */
  resolveQuickActionTarget(
    action: string,
    currentTask: Task,
    fallbackTask?: Task,
  ): { taskId: string; path: string } | null {
    // Return resolved task ID and path, or null if unresolvable
  }
  
  /**
   * Execute a quick action on a task.
   * Handles path resolution and delegates to appropriate callback.
   */
  async executeQuickAction(
    action: string,
    currentTask: Task,
    callbacks: QuickActionCallbacks,
  ): Promise<void> {
    // Resolve target, call appropriate callback
  }
}
```

### Integration Point

In `main.ts`:

```typescript
// Before: showTaskContextMenu() had 30 lines of menu building
// After:
const quickActionService = new QuickActionService();

async function showTaskContextMenu(task: Task) {
  const menu = new Menu();
  const actions = quickActionService.buildQuickActionMenuItems(task, {
    openTask: async (t) => { /* open in editor */ },
    createTask: async (parent) => { /* create modal */ },
    // ...
  });
  
  actions.forEach(action => {
    menu.addItem(item => {
      item.setTitle(action.label);
      item.setIcon(action.icon);
      item.onClick(async () => {
        await quickActionService.executeQuickAction(
          action.id,
          task,
          { openTask, createTask, /* ... */ }
        );
      });
    });
  });
  
  menu.showAtMousePos();
}
```

## Deliverables

1. **`src/integration/QuickActionService.ts`** (150–200 lines)
   - `QuickAction` and `QuickActionCallbacks` interfaces
   - `buildQuickActionMenuItems()` method
   - `resolveQuickActionTarget()` method
   - `executeQuickAction()` method
   - Testable, pure functions (no Obsidian imports)

2. **`src/main.ts`** (refactored, 408 lines)
   - Remove duplicate menu registration logic
   - Remove 50-line `runQuickAction()` function
   - Instantiate `quickActionService = new QuickActionService()`
   - Update `showTaskContextMenu()` to use service
   - Update `registerNativeContextMenus()` to use service
   - Call service methods instead of inline logic

3. **`src/integration/QuickActionService.test.ts`** (new, 8+ tests)
   - Test `buildQuickActionMenuItems()` returns expected actions
   - Test `resolveQuickActionTarget()` resolves paths correctly
   - Test `executeQuickAction()` calls correct callback
   - Test edge cases: invalid action, missing task, null target

4. **No behavior change** — all context menus work identically

## Acceptance Criteria

### Functionality
- [ ] Context menus appear on right-click (same as before)
- [ ] All quick actions available in menu (open, complete, defer, block, duplicate, etc.)
- [ ] Clicking action executes expected behavior
- [ ] Path resolution works for standard actions (current task, parent, dependencies)
- [ ] No regressions in menu UX or performance

### Code Quality
- [ ] QuickActionService: 0 TypeScript errors
- [ ] main.ts: 0 TypeScript errors (duplicate logic removed)
- [ ] All tests pass (8+ tests)
- [ ] main.ts reduced by ~50 lines (runQuickAction removed, menu logic condensed)
- [ ] No Obsidian imports in QuickActionService (pure logic)

### Verification
- [ ] Build: `npm run build` succeeds, zero errors
- [ ] Tests: `npm run test` passes, 440+ tests passing
- [ ] Manual: Right-click task in board/list → menu appears
- [ ] Manual: Click "Open", "Complete", "Defer" → works correctly
- [ ] Manual: Duplicate task → creates new task with same fields

## Code Hints

### Where to Look

1. **Current showTaskContextMenu()** (~30 lines):
   - Search in `main.ts` for `showTaskContextMenu(task: Task)`
   - Contains menu building logic
   - This becomes a simple wrapper around QuickActionService

2. **Current registerNativeContextMenus()** (~60 lines):
   - Search in `main.ts` for `registerNativeContextMenus()`
   - Registers Obsidian context menu hook
   - Similar menu items and logic that duplicates showTaskContextMenu
   - Extract common part to service

3. **Current runQuickAction()** (~50 lines):
   - Search for `function runQuickAction(action, task)`
   - Handles path resolution and callback dispatch
   - This becomes `executeQuickAction()` in service

4. **Quick action types**:
   - Look for: 'open', 'complete', 'defer', 'block', 'duplicate'
   - These become action IDs in QuickActionService
   - Each maps to a callback

### Implementation Order

1. Create `QuickActionService.ts`:
   - Define interfaces: `QuickAction`, `QuickActionCallbacks`
   - Implement `buildQuickActionMenuItems()` — list standard actions
   - Implement `resolveQuickActionTarget()` — map action to target
   - Implement `executeQuickAction()` — dispatch to callback
   
2. Create comprehensive test suite:
   - Test each action type
   - Test path resolution
   - Test callback dispatch
   
3. Update `main.ts`:
   - Remove `runQuickAction()` function (50 lines)
   - Remove duplicate menu registration
   - Use QuickActionService for all menu building
   - Tests should guide integration
   
4. Run tests; verify all pass
5. Run `npm run build`

## Gotchas

### Callback Dependencies

- QuickActionService doesn't know about `TaskStore`, `settingsService`, etc.
- All implementation lives in callbacks passed to service
- Service just dispatches actions based on action ID

**Pattern**: Service is pure logic layer, `main.ts` provides context via callbacks

### Path Resolution Complexity

Some actions may need to resolve complex paths:
- "Open" → current task file
- "Duplicate" → create new task
- "View parent" → navigate to parent task
- "View dependency" → navigate to dependent task

**Solution**: Each action callback handles its own path logic. Service just identifies which action was chosen.

### No Breaking Changes

- All existing actions must still work
- Menu items must appear in same order/format
- Behavior must be identical

Test this by:
1. Right-click task before refactor → note menu items
2. Right-click task after refactor → should be identical

### Type Safety

QuickActionCallbacks has many properties (one per action type). If adding new action:
1. Add property to QuickActionCallbacks interface
2. Pass callback in main.ts
3. Service calls it when action is triggered

## Dependencies

- **No prior refactoring required** — A5 can run independently
- **Can run in parallel with**: A6 (different systems)

## Related Issues

- Duplicate context menu registration in registerNativeContextMenus and showTaskContextMenu
- runQuickAction is monolithic (50 lines of path resolution + dispatch)
- No way to test action logic in isolation (coupled to Obsidian UI)
- Hard to add new quick actions (would need to modify multiple functions)

---

## Example Quick Actions to Extract

```typescript
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'open',
    label: 'Open',
    icon: 'external-link',
    action: (task, callbacks) => callbacks.openTask?.(task),
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: 'check',
    action: async (task, callbacks) => {
      // Mark complete and show success
    },
  },
  {
    id: 'defer',
    label: 'Defer (push due date)',
    icon: 'calendar-arrow-right',
    action: async (task, callbacks) => {
      // Show date picker or apply default defer (e.g., +1 day)
    },
  },
  // ... more actions
];
```

Each action is independent and testable.
