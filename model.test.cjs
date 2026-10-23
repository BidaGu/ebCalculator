'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toDay, fromDay, shiftMonths, estimate } = require('./model.js');

function fixture(cutoffs, chartB = cutoffs) {
  return cutoffs.map((cutoff, index) => ({
    bulletin: shiftMonths('2026-05-01', index),
    ...Object.fromEntries(['EB1', 'EB2', 'EB3'].map(category => [category, {
      ROW: { a: cutoff, b: chartB[index] },
      CHINA: { a: cutoff, b: chartB[index] },
      INDIA: { a: cutoff, b: chartB[index] }
    }]))
  }));
}

function run(rows, priorityDate = '2024-08-01', region = 'CHINA') {
  return estimate({ rows, region, priorityDate });
}

const advancing = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01', '2024-06-01', '2024-07-01'];

test('uses seven observations for six intervals and forecasts from the latest bulletin', () => {
  const result = run(fixture(advancing));
  assert.equal(result.windowStart, '2026-05-01');
  assert.equal(result.windowEnd, '2026-11-01');
  assert.equal(result.windowMonths, 6);
  assert.equal(result.history.length, 7);
  assert.equal(result.charts.a.speedDaysPerMonth, 182 / 6);
  assert.equal(result.charts.a.gapDays, 31);
  assert.equal(result.charts.a.monthsToTarget, 31 / (182 / 6));
  assert.equal(result.charts.a.bulletinSteps, 2);
  assert.equal(result.charts.a.estimatedBulletin, '2027-01-01');
});

test('flat segments and intermediate retrogressions contribute to the signed endpoint rate', () => {
  const uneven = ['2024-01-01', '2024-01-01', '2024-04-01', '2023-12-01', '2024-04-01', '2024-04-01', '2024-07-01'];
  assert.equal(run(fixture(uneven)).charts.a.speedDaysPerMonth, 182 / 6);
});

test('all-flat and net-negative windows have no estimated bulletin', () => {
  const flat = run(fixture(Array(7).fill('2024-01-01'))).charts.a;
  assert.equal(flat.status, 'stalled');
  assert.equal(flat.speedDaysPerMonth, 0);
  assert.equal(flat.estimatedBulletin, null);
  const negative = run(fixture([...advancing].reverse())).charts.a;
  assert.equal(negative.status, 'retrogressing');
  assert.equal(negative.speedDaysPerMonth, -182 / 6);
  assert.equal(negative.monthsToTarget, null);
  assert.equal(negative.bulletinSteps, null);
});

test('equality and previously passed target dates are already reached even without full history', () => {
  const rows = fixture(advancing).slice(-1);
  for (const target of ['2024-07-01', '2024-06-30']) {
    const chart = run(rows, target).charts.a;
    assert.equal(chart.status, 'reached');
    assert.equal(chart.gapDays, 0);
    assert.equal(chart.monthsToTarget, 0);
    assert.equal(chart.bulletinSteps, 0);
    assert.equal(chart.estimatedBulletin, '2026-11-01');
  }
});

test('latest C and U have explicit independent chart states', () => {
  const a = [...advancing.slice(0, 6), 'currentPD'];
  const b = [...advancing.slice(0, 6), 'unauthorized'];
  const result = run(fixture(a, b));
  assert.equal(result.charts.a.status, 'current');
  assert.equal(result.charts.a.bulletinSteps, 0);
  assert.equal(result.charts.a.speedDaysPerMonth, null);
  assert.equal(result.charts.b.status, 'unavailable');
  assert.equal(result.charts.b.estimatedBulletin, null);
});

test('intermediate C, U, missing, and invalid cutoff dates invalidate only the affected chart', () => {
  for (const marker of ['currentPD', 'unauthorized', null, '2024-02-30']) {
    const a = [...advancing];
    a[3] = marker;
    const result = run(fixture(a, advancing));
    assert.equal(result.charts.a.status, 'insufficient');
    assert.equal(result.charts.a.speedDaysPerMonth, null);
    assert.equal(result.charts.a.estimatedBulletin, null);
    assert.equal(result.charts.b.status, 'projected');
  }
});

