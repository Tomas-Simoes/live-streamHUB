/** Grade actual user-visible outcomes. A preserved relationship does not require
 * the interpreter to emit a redundant operation/check for that relationship. */
export function gradeIntentScenario(result, index, scenarios) {
  const intent = result.metrics.understoodRequest;
  const rendered = result.metrics.attempts.findLast(attempt => attempt.rendered)?.rendered;
  const previous = scenarios[index - 1];
  const before = previous?.metrics.attempts.findLast(attempt => attempt.rendered)?.rendered;
  const has = (check, target) => intent?.changes.some(change => change.check === check && (!target || change.target === target));
  const tables = rendered?.frames.filter(frame => frame.role === 'players') ?? [];
  const ratio = rendered?.rosterDetails?.length === 2 && rendered.rosterDetails.every(row => row.itemMax > 0 && row.portraitMin >= row.itemMax * 1.12);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const textDirection = sign => ['names', 'cs', 'kda'].map(role => {
    const a = rendered?.fonts.find(font => font.role === role), b = before?.fonts.find(font => font.role === role);
    return a && b ? (a.minPx - b.minPx) * sign : NaN;
  });
  const firstColour = gradient => gradient.match(/(?:rgba?|color)\([^)]*\)/)?.[0];
  const checks = {
    valid: !result.error,
    data: result.portraits === 10 && result.items === 60,
    interpreted: !!intent,
    measured: rendered?.viewport[0] === 1280 && rendered?.viewport[1] === 720,
    fulfilled: result.metrics.requestChecks?.every(check => check.status !== 'failed') ?? false,
    readable: result.design720?.overflow.length === 0 && result.design1080?.overflow.length === 0,
    bounded: result.metrics.totalMs < 300000,
    joinedBottom: tables.length === 2 && Math.abs(rendered.tableGapPx ?? Infinity) <= 2
      && tables.every(frame => Math.abs(frame.y + frame.height - rendered.viewport[1]) <= 2),
  };
  if (index === 0) {
    const design = result.metrics.composition;
    const rgb = hex => [1, 3, 5].map(n => parseInt(hex.slice(n, n + 2), 16));
    const [r, g, b] = rgb(design.colors.teamLeft), [rr, rg, rb] = rgb(design.colors.teamRight);
    checks.requestedStyle = design.panels.teamSections && design.typography.headingFont === 'Impact'
      && r < g * .65 && g >= b * .95 && rr > rg && rg > rb * 1.3;
  } else {
    checks.iconHierarchy = !!ratio;
    checks.gradientChanged = result.design1080.teamBackgrounds.every((fill, i) => fill.includes('linear-gradient') && fill !== previous.design1080.teamBackgrounds[i]);
    checks.preservedFamilies = equal(result.design720.typography.map(font => font.font), previous.design720.typography.map(font => font.font));
    checks.preservedTeamHues = equal(result.design720.statColors, previous.design720.statColors)
      && result.design1080.teamBackgrounds.every((fill, i) => firstColour(fill) === firstColour(previous.design1080.teamBackgrounds[i]));
    const direction = textDirection(index === 1 ? -1 : 1);
    checks.textSize = direction.every(diff => diff >= -.15) && direction.some(diff => diff > .3);
    if (index === 1) {
      checks.interpretedChanges = ['half-screen-width', 'team-gradient', 'smaller-portraits', 'portraits-larger-than-items', 'smaller-text', 'fine-separators'].every(check => has(check))
        && has('shorter', 'players') && has('shorter', 'scoreboards');
      checks.compact = Math.abs(result.proposed.scoreboardWidth - 960) < 48
        && result.design720.frames[0][3] < previous.design720.frames[0][3]
        && result.design720.frames.slice(1).every((frame, i) => frame[3] < previous.design720.frames[i + 1][3]);
      checks.fineSeparators = rendered.rosterDetails.every(row => row.separator > 0 && row.separator <= .8);
    } else {
      checks.interpretedChanges = ['team-gradient', 'larger-portraits', 'portraits-larger-than-items', 'larger-text'].every(check => has(check));
      checks.portraitsEnlarged = rendered.rosterDetails.every((row, i) => row.portraitMin > before.rosterDetails[i].portraitMin + .3);
    }
  }
  return { passed: Object.values(checks).every(Boolean), checks };
}
