/**
 * @name Sensitive data in error messages
 * @description Detects tokens, API responses, or credentials in error messages that may be logged
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision medium
 * @id routomil/sensitive-data-in-errors
 * @tags security
 *       external/cwe/cwe-209
 *       external/cwe/cwe-532
 */

import javascript

from NewExpr errorExpr, Variable v, string message
where
  // Detect Error constructor with sensitive variable
  errorExpr.getCallee().(VarAccess).getName().matches("%Error%") and
  v.getAnAccess() = errorExpr.getAnArgument() and
  (
    v.getName().toLowerCase().matches("%token%") or
    v.getName().toLowerCase().matches("%response%") or
    v.getName().toLowerCase().matches("%credential%") or
    v.getName().toLowerCase().matches("%cookie%")
  ) and
  message = "Sensitive variable '" + v.getName() + "' included in Error constructor. Errors may be logged or displayed."
select errorExpr, message
