/**
 * Security Concepts Library for Routomil Chrome Extension
 * Provides shared predicates for detecting sensitive data patterns,
 * Chrome extension APIs, and common security vulnerabilities.
 */

import javascript

/**
 * Predicate: Identifies sensitive variable/property names
 * Matches: token, csrf, cookie, credential, password, secret, key, session
 */
predicate isSensitiveIdentifier(string s) {
  exists(string pattern |
    pattern = "(?i).*(token|csrf|cookie|credential|password|secret|key|session).*" and
    s.regexpMatch(pattern)
  )
}

/**
 * Predicate: Identifies sensitive data values (variables or properties)
 */
predicate isSensitiveData(Expr expr) {
  exists(Variable v |
    expr = v.getAnAccess() and
    isSensitiveIdentifier(v.getName())
  )
  or
  exists(PropAccess prop |
    expr = prop and
    isSensitiveIdentifier(prop.getPropertyName())
  )
}

/**
 * Predicate: Identifies console.log calls
 */
predicate isConsoleLog(CallExpr call) {
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.getPropertyName() = "log" and
    prop.getBase().(VarAccess).getName() = "console"
  )
}

/**
 * Predicate: Identifies chrome.storage API calls
 */
predicate isChromeStorageApi(CallExpr call) {
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.toString().regexpMatch("chrome\\.storage\\.(local|sync|managed)\\.(get|set).*")
  )
}

/**
 * Predicate: Identifies chrome.cookies API calls
 */
predicate isChromeCookiesApi(CallExpr call) {
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.toString().regexpMatch("chrome\\.cookies\\.(get|getAll|set).*")
  )
}

/**
 * Predicate: Identifies innerHTML assignments
 */
predicate isInnerHtmlAssignment(Assignment assign) {
  exists(PropAccess prop |
    assign.getLhs() = prop and
    (prop.getPropertyName() = "innerHTML" or prop.getPropertyName() = "outerHTML")
  )
}

/**
 * Predicate: Identifies crypto API operations
 */
predicate isCryptoOperation(CallExpr call) {
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.toString().regexpMatch("crypto\\.(subtle\\.)?.*")
  )
}

/**
 * Predicate: Identifies Error constructor calls
 */
predicate isErrorCreation(NewExpr newExpr) {
  newExpr.getCallee().(VarAccess).getName().regexpMatch(".*(Error|Exception)")
}

/**
 * Predicate: Identifies throw statements
 */
predicate isThrowStatement(ThrowStmt throw) {
  any()
}

/**
 * Predicate: Identifies potential user-controlled sources (DOM)
 */
predicate isUserControlledSource(Expr expr) {
  // DOM element access
  expr instanceof PropAccess and
  expr.(PropAccess).getPropertyName().regexpMatch("(innerHTML|outerHTML|textContent|value|innerText)")
  or
  // Document methods that return user-controlled data
  exists(MethodCallExpr call |
    expr = call and
    call.getMethodName().regexpMatch("(querySelector|getElementById|getElementsBy.*)")
  )
  or
  // URL parameters
  exists(PropAccess prop |
    expr = prop and
    prop.toString().regexpMatch(".*(searchParams|location\\.search|location\\.hash).*")
  )
}

/**
 * Predicate: Identifies API response data (potentially sensitive)
 */
predicate isApiResponseData(Expr expr) {
  exists(Variable v |
    expr = v.getAnAccess() and
    v.getName().regexpMatch("(?i).*(response|result|data|body).*")
  )
}

/**
 * Predicate: Identifies encryption key storage
 */
predicate isEncryptionKeyStorage(CallExpr call) {
  isChromeStorageApi(call) and
  exists(Expr arg |
    arg = call.getAnArgument() and
    exists(string s |
      s = arg.toString() and
      s.regexpMatch("(?i).*(key|encryptionKey).*")
    )
  )
}

/**
 * Predicate: Identifies crypto.getRandomValues calls
 */
predicate isRandomBytesGeneration(CallExpr call) {
  exists(PropAccess prop |
    prop = call.getCallee() and
    prop.toString() = "crypto.getRandomValues"
  )
}

/**
 * Predicate: Identifies IV (Initialization Vector) related code
 */
predicate isIvRelated(Expr expr) {
  exists(Variable v |
    expr = v.getAnAccess() and
    v.getName().regexpMatch("(?i).*iv.*")
  )
}

/**
 * Predicate: Identifies CSRF token extraction patterns
 */
predicate isCsrfTokenExtraction(Expr expr) {
  exists(Variable v |
    expr = v.getAnAccess() and
    v.getName().regexpMatch("(?i).*(csrf|xsrf).*token.*")
  )
  or
  exists(PropAccess prop |
    expr = prop and
    prop.getPropertyName().regexpMatch("(?i).*(csrf|xsrf).*")
  )
}