test('a missing month is insufficient even with an extra older observation', () => {
  const rows = fixture(advancing);
  rows.splice(3, 1);
  rows.unshift({ ...rows[0], bulletin: '2026-04-01' });
  assert.equal(run(rows).charts.a.status, 'insufficient');
  assert.equal(run(rows).windowStart, '2026-05-01');
  assert.equal(run(fixture(advancing).slice(1)).charts.a.status, 'insufficient');
});

test('duplicate monthly observations do not satisfy complete monthly coverage', () => {
  const rows = fixture(advancing);
  rows.push({ ...rows[2] });
  assert.equal(run(rows).charts.a.status, 'insufficient');
});

test('extra older history is excluded, latest is sorted, and input is not mutated', () => {
  const rows = fixture(advancing).reverse();
  rows.push({ ...rows[0], bulletin: '2020-01-01' });
  const original = JSON.stringify(rows);
  const result = run(rows);
  assert.equal(result.latestBulletin, '2026-11-01');
  assert.equal(result.history[0].bulletin, '2026-05-01');
  assert.equal(result.history.length, 7);
  assert.equal(JSON.stringify(rows), original);
  assert.equal(result.charts.a.status, 'projected');
});

test('monthly projection rounds up only when the target needs another bulletin', () => {
  // Six days of net advancement => exactly one cutoff day per bulletin month.
  const dates = Array.from({ length: 7 }, (_, index) => fromDay(toDay('2024-01-01') + index));
  assert.equal(run(fixture(dates), '2024-01-10').charts.a.bulletinSteps, 3);
  const fractional = ['2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-08'];
  assert.equal(run(fixture(fractional), '2024-01-15').charts.a.bulletinSteps, 6);
  assert.equal(run(fixture(fractional), '2024-01-16').charts.a.bulletinSteps, 7);
});

test('region selection uses the selected region and leaves the other inputs alone', () => {
  const rows = fixture(advancing);
  for (const row of rows) row.EB1.ROW = { a: 'currentPD', b: 'currentPD' };
  assert.equal(run(rows, '2024-08-01', 'ROW').charts.a.status, 'current');
  assert.equal(run(rows, '2024-08-01', 'INDIA').charts.a.status, 'projected');
});

test('a forecast beyond the supported calendar retains its observed rate without claiming a projection', () => {
  const slow = ['2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-02'];
  const result = run(fixture(slow), '9999-12-31').charts.a;
  assert.equal(result.status, 'insufficient');
  assert.equal(result.speedDaysPerMonth, 1 / 6);
  assert.equal(result.gapDays, toDay('9999-12-31') - toDay('2024-01-02'));
  assert.equal(result.monthsToTarget, null);
  assert.equal(result.bulletinSteps, null);
  assert.equal(result.estimatedBulletin, null);
  assert.match(result.reason, /outside the supported calendar years/);
});

test('calendar validation rejects malformed or normalized dates', () => {
  for (const value of ['2023-02-29', '2024-02-30', '2024-04-31', '2024-13-01', '2024-00-01', '2024-01-00', '0000-01-01', '2024-1-01', '2024-01-01T00:00:00Z', null]) {
    assert.throws(() => toDay(value), RangeError);
  }
  assert.throws(() => run(fixture(advancing), '2023-02-29'), RangeError);
  assert.throws(() => run([{ bulletin: '2026-02-30' }]), RangeError);
  assert.throws(() => run(fixture(advancing), '2024-08-01', 'MARS'), RangeError);
  assert.throws(() => run([]), RangeError);
  assert.throws(() => shiftMonths('2024-01-01', 1.5), RangeError);
  assert.throws(() => fromDay(1.5), RangeError);
});

