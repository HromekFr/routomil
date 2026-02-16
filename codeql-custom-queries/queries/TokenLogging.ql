/**
 * @name Token or credential logging
 * @description Detects logging of sensitive tokens, credentials, cookies, or CSRF tokens to console
 * @kind problem
 * @problem.severity error
 * @security-severity 8.0
 * @precision high
 * @id routomil/token-logging
 * @tags security
 *       external/cwe/cwe-532
 */

import javascript

from CallExpr call, Expr arg, Variable v
where
  // Identify console.log calls
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.getPropertyName() = "log" and
    prop.getBase().(VarAccess).getName() = "console"
  ) and
  // Check if any argument is a variable with sensitive name
  arg = call.getAnArgument() and
  v.getAnAccess() = arg and
  (
    v.getName().toLowerCase().matches("%token%") or
    v.getName().toLowerCase().matches("%csrf%") or
    v.getName().toLowerCase().matches("%cookie%") or
    v.getName().toLowerCase().matches("%credential%") or
    v.getName().toLowerCase().matches("%password%") or
    v.getName().toLowerCase().matches("%secret%") or
    v.getName().toLowerCase().matches("%key%")
  )
select call,
  "Sensitive variable '" + v.getName() +
    "' is logged to console, which may expose tokens or credentials."
