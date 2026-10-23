(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const DEFAULT_WINDOW_MONTHS = 12;
  const CATEGORIES = ['EB1', 'EB2', 'EB3'];
  const REGIONS = ['ROW', 'CHINA', 'INDIA'];

  // Work with UTC calendar days rather than local midnights or elapsed hours.
  function toDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new RangeError('Expected a calendar date in YYYY-MM-DD format.');
    }
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new RangeError('Invalid calendar date: ' + value);
    }
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new RangeError('Invalid calendar date: ' + value);
    }
    return date.getTime() / DAY_MS;
  }

  function fromDay(day) {
    if (!Number.isSafeInteger(day)) throw new RangeError('Expected an integer UTC calendar day.');
    const date = new Date(day * DAY_MS);
    const year = date.getUTCFullYear();
    if (!Number.isFinite(date.getTime()) || year < 1 || year > 9999) {
      throw new RangeError('Date is outside the supported years 0001–9999.');
    }
    return date.toISOString().slice(0, 10);
  }

  function shiftMonths(value, months) {
    const date = new Date(toDay(value) * DAY_MS);
    if (!Number.isSafeInteger(months)) throw new RangeError('Month offset must be an integer.');
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    // Clamp month-end dates, for example January 31 + 1 month = February 28.
    const end = new Date(date.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(originalDay, end.getUTCDate()));
    return fromDay(date.getTime() / DAY_MS);
  }

  function monthIndex(value) {
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  }

  function numericDay(value) {
    try { return toDay(value); } catch (_) { return null; }
  }

  function estimate({ rows, category = 'EB1', region, priorityDate, windowStart: requestedWindowStart, windowEnd: requestedWindowEnd } = {}) {
    const priorityDay = toDay(priorityDate);
    if (!CATEGORIES.includes(category)) throw new RangeError('Category must be EB1, EB2, or EB3.');
    if (!REGIONS.includes(region)) throw new RangeError('Region must be ROW, CHINA, or INDIA.');
    if (!Array.isArray(rows) || rows.length === 0) throw new RangeError('At least one bulletin row is required.');

    const sorted = rows.map(row => {
      if (!row || typeof row !== 'object') throw new TypeError('Each bulletin must be an object.');
      toDay(row.bulletin);
      return row;
    }).sort((left, right) => left.bulletin.localeCompare(right.bulletin));
    const latest = sorted[sorted.length - 1];
    const customWindow = requestedWindowStart !== undefined || requestedWindowEnd !== undefined;
    const windowEnd = requestedWindowEnd === undefined ? latest.bulletin : requestedWindowEnd;
    toDay(windowEnd);
    const windowStart = requestedWindowStart === undefined ? shiftMonths(windowEnd, -DEFAULT_WINDOW_MONTHS) : requestedWindowStart;
    toDay(windowStart);
    if (customWindow) {
      if (!windowStart.endsWith('-01') || !windowEnd.endsWith('-01')) {
        throw new RangeError('Averaging-window dates must be the first day of a month.');
      }
      if (windowStart >= windowEnd) {
        throw new RangeError('Averaging-window start must be earlier than its end.');
      }
      if (windowStart < sorted[0].bulletin || windowEnd > latest.bulletin) {
        throw new RangeError('The averaging window must be within the available bulletin dates.');
      }
    }
    const startMonth = monthIndex(windowStart);
    const endMonth = monthIndex(windowEnd);
    const windowMonths = endMonth - startMonth;
    const historyRows = sorted.filter(row => monthIndex(row.bulletin) >= startMonth && monthIndex(row.bulletin) <= endMonth);
    const history = historyRows.map(row => ({
      bulletin: row.bulletin,
      a: row[category]?.[region]?.a ?? null,
      b: row[category]?.[region]?.b ?? null
    }));
    const monthCounts = new Map();
    for (const row of historyRows) {
      const month = monthIndex(row.bulletin);
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    }
    const completeMonths = Array.from({ length: windowMonths + 1 }, (_, offset) => startMonth + offset)
      .every(month => monthCounts.get(month) === 1);
    const start = history.find(row => monthIndex(row.bulletin) === startMonth);
    const end = history.find(row => monthIndex(row.bulletin) === endMonth);

    function chartResult(chart) {
      const latestCutoff = latest[category]?.[region]?.[chart] ?? null;
      const startCutoff = start?.[chart] ?? null;
      const endCutoff = end?.[chart] ?? null;
      const currentDay = numericDay(latestCutoff);
      const startDay = numericDay(startCutoff);
      const endDay = numericDay(endCutoff);
      const numericWindow = completeMonths && history.every(row => numericDay(row[chart]) !== null);
      const speed = numericWindow ? (endDay - startDay) / windowMonths : null;
      const result = {
        status: 'insufficient', latestCutoff, startCutoff, endCutoff,
        speedDaysPerMonth: speed,
        gapDays: currentDay === null ? null : Math.max(0, priorityDay - currentDay),
        monthsToTarget: null, bulletinSteps: null, estimatedBulletin: null,
        unadjustedEstimatedBulletin: null, unadjustedBulletinSteps: null,
        closureAdjustmentMonths: 0, closureAdjusted: false,
        reason: ''
      };

      if (latestCutoff === 'currentPD') {
        return Object.assign(result, {
          status: 'current', monthsToTarget: 0, bulletinSteps: 0,
          estimatedBulletin: latest.bulletin,
          reason: 'The latest bulletin lists this chart as current.'
        });
      }
      if (latestCutoff === 'unauthorized') {
        return Object.assign(result, {
          status: 'unavailable',
          reason: 'The latest bulletin lists this chart as unavailable (U).'
        });
      }
      if (currentDay !== null && priorityDay <= currentDay) {
        return Object.assign(result, {
          status: 'reached', monthsToTarget: 0, bulletinSteps: 0,
          estimatedBulletin: latest.bulletin,
          reason: 'The latest cutoff has reached or passed this priority date.'
        });
      }
      if (currentDay === null) {
        result.reason = 'The latest cutoff must be a valid numeric date to project from the latest bulletin.';
        return result;
      }
      if (!completeMonths) {
        result.reason = 'The selected ' + windowMonths + '-month window requires ' + (windowMonths + 1) + ' consecutive monthly bulletins, with exactly one observation per month.';
        return result;
      }
      if (!numericWindow) {
        result.reason = 'All cutoffs in this chart’s selected averaging window must be valid numeric dates; C, U, missing, or invalid values cannot define a progression speed.';
        return result;
      }
      if (speed === 0) {
        result.status = 'stalled';
        result.reason = 'There was no net cutoff advancement over the selected averaging window.';
        return result;
      }
      if (speed < 0) {
        result.status = 'retrogressing';
        result.reason = 'The cutoff moved backward overall during the selected averaging window.';
        return result;
      }

      result.status = 'projected';
      // This remains the fractional linear estimate; bulletinSteps is the final
      // monthly wait after rounding and any Chart B seasonal closure adjustment.
      result.monthsToTarget = result.gapDays / speed;
      // A tiny tolerance prevents floating-point noise from adding a whole bulletin.
      result.bulletinSteps = Math.ceil(result.monthsToTarget - 1e-10);
      try {
        result.estimatedBulletin = shiftMonths(latest.bulletin, result.bulletinSteps);
        result.unadjustedEstimatedBulletin = result.estimatedBulletin;
        result.unadjustedBulletinSteps = result.bulletinSteps;
        result.reason = 'Projected from the latest bulletin using the selected window’s signed net cutoff advancement divided by ' + windowMonths + ' calendar months.';
        const projectedMonth = Number(result.estimatedBulletin.slice(5, 7));
        // User-selected assumption: Chart B closes in May and reopens October 1.
        // October is in the same calendar year as the original May–September date.
        if (chart === 'b' && projectedMonth >= 5 && projectedMonth <= 9) {
          result.closureAdjustmentMonths = 10 - projectedMonth;
          result.closureAdjusted = true;
          result.estimatedBulletin = result.estimatedBulletin.slice(0, 4) + '-10-01';
          result.bulletinSteps += result.closureAdjustmentMonths;
          result.reason += ' Under the assumed May–September Chart B closure, the projected bulletin is delayed to October 1 of the same year.';
        }
      } catch (_) {
        result.status = 'insufficient';
        result.monthsToTarget = null;
        result.bulletinSteps = null;
        result.estimatedBulletin = null;
        result.unadjustedEstimatedBulletin = null;
        result.unadjustedBulletinSteps = null;
        result.closureAdjustmentMonths = 0;
        result.closureAdjusted = false;
        result.reason = 'The projected bulletin falls outside the supported calendar years 0001–9999.';
      }
      return result;
    }

    return {
      category, region, priorityDate, latestBulletin: latest.bulletin,
      windowStart, windowEnd, windowMonths,
      history, charts: { a: chartResult('a'), b: chartResult('b') }
    };
  }

  const api = Object.freeze({ toDay, fromDay, shiftMonths, estimate });
  root.EBModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