test('UTC dates survive leap days, early years, and daylight-saving changes', () => {
  for (const value of ['0001-01-01', '0099-12-31', '1900-02-28', '2000-02-29', '2024-02-29', '9999-12-31']) {
    assert.equal(fromDay(toDay(value)), value);
  }
  assert.equal(toDay('2024-03-11') - toDay('2024-03-09'), 2);
  assert.equal(toDay('2024-11-04') - toDay('2024-11-02'), 2);
  assert.equal(toDay('2024-03-01') - toDay('2024-02-28'), 2);
  assert.equal(shiftMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(shiftMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(shiftMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(shiftMonths('2026-01-01', -6), '2025-07-01');
});

test('forecast results are identical across UTC and daylight-saving timezones', () => {
  const { execFileSync } = require('node:child_process');
  const modelPath = JSON.stringify(require.resolve('./model.js'));
  const script = `const model = require(${modelPath}); process.stdout.write(JSON.stringify(model.estimate(${JSON.stringify({ rows: fixture(advancing), region: 'CHINA', priorityDate: '2024-08-01' })})));`;
  const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Kolkata'].map(TZ =>
    execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ } })
  );
  assert.equal(outputs[0], outputs[1]);
  assert.equal(outputs[0], outputs[2]);
});

test('the same file exports a browser global without CommonJS', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./model.js'), 'utf8'), context);
  assert.equal(typeof context.EBModel.estimate, 'function');
  assert.equal(context.EBModel.toDay('2024-03-01') - context.EBModel.toDay('2024-02-29'), 1);
});

function custom(rows, windowStart, windowEnd, priorityDate = '2025-01-01') {
  return estimate({ rows, region: 'CHINA', priorityDate, windowStart, windowEnd });
}

function steadyRows(count) {
  return fixture(Array.from({ length: count }, (_, index) => fromDay(toDay('2024-01-01') + index * 10)));
}

test('a historical window defines the rate while the latest cutoff and bulletin define the forecast', () => {
  const rows = fixture(['2024-01-01', '2024-01-11', '2024-01-21', '2024-01-31', '2024-04-01', '2024-05-01', '2024-06-01']);
  const result = custom(rows, '2026-05-01', '2026-07-01', '2024-06-21');
  assert.equal(result.latestBulletin, '2026-11-01');
  assert.equal(result.windowStart, '2026-05-01');
  assert.equal(result.windowEnd, '2026-07-01');
  assert.equal(result.windowMonths, 2);
  assert.deepEqual(result.history.map(row => row.bulletin), ['2026-05-01', '2026-06-01', '2026-07-01']);
  const chart = result.charts.a;
  assert.equal(chart.startCutoff, '2024-01-01');
  assert.equal(chart.endCutoff, '2024-01-21');
  assert.equal(chart.latestCutoff, '2024-06-01');
  assert.equal(chart.speedDaysPerMonth, 10);
  assert.equal(chart.gapDays, 20);
  assert.equal(chart.monthsToTarget, 2);
  assert.equal(chart.bulletinSteps, 2);
  assert.equal(chart.estimatedBulletin, '2027-01-01');
});

test('one-, twelve-, and twenty-four-month windows include both endpoints and use their actual duration', () => {
  const rows = steadyRows(25);
  for (const months of [1, 12, 24]) {
    const end = shiftMonths(rows[0].bulletin, months);
    const result = custom(rows, rows[0].bulletin, end);
    assert.equal(result.windowMonths, months);
    assert.equal(result.history.length, months + 1);
    assert.equal(result.history.at(-1).bulletin, end);
    assert.equal(result.charts.a.speedDaysPerMonth, 10);
    assert.equal(result.charts.b.speedDaysPerMonth, 10);
  }
});

