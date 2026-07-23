# TypeScript & React Style Guide: StudyOS

## File & Folder Conventions

```
src/
  App.tsx                          # Root component (orchestrates windows, dock, boot)
  main.tsx                         # React entry point (StrictMode, createRoot)
  index.css                        # Global styles (Tailwind imports, glass utilities)
  components/
    ComponentName.tsx              # PascalCase for component files
  utils/
    camelCase.ts                   # camelCase for utility/files
    utility.test.ts                 # Co-located tests with .test.js/.test.ts suffix
```

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `PomodoroTimer`, `StatusBar` |
| Component Props | PascalCase + `Props` suffix | `WindowProps`, `DockProps` |
| Utility functions | camelCase | `loadState`, `processNeelaAction` |
| Types/Interfaces | PascalCase | `StudyState`, `SubjectTask`, `ChatMessage` |
| Type aliases | PascalCase | `TaskType`, `Subject`, `AppId` |
| Constants | UPPER_SNAKE_CASE | `STORAGE_KEY`, `GROQ_KEYS` |
| CSS classes | kebab-case | `window-titlebar`, `desktop-icon`, `glass-dark` |
| Files | camelCase (utils), PascalCase (components) | `studyStore.ts`, `Browser.tsx` |

## TypeScript Strictness

- `strict: true` in tsconfig — always use strict types
- `noUnusedLocals: true`, `noUnusedParameters: true`
- Avoid `any` type — use proper types or `unknown` with narrowing
- `@ts-ignore` is tolerated only for Electron API calls where types are unavailable

## Component Patterns

```tsx
// Functional components with explicit return types
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks at top
  const [state, setState] = useState<Type>(initialValue);
  
  // Callbacks wrapped in useCallback when passed as props
  const handleAction = useCallback(() => {
    // ...
  }, [deps]);

  // Effects at bottom
  useEffect(() => {
    // ...
    return () => cleanup;
  }, [deps]);

  // Return JSX
  return (
    <div>
      {/* Structure */}
    </div>
  );
};

export default ComponentName;
```

## State Management

- **Global state**: StudyStore via `localStorage` (`studyos_data_v3` key)
- **Loading pattern**: `loadState()` on mount, pass `studyState` + `setStudyState` as props to children
- **Saving**: `useEffect` watches `studyState` changes and calls `saveState()`
- **AI actions**: `processNeelaAction()` parses `[ACTION]` blocks from AI responses and mutates state

## Styling

- **Framework**: Tailwind CSS 4 (imported via `@import "tailwindcss"`)
- **Utilities**: Custom `cn()` function from `src/utils/cn.ts` (clsx + tailwind-merge)
- **Glassmorphism**: Use `.glass`, `.glass-dark`, `.glass-lighter` CSS classes for frosted glass effects
- **Animations**: Framer Motion `motion.div` with spring transitions (`{ type: 'spring', stiffness: 400, damping: 30 }`)
- **Icons**: `lucide-react` icon library
- **Custom scrollbar**: Always via `::-webkit-scrollbar` pseudo-elements
- **Colors**: Use `rgba()` with opacity rather than Tailwind opacity modifiers for glass effects

## Project-Specific Conventions

### Electron Bridge
```typescript
// Always check for Electron environment
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

// Use contextBridge methods
window.electronAPI.send('channel', data);    // fire-and-forget IPC
window.electronAPI.invoke('channel', data);  // async IPC (returns Promise)
```

### Window Management (App.tsx pattern)
- Windows managed via `AppWindowState[]` array with `isOpen`, `isMinimized`, `zIndex`
- App config defined in `APP_CONFIG` Record with title, icon, color, size, position
- Dock icons defined separately in `DOCK_ICONS` Record
- Z-index managed via a global counter (`zCounter++`)

### AI Action Protocol
AI responses can include structured `[ACTION]` JSON blocks:
```
[ACTION]
{ "type": "ADD_TASKS", "payload": [...] }
[/ACTION]
```
The UI parses these in `processNeelaAction()` and applies mutations to `StudyState`.

### Kiosk Safety
- Always pair destructive operations with recovery handlers
- `explorer.exe` kill/restore via `child_process.exec`
- Check `IS_KIOSK` flag before executing shell changes

## Imports Ordering

1. React / external libraries
2. Lucide icons (destructured)
3. Local components
4. Local utilities
5. CSS imports

## Testing

- Tests co-located next to source files: `studyStore.test.js`, `neelaBrain.test.js`
- No testing framework explicitly listed — likely Vitest or Jest patterns
