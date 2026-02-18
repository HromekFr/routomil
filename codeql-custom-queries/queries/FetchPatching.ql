/**
 * @name Fetch API monkey-patching
 * @description Detects monkey-patching of window.fetch, which can intercept all network requests. This is intentional in extension content scripts but should be reviewed for each new occurrence.
 * @kind problem
 * @problem.severity recommendation
 * @security-severity 5.0
 * @precision high
 * @id routomil/fetch-patching
 * @tags security
 *       external/cwe/cwe-693
 */

import javascript

from Assignment assign, string message
where
  // Pattern 1: window.fetch = ... (direct assignment)
  (
    exists(PropAccess prop |
      prop = assign.getLhs() and
      prop.getPropertyName() = "fetch" and
      prop.getBase().(GlobalVarAccess).getName() = "window"
    ) and
    message = "window.fetch is being monkey-patched. This intercepts all network requests in the page context. Ensure this is intentional and that the patched function correctly forwards non-intercepted requests."
  )
  or
  // Pattern 2: Saving original fetch reference before patching
  // (e.g., const originalFetch = window.fetch)
  (
    exists(PropAccess prop, VariableDeclarator decl |
      decl.getInit() = prop and
      prop.getPropertyName() = "fetch" and
      prop.getBase().(GlobalVarAccess).getName() = "window" and
      assign = any(Assignment a |
        a.getLhs().(PropAccess).getPropertyName() = "fetch" and
        a.getLhs().(PropAccess).getBase().(GlobalVarAccess).getName() = "window" and
        a.getEnclosingStmt().getParentStmt*() = decl.getEnclosingStmt().getParentStmt*()
      )
    ) and
    message = "window.fetch is being monkey-patched (original saved for delegation). Ensure the patched function correctly handles all request types and error cases."
  )
select assign, message
