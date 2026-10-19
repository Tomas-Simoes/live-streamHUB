/** Phi needs bounded inter-field whitespace to finish instead of stalling.
 * The runtime still validates the resulting JSON with the ordinary review schema.
 */
export const HUB_IMAGE_REVIEW_GRAMMAR = String.raw`
root ::= ws "{" ws "\"issues\"" ws ":" ws "[" ws (issue (ws "," ws issue)?)? ws "]" ws "," ws "\"approved\"" ws ":" ws boolean ws "," ws "\"score\"" ws ":" ws score ws "," ws "\"summary\"" ws ":" ws summary ws "}" ws
issue ::= "{" ws "\"target\"" ws ":" ws target ws "," ws "\"problem\"" ws ":" ws problem ws "," ws "\"action\"" ws ":" ws action ws "}"
target ::= "\"scoreboard\"" | "\"players\"" | "\"branding\"" | "\"overall\""
boolean ::= "true" | "false"
score ::= [0-4] ("." [0-9])? | "5"
summary ::= "\"" [^"\\\x00-\x1f]{1,200} "\""
problem ::= "\"" [^"\\\x00-\x1f]{1,95} "\""
action ::= "\"" [^"\\\x00-\x1f]{1,135} "\""
ws ::= [ \n\r\t]{0,2}
`;
