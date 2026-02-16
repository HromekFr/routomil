/**
 * @name DOM-based XSS via innerHTML
 * @description Detects innerHTML assignments that may contain unsanitized data
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision medium
 * @id routomil/dom-xss
 * @tags security
 *       external/cwe/cwe-79
 */

import javascript

from Assignment assign
where
  // Detect innerHTML/outerHTML assignments
  exists(PropAccess prop |
    assign.getLhs() = prop and
    (prop.getPropertyName() = "innerHTML" or prop.getPropertyName() = "outerHTML")
  )
select assign,
  "innerHTML/outerHTML assignment detected. Ensure data is properly sanitized to prevent XSS."