test('only an end date defaults the start to six months earlier; only a start defaults the end to latest', () => {
  const rows = steadyRows(25);
  const onlyEnd = custom(rows, undefined, '2027-05-01');
  assert.equal(onlyEnd.windowStart, '2026-11-01');
  assert.equal(onlyEnd.windowEnd, '2027-05-01');
  assert.equal(onlyEnd.windowMonths, 6);
  const onlyStart = custom(rows, '2026-06-01');
  assert.equal(onlyStart.windowEnd, '2028-05-01');
  assert.equal(onlyStart.windowMonths, 23);
});

test('custom bounds reject invalid dates, non-first days, equal/reversed bounds, and out-of-range windows', () => {
  const rows = steadyRows(25);
  const invalidBounds = [
    ['2026-02-30', '2027-05-01'],
    ['2026-05-02', '2027-05-01'],
    ['2026-05-01', '2027-05-02'],
    ['2026-05', '2027-05-01'],
    [null, '2027-05-01'],
    ['2027-05-01', '2027-05-01'],
    ['2027-06-01', '2027-05-01'],
    ['2026-04-01', '2027-05-01'],
    ['2026-05-01', '2028-06-01'],
    [undefined, '2026-06-01'] // Its default six-month start precedes the data.
  ];
  for (const [start, end] of invalidBounds) {
    assert.throws(() => custom(rows, start, end), RangeError);
  }
});

test('missing months, duplicate months, and markers outside the selected window do not affect its rate', () => {
  const rows = steadyRows(13);
  rows[0].EB1.CHINA.a = 'currentPD';
  rows[1].EB1.CHINA.a = 'unauthorized';
  rows[5].EB1.CHINA.a = 'unauthorized';
  rows.splice(8, 1);
  rows.push({ ...rows[9] });
  const result = custom(rows, '2026-07-01', '2026-09-01');
  assert.equal(result.history.length, 3);
  assert.equal(result.charts.a.status, 'projected');
  assert.equal(result.charts.a.speedDaysPerMonth, 10);
  assert.equal(result.charts.b.status, 'projected');
});

test('only selected monthly gaps and duplicates make the historical window insufficient', () => {
  const missing = steadyRows(13);
  missing.splice(3, 1);
  assert.equal(custom(missing, '2026-07-01', '2026-09-01').charts.a.status, 'insufficient');
  const duplicate = steadyRows(13);
  duplicate.push({ ...duplicate[3] });
  assert.equal(custom(duplicate, '2026-07-01', '2026-09-01').charts.a.status, 'insufficient');
});

test('selected numeric history is validated independently for each chart, including both endpoints', () => {
  for (const index of [2, 3, 4]) {
    for (const marker of ['currentPD', 'unauthorized', null, '2024-02-30']) {
      const rows = steadyRows(13);
      rows[index].EB1.CHINA.b = marker;
      const result = custom(rows, '2026-07-01', '2026-09-01');
      assert.equal(result.charts.a.status, 'projected');
      assert.equal(result.charts.a.speedDaysPerMonth, 10);
      assert.equal(result.charts.b.status, 'insufficient');
      assert.equal(result.charts.b.speedDaysPerMonth, null);
    }
  }
});

test('historical regressions and stalls are preserved even if the latest cutoff has advanced', () => {
  const rows = steadyRows(13);
  rows[4].EB1.CHINA.a = '2024-01-11';
  rows[4].EB1.CHINA.b = rows[2].EB1.CHINA.b;
  const result = custom(rows, '2026-07-01', '2026-09-01');
  assert.equal(result.charts.a.status, 'retrogressing');
  assert.equal(result.charts.a.speedDaysPerMonth, -5);
  assert.equal(result.charts.a.estimatedBulletin, null);
  assert.equal(result.charts.b.status, 'stalled');
  assert.equal(result.charts.b.speedDaysPerMonth, 0);
});

