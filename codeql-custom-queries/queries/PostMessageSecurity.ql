/**
 * @name Insecure postMessage usage
 * @description Detects postMessage calls with wildcard target origin and message event listeners without origin validation
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.0
 * @precision medium
 * @id routomil/postmessage-security
 * @tags security
 *       external/cwe/cwe-345
 */

import javascript

from CallExpr call, string message
where
  // Pattern 1: postMessage with wildcard '*' target origin
  (
    exists(PropAccess prop |
      prop = call.getCallee() and
      prop.getPropertyName() = "postMessage" and
      call.getNumArgument() >= 2 and
      call.getArgument(1).(StringLiteral).getValue() = "*"
    ) and
    message = "postMessage() called with wildcard '*' target origin. This allows any window/frame to receive the message. Use a specific origin (e.g., 'https://mapy.cz') to restrict message recipients."
  )
  or
  // Pattern 2: addEventListener('message', ...) without origin check in the handler
  (
    exists(PropAccess prop, Function handler |
      prop = call.getCallee() and
      prop.getPropertyName() = "addEventListener" and
      call.getArgument(0).(StringLiteral).getValue() = "message" and
      handler = call.getArgument(1).(Function) and
      // Handler does not reference .origin anywhere in its body
      not exists(PropAccess originAccess |
        originAccess.getPropertyName() = "origin" and
        originAccess.getEnclosingFunction() = handler
      )
    ) and
    message = "Message event listener does not check event.origin. Without origin validation, any window can send messages to this handler. Add an origin check: if (event.origin !== expectedOrigin) return;"
  )
select call, message
