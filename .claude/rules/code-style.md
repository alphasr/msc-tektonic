## CORE PRIORITIES (IN ORDER)

1. **Correctness**
2. **Clarity**
3. **Long-term maintainability**
4. **Consistency with existing patterns**

Speed, cleverness, or novelty must *never* override these priorities.

---

## CHANGE DISCIPLINE

- Every change must:
  - Address the **actual root cause**, not symptoms
  - Have a **clear, defensible rationale**
- Avoid:
  - One-off logic, hacks, or workarounds that bypass established systems
  - Partial fixes that shift the problem elsewhere
- If a solution feels ad-hoc, **stop and redesign**.
- When fixing a bug, verify the fix doesn't introduce regressions in related paths.

---

## CONSISTENCY & REUSE (STRICT)

Before writing any new code:
1. Search the codebase for existing implementations
2. Check `src/components/`, `src/lib/`, and `src/hooks/` for reusable logic
3. Check existing patterns for data fetching, error handling, and state

Rules:
- **Never reimplement existing logic.** Prefer extension or reuse over duplication.
- If a pattern exists, **follow it** - even if another approach seems simpler.
- If you believe an existing pattern is wrong, flag it. Do not silently deviate.

---

## NAMING CONVENTIONS

**Files & Folders**
- React components: `PascalCase.tsx` - e.g. `UserCard.tsx`
- Hooks: `camelCase.ts` prefixed with `use` - e.g. `useUserData.ts`
- Utilities/helpers: `camelCase.ts` - e.g. `formatDate.ts`
- Constants: `SCREAMING_SNAKE_CASE` inside `camelCase.ts` files
- Next.js routes follow App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`

**Variables & Functions**
- Boolean variables: prefix with `is`, `has`, `can`, `should` - e.g. `isLoading`, `hasError`
- Event handlers: prefix with `handle` - e.g. `handleSubmit`, `handleChange`
- Async functions: use verb phrases - e.g. `fetchUser`, `createPost`
- Avoid abbreviations unless universally understood (`id`, `url`, `api`)

**Types & Interfaces**
- Use `PascalCase`: `UserProfile`, `ApiResponse<T>`
- Prefer `interface` for object shapes, `type` for unions/intersections
- No `I` prefix on interfaces

---

## TYPESCRIPT

- **No `any`**. Use `unknown` and narrow it, or define a proper type.
- Avoid type assertions (`as X`) unless there is no alternative - comment why when used.
- Prefer explicit return types on exported functions and hooks.
- Use generics to avoid duplication across similar types.
- Colocate types with the code that owns them. Shared types go in `src/types/`.

---

## REACT & NEXT.JS CONVENTIONS

**Components**
- One component per file.
- Keep components focused - if it needs a long comment to explain what it does, split it.
- Prefer Server Components by default in the App Router. Use `'use client'` only when required (event handlers, hooks, browser APIs).
- Do not add `'use client'` to layouts or pages unless necessary - push it down to the smallest possible subtree.

**Props**
- Define props as a named `interface` directly above the component.
- Destructure props in the function signature.
- Avoid passing raw objects when a specific shape suffices.

**Hooks**
- Extract stateful logic into custom hooks when it spans more than one component.
- Hooks must be pure with respect to their declared dependencies.
- Do not call hooks conditionally.

**Data Fetching**
- Fetch data in Server Components where possible.
- Use React Query / SWR for client-side data fetching - do not use raw `useEffect` + `useState` for async data.
- Co-locate fetching logic with the component that owns the data.

---

## IMPORT ORDERING

Enforce this order (separated by blank lines):

```
1. React / Next.js core imports
2. Third-party libraries
3. Internal aliases (@/components, @/lib, @/hooks, @/types)
4. Relative imports
5. Style imports (CSS modules, etc.)
```

---

## COMMENTS & CODE STYLE

- Prefer **self-explanatory code** over comments.
- Do **not** add comments that restate what the code already expresses.
- Add comments **only** when:
  - Intent is non-obvious
  - There are important constraints or edge cases
  - A workaround exists for an external limitation (link to issue/PR)

---

## SHARED COMPONENTS & BACKWARD COMPATIBILITY

- Shared components (`src/components/`) may be used across many contexts.
- You must:
  - Preserve backward compatibility - do not change existing prop signatures without instruction
  - Avoid breaking implicit contracts (default behavior, DOM structure consumers may depend on)
- If a breaking change is needed, flag it explicitly before proceeding.
- Extend via new optional props, not by modifying existing ones.

---

## IMPLEMENTATION SCOPE CONTROL

- Do not over-engineer. Do not introduce abstractions before they are needed twice.
- Each change should be: small, focused, and fully sufficient to solve the problem.
- Always consider **downstream impact** - who else calls this function, renders this component, or depends on this type.
- If a change grows beyond its original scope, stop and discuss before continuing.