test('latest C, U, and reached states still override the chosen historical window', () => {
  const rows = steadyRows(13);
  rows.at(-1).EB1.CHINA.a = 'currentPD';
  rows.at(-1).EB1.CHINA.b = 'unauthorized';
  const result = custom(rows, '2026-07-01', '2026-09-01');
  assert.equal(result.charts.a.status, 'current');
  assert.equal(result.charts.b.status, 'unavailable');
  assert.equal(result.charts.a.speedDaysPerMonth, 10);
  const reachedRows = steadyRows(13);
  reachedRows.splice(3, 1);
  const reached = custom(reachedRows, '2026-07-01', '2026-09-01', '2024-01-01');
  assert.equal(reached.charts.a.status, 'reached');
  assert.equal(reached.charts.a.estimatedBulletin, '2027-05-01');
});

test('a valid historical rate cannot project from a missing or invalid latest cutoff', () => {
  for (const cutoff of [null, '2024-02-30']) {
    const rows = steadyRows(13);
    rows.at(-1).EB1.CHINA.a = cutoff;
    const result = custom(rows, '2026-07-01', '2026-09-01').charts.a;
    assert.equal(result.status, 'insufficient');
    assert.equal(result.speedDaysPerMonth, 10);
    assert.equal(result.gapDays, null);
    assert.equal(result.bulletinSteps, null);
    assert.equal(result.estimatedBulletin, null);
  }
});

function forecastAtSteps(steps, latestBulletin = '2026-11-01') {
  const rows = steadyRows(7);
  rows.forEach((row, index) => { row.bulletin = shiftMonths(latestBulletin, index - 6); });
  const priorityDate = fromDay(toDay(rows.at(-1).EB1.CHINA.b) + steps * 10);
  return estimate({ rows, region: 'CHINA', priorityDate });
}

test('Chart B May through September projections roll to October; every other month is unchanged', () => {
  // November + 1..12 covers all calendar months, including April/May and September/October boundaries.
  for (let steps = 1; steps <= 12; steps++) {
    const result = forecastAtSteps(steps);
    const raw = shiftMonths(result.latestBulletin, steps);
    const month = Number(raw.slice(5, 7));
    const adjustment = month >= 5 && month <= 9 ? 10 - month : 0;
    const a = result.charts.a;
    const b = result.charts.b;
    assert.equal(a.status, 'projected');
    assert.equal(b.status, 'projected');
    assert.equal(a.estimatedBulletin, raw);
    assert.equal(a.bulletinSteps, steps);
    assert.equal(a.closureAdjusted, false);
    assert.equal(a.closureAdjustmentMonths, 0);
    assert.equal(a.unadjustedEstimatedBulletin, raw);
    assert.equal(a.unadjustedBulletinSteps, steps);
    assert.equal(b.unadjustedEstimatedBulletin, raw);
    assert.equal(b.unadjustedBulletinSteps, steps);
    assert.equal(b.estimatedBulletin, adjustment ? raw.slice(0, 4) + '-10-01' : raw);
    assert.equal(b.bulletinSteps, steps + adjustment);
    assert.equal(b.closureAdjustmentMonths, adjustment);
    assert.equal(b.closureAdjusted, adjustment > 0);
    assert.equal(b.speedDaysPerMonth, 10);
    assert.equal(b.gapDays, steps * 10);
    assert.equal(b.monthsToTarget, steps);
  }
});

test('Chart B reopening remains October of the raw forecast year across distant forecast years', () => {
  for (const steps of [6, 18, 34, 58]) {
    const result = forecastAtSteps(steps);
    const raw = shiftMonths(result.latestBulletin, steps);
    const b = result.charts.b;
    assert.equal(b.estimatedBulletin, raw.slice(0, 4) + '-10-01');
    assert.equal(b.unadjustedEstimatedBulletin, raw);
    assert.equal(b.bulletinSteps, steps + 10 - Number(raw.slice(5, 7)));
    assert.equal(b.closureAdjusted, true);
  }
});

