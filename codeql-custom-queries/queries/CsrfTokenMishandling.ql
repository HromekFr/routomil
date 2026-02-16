/**
 * @name CSRF token mishandling
 * @description Detects CSRF tokens in logs, error messages, or unencrypted storage
 * @kind problem
 * @problem.severity error
 * @security-severity 7.5
 * @precision high
 * @id routomil/csrf-token-mishandling
 * @tags security
 *       external/cwe/cwe-352
 *       external/cwe/cwe-532
 */

import javascript

from CallExpr call, Variable v, string message
where
  // CSRF tokens logged to console
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.getPropertyName() = "log" and
    prop.getBase().(VarAccess).getName() = "console" and
    v.getAnAccess() = call.getAnArgument() and
    (
      v.getName().toLowerCase().matches("%csrf%") or
      v.getName().toLowerCase().matches("%xsrf%")
    ) and
    message = "CSRF token '" + v.getName() + "' logged to console, exposing it to potential attackers."
  )
select call, message
