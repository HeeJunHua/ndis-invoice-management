## Path Formatting Rules (Windows)

- ALWAYS use forward slashes (`/`) for file paths in file edit tools (e.g., Edit, MultiEdit, Write).
- NEVER use backslashes (`\`) or double backslashes (`\\`) in tool arguments for path targeting.

### Examples:
- CORRECT: `src/components/UsersPage.tsx`
- CORRECT: `app/api/users/[id]/route.ts`
- INCORRECT: `src\components\UsersPage.tsx`
- INCORRECT: `app\\api\\users\\[id]\\route.ts`

### Reason:
Windows pathing in node-based tool suites fails to match edit blocks when backslashes are used instead of normalized POSIX forward slashes.