test('seasonal adjustment preserves the fractional linear estimate and updates the final whole-month wait', () => {
  const rows = steadyRows(7);
  const priorityDate = fromDay(toDay(rows.at(-1).EB1.CHINA.b) + 55);
  const result = estimate({ rows, region: 'CHINA', priorityDate });
  const a = result.charts.a;
  const b = result.charts.b;
  assert.equal(a.estimatedBulletin, '2027-05-01');
  assert.equal(a.bulletinSteps, 6);
  assert.equal(b.unadjustedEstimatedBulletin, '2027-05-01');
  assert.equal(b.unadjustedBulletinSteps, 6);
  assert.equal(b.estimatedBulletin, '2027-10-01');
  assert.equal(b.bulletinSteps, 11);
  assert.equal(b.closureAdjustmentMonths, 5);
  assert.equal(b.monthsToTarget, 5.5);
  assert.equal(b.gapDays, 55);
  assert.equal(b.speedDaysPerMonth, 10);
  assert.equal(b.startCutoff, a.startCutoff);
  assert.equal(b.endCutoff, a.endCutoff);
  assert.equal(b.latestCutoff, a.latestCutoff);
});

function assertNoClosureAdjustment(chart) {
  assert.equal(chart.closureAdjusted, false);
  assert.equal(chart.closureAdjustmentMonths, 0);
  assert.equal(chart.unadjustedEstimatedBulletin, null);
  assert.equal(chart.unadjustedBulletinSteps, null);
}

test('current and reached Chart B in a May bulletin keep zero wait without a seasonal delay', () => {
  const rows = steadyRows(7);
  rows.forEach((row, index) => { row.bulletin = shiftMonths('2027-05-01', index - 6); });
  const reached = run(rows, rows.at(-1).EB1.CHINA.b).charts.b;
  assert.equal(reached.status, 'reached');
  assert.equal(reached.estimatedBulletin, '2027-05-01');
  assert.equal(reached.bulletinSteps, 0);
  assertNoClosureAdjustment(reached);
  rows.at(-1).EB1.CHINA.b = 'currentPD';
  const current = run(rows).charts.b;
  assert.equal(current.status, 'current');
  assert.equal(current.estimatedBulletin, '2027-05-01');
  assert.equal(current.bulletinSteps, 0);
  assertNoClosureAdjustment(current);
});

test('Chart B unavailable, insufficient, stalled, and retrogressing states have no seasonal projection', () => {
  const scenarios = [
    { cutoffs: [...advancing.slice(0, 6), 'unauthorized'], status: 'unavailable' },
    { cutoffs: [...advancing.slice(0, 3), 'currentPD', ...advancing.slice(4)], status: 'insufficient' },
    { cutoffs: Array(7).fill('2024-01-01'), status: 'stalled' },
    { cutoffs: [...advancing].reverse(), status: 'retrogressing' }
  ];
  for (const { cutoffs, status } of scenarios) {
    const rows = fixture(cutoffs);
    rows.forEach((row, index) => { row.bulletin = shiftMonths('2027-05-01', index - 6); });
    const chart = run(rows).charts.b;
    assert.equal(chart.status, status);
    assert.equal(chart.estimatedBulletin, null);
    assert.equal(chart.bulletinSteps, null);
    assertNoClosureAdjustment(chart);
  }
});

test('seasonal adjustment follows the latest bulletin anchor when the rate window ends earlier', () => {
  const rows = steadyRows(13);
  const priorityDate = fromDay(toDay(rows.at(-1).EB1.CHINA.b) + 20);
  const result = custom(rows, '2026-05-01', '2026-11-01', priorityDate);
  assert.equal(result.latestBulletin, '2027-05-01');
  assert.equal(result.windowEnd, '2026-11-01');
  const b = result.charts.b;
  assert.equal(b.speedDaysPerMonth, 10);
  assert.equal(b.monthsToTarget, 2);
  assert.equal(b.unadjustedEstimatedBulletin, '2027-07-01');
  assert.equal(b.unadjustedBulletinSteps, 2);
  assert.equal(b.estimatedBulletin, '2027-10-01');
  assert.equal(b.bulletinSteps, 5);
  assert.equal(b.closureAdjustmentMonths, 3);
  assert.equal(result.charts.a.estimatedBulletin, '2027-07-01');
});

