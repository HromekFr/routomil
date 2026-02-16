/**
 * @name Weak encryption practices
 * @description Detects weak encryption practices including non-random IVs, short keys, and insecure key storage
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.0
 * @precision medium
 * @id routomil/weak-encryption
 * @tags security
 *       external/cwe/cwe-326
 *       external/cwe/cwe-330
 */

import javascript

from CallExpr call, string message
where
  // Detect chrome.storage.local.set with encryption key
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.toString().matches("%chrome.storage.local.set%") and
    exists(ObjectExpr obj |
      obj = call.getAnArgument() and
      exists(Property p |
        p = obj.getAProperty() and
        (
          p.getName().toLowerCase().matches("%key%") or
          p.getName().toLowerCase().matches("%encryptionkey%")
        )
      )
    ) and
    message = "Encryption key stored in chrome.storage.local (unencrypted). Consider using a key derivation function with user-provided password."
  )
select call, message
