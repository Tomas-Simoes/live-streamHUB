/** Phi needs bounded inter-field whitespace to finish instead of stalling.
 * The runtime still validates the resulting JSON with the ordinary review schema.
 */
export const HUB_IMAGE_REVIEW_GRAMMAR = String.raw`
root ::= ws "{" ws "\"issues\"" ws ":" ws "[" ws (issue (ws "," ws issue)?)? ws "]" ws "," ws "\"approved\"" ws ":" ws boolean ws "," ws "\"comparison\"" ws ":" ws comparison ws "," ws "\"resolved\"" ws ":" ws texts ws "," ws "\"regressions\"" ws ":" ws texts ws "," ws "\"summary\"" ws ":" ws summary ws "}" ws
issue ::= "{" ws "\"target\"" ws ":" ws target ws "," ws "\"problem\"" ws ":" ws problem ws "," ws "\"criterion\"" ws ":" ws summary ws "," ws "\"evidence\"" ws ":" ws summary ws "," ws "\"action\"" ws ":" ws action ws "}"
target ::= "\"scoreboard\"" | "\"players\"" | "\"branding\"" | "\"overall\""
boolean ::= "true" | "false"
comparison ::= "\"initial\"" | "\"improved\"" | "\"unchanged\"" | "\"worse\"" | "\"uncertain\""
texts ::= "[" ws (summary (ws "," ws summary)?)? ws "]"
summary ::= "\"" [^"\\\x00-\x1f]{1,200} "\""
problem ::= "\"" [^"\\\x00-\x1f]{1,95} "\""
action ::= "\"" [^"\\\x00-\x1f]{1,135} "\""
ws ::= [ \n\r\t]{0,2}
`;