test('overflow projections retain safe insufficient status and empty seasonal metadata', () => {
  const slow = ['2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-01', '2024-01-02'];
  const result = run(fixture(slow), '9999-12-31');
  for (const chart of Object.values(result.charts)) {
    assert.equal(chart.status, 'insufficient');
    assert.equal(chart.estimatedBulletin, null);
    assert.equal(chart.bulletinSteps, null);
    assertNoClosureAdjustment(chart);
  }
});

test('each category, region, and chart uses its own distinct cutoff trend', () => {
  const rows = steadyRows(7);
  const categories = ['EB1', 'EB2', 'EB3'];
  const regions = ['ROW', 'CHINA', 'INDIA'];
  categories.forEach((category, categoryIndex) => {
    regions.forEach((region, regionIndex) => {
      ['a', 'b'].forEach((chart, chartIndex) => {
        const start = toDay('2000-01-01') + categoryIndex * 1000 + regionIndex * 100;
        const step = (categoryIndex + 1) * 10 + (regionIndex + 1) * 2 + chartIndex;
        rows.forEach((row, index) => { row[category][region][chart] = fromDay(start + step * index); });
      });
    });
  });
  for (const [categoryIndex, category] of categories.entries()) {
    for (const [regionIndex, region] of regions.entries()) {
      const result = estimate({ rows, category, region, priorityDate: '2030-01-01' });
      assert.equal(result.category, category);
      assert.equal(result.region, region);
      for (const [chartIndex, chart] of ['a', 'b'].entries()) {
        const step = (categoryIndex + 1) * 10 + (regionIndex + 1) * 2 + chartIndex;
        assert.equal(result.charts[chart].speedDaysPerMonth, step);
        assert.equal(result.charts[chart].latestCutoff, rows.at(-1)[category][region][chart]);
        assert.equal(result.charts[chart].gapDays, toDay('2030-01-01') - toDay(rows.at(-1)[category][region][chart]));
        assert.deepEqual(result.history.map(row => row[chart]), rows.map(row => row[category][region][chart]));
      }
    }
  }
});

test('omitting category defaults to EB1 and invalid categories are rejected', () => {
  const rows = steadyRows(7);
  rows.at(-1).EB2.CHINA.a = 'currentPD';
  const options = { rows, region: 'CHINA', priorityDate: '2025-01-01' };
  assert.deepEqual(estimate(options), estimate({ ...options, category: 'EB1' }));
  assert.equal(estimate(options).category, 'EB1');
  for (const category of ['EB4', 'eb1', '', null, 1, 'constructor']) {
    assert.throws(() => estimate({ ...options, category }), RangeError);
  }
});

test('missing selected-category history or latest values never borrow another category or region', () => {
  const rows = steadyRows(7);
  for (const row of rows) {
    row.EB1.CHINA = { a: 'currentPD', b: 'currentPD' };
    delete row.EB2;
  }
  const absent = estimate({ rows, category: 'EB2', region: 'CHINA', priorityDate: '2025-01-01' });
  assert.equal(absent.charts.a.status, 'insufficient');
  assert.equal(absent.charts.a.latestCutoff, null);
  assert.equal(absent.charts.a.speedDaysPerMonth, null);
  assert.deepEqual(absent.history.map(row => row.a), Array(7).fill(null));

  const partial = steadyRows(7);
  delete partial[3].EB2;
  const missingHistory = estimate({ rows: partial, category: 'EB2', region: 'CHINA', priorityDate: '2025-01-01' });
  assert.equal(missingHistory.charts.a.status, 'insufficient');
  assert.equal(missingHistory.charts.a.latestCutoff, partial.at(-1).EB2.CHINA.a);
  assert.equal(missingHistory.charts.a.speedDaysPerMonth, null);
  assert.equal(run(partial, '2025-01-01').charts.a.status, 'projected');

  delete partial.at(-1).EB3.CHINA;
  const missingRegion = estimate({ rows: partial, category: 'EB3', region: 'CHINA', priorityDate: '2025-01-01' });
  assert.equal(missingRegion.charts.a.status, 'insufficient');
  assert.equal(missingRegion.charts.a.latestCutoff, null);
});

test('historical-window markers are checked only within the selected category and selected dates', () => {
  for (const category of ['EB1', 'EB2', 'EB3']) {
    const rows = steadyRows(7);
    rows[3][category].CHINA.a = 'unauthorized'; // Outside the selected May–July window.
    const options = { rows, category, region: 'CHINA', priorityDate: '2025-01-01', windowStart: '2026-05-01', windowEnd: '2026-07-01' };
    assert.equal(estimate(options).charts.a.status, 'projected');
    rows[1][category].CHINA.a = 'currentPD';
    const selected = estimate(options);
    assert.equal(selected.charts.a.status, 'insufficient');
    assert.equal(selected.charts.b.status, 'projected');
    const otherCategory = category === 'EB1' ? 'EB2' : 'EB1';
    assert.equal(estimate({ ...options, category: otherCategory }).charts.a.status, 'projected');
  }
});

test('current, unavailable, stalled, and retrogressing states belong to the selected category', () => {
  for (const category of ['EB1', 'EB2', 'EB3']) {
    const rows = steadyRows(7);
    const options = { rows, category, region: 'CHINA', priorityDate: '2025-01-01' };
    rows.at(-1)[category].CHINA = { a: 'currentPD', b: 'unauthorized' };
    const latestStates = estimate(options);
    assert.equal(latestStates.charts.a.status, 'current');
    assert.equal(latestStates.charts.b.status, 'unavailable');
    rows.forEach((row, index) => {
      row[category].CHINA.a = '2024-01-01';
      row[category].CHINA.b = fromDay(toDay('2024-01-07') - index);
    });
    const rates = estimate(options);
    assert.equal(rates.charts.a.status, 'stalled');
    assert.equal(rates.charts.a.speedDaysPerMonth, 0);
    assert.equal(rates.charts.b.status, 'retrogressing');
    assert.equal(rates.charts.b.speedDaysPerMonth, -1);
    assertNoClosureAdjustment(rates.charts.b);
    const otherCategory = category === 'EB1' ? 'EB2' : 'EB1';
    assert.equal(estimate({ ...options, category: otherCategory }).charts.a.status, 'projected');
  }
});

test('the Chart B seasonal rule applies to EB1, EB2, and EB3 after their own progression calculation', () => {
  const rows = steadyRows(7);
  ['EB1', 'EB2', 'EB3'].forEach((category, categoryIndex) => {
    const step = (categoryIndex + 1) * 5;
    rows.forEach((row, index) => {
      const cutoff = fromDay(toDay('2024-01-01') + step * index);
      row[category].CHINA = { a: cutoff, b: cutoff };
    });
    const priorityDate = fromDay(toDay(rows.at(-1)[category].CHINA.b) + step * 6);
    const result = estimate({ rows, category, region: 'CHINA', priorityDate });
    assert.equal(result.category, category);
    assert.equal(result.charts.b.speedDaysPerMonth, step);
    assert.equal(result.charts.b.gapDays, step * 6);
    assert.equal(result.charts.b.unadjustedEstimatedBulletin, '2027-05-01');
    assert.equal(result.charts.b.estimatedBulletin, '2027-10-01');
    assert.equal(result.charts.b.bulletinSteps, 11);
    assert.equal(result.charts.b.closureAdjustmentMonths, 5);
    assert.equal(result.charts.a.estimatedBulletin, '2027-05-01');
    assert.equal(result.charts.a.closureAdjusted, false);
  });
});
