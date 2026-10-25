(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const DAYS_PER_MONTH = 365.25 / 12;
  const SERIES = Object.freeze([
    { key: 'cutoffA', axis: 'date', color: '#2563eb', dash: '' },
    { key: 'cutoffB', axis: 'date', color: '#ea8b18', dash: '' },
    { key: 'gap', axis: 'days', color: '#047857', dash: '7 5' },
    { key: 'lagA', axis: 'days', color: '#2563eb', dash: '2 4' },
    { key: 'lagB', axis: 'days', color: '#ea8b18', dash: '2 4' }
  ]);

  function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function toDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.getTime() / DAY_MS;
  }

  function fromDay(day) {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
  }

  function monthIndex(value) {
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  }

  function fromMonth(month) {
    return String(Math.floor(month / 12)).padStart(4, '0') + '-' + String(month % 12 + 1).padStart(2, '0') + '-01';
  }

  // Expand the complete calendar so an absent bulletin breaks the paths rather
  // than making a missing observation look like unchanged monthly history.
  function prepare({ history = [], windowStart, windowEnd } = {}) {
    const rows = Array.isArray(history) ? history.filter(row => row && toDay(row.bulletin) !== null) : [];
    const months = rows.map(row => monthIndex(row.bulletin));
    const start = toDay(windowStart) === null ? (months.length ? Math.min(...months) : null) : monthIndex(windowStart);
    const end = toDay(windowEnd) === null ? (months.length ? Math.max(...months) : null) : monthIndex(windowEnd);
    const byMonth = new Map();
    for (const row of rows) {
      const month = monthIndex(row.bulletin);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(row);
    }
    const points = [];
    if (start !== null && end !== null && start <= end) {
      for (let month = start; month <= end; month++) {
        const bulletin = fromMonth(month);
        const matches = byMonth.get(month) || [];
        const row = matches.length === 1 ? matches[0] : null;
        const a = row ? row.a : null, b = row ? row.b : null;
        const cutoffA = toDay(a), cutoffB = toDay(b);
        const currentA = a === 'currentPD', currentB = b === 'currentPD';
        const validA = currentA || cutoffA !== null, validB = currentB || cutoffB !== null;
        const reference = toDay(bulletin.slice(0, 8) + '15');
        points.push({
          bulletin, a, b, cutoffA, cutoffB,
          gap: !validA || !validB ? null : currentA || currentB ? 0 : cutoffB - cutoffA,
          lagA: currentA ? 0 : cutoffA === null ? null : reference - cutoffA,
          lagB: currentB ? 0 : cutoffB === null ? null : reference - cutoffB
        });
      }
    }
    return { points, windowStart: points[0]?.bulletin || null, windowEnd: points[points.length - 1]?.bulletin || null };
  }

  function niceStep(span, target = 5) {
    const raw = span / target;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const fraction = raw / magnitude;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
  }

  function distanceScale(values) {
    if (!values.length) return { min: 0, max: 30, ticks: [0, 10, 20, 30] };
    let min = Math.min(0, ...values), max = Math.max(0, ...values);
    if (min === max) max = 30;
    const step = Math.max(1, niceStep(max - min));
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const ticks = [];
    for (let value = min; value <= max + step / 100; value += step) ticks.push(Number(value.toFixed(8)));
    return { min, max, ticks };
  }

  function dateScale(values) {
    if (!values.length) return null;
    const low = Math.min(...values), high = Math.max(...values);
    const padding = Math.max(15, (high - low) * 0.055);
    const min = Math.max(toDay('0001-01-01'), Math.floor(low - padding));
    const max = Math.min(toDay('9999-12-31'), Math.ceil(high + padding));
    const ticks = [];
    if (max - min <= 100) {
      const step = Math.max(1, niceStep(max - min));
      for (let value = Math.ceil(min / step) * step; value <= max; value += step) ticks.push(value);
    } else {
      const first = monthIndex(fromDay(min)), last = monthIndex(fromDay(max));
      const step = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240, 600, 1200].find(value => (last - first) / value <= 5) || 2400;
      for (let month = Math.ceil(first / step) * step; month <= last; month += step) {
        const day = toDay(fromMonth(month));
        if (day !== null && day >= min && day <= max) ticks.push(day);
      }
    }
    return { min, max, ticks };
  }

  function render(options = {}) {
    const { points } = prepare(options);
    const locale = options.locale || 'en-US';
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const monthFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' });
    const labels = Object.assign({
      title: 'Cutoff dates and calendar-day distances',
      description: 'Five monthly step lines: Chart A and Chart B cutoff dates use the left date axis; their gap and the distances from each cutoff to the bulletin month’s 15th use the right axis. Current cutoffs have no dated line and zero own distance; unavailable or missing values interrupt their lines. Distances are not predicted waiting times.',
      dateAxis: 'Cutoff date', dayAxis: 'Calendar-day distance',
      tickHeading: 'Days (≈ months)', bulletinAxis: 'Bulletin month',
      noDateLabel: 'No dated cutoff in this window',
      noDataLabel: 'No cutoff or day-distance values in this window',
      cutoffA: 'Chart A cutoff', cutoffB: 'Chart B cutoff', gap: 'Filing–final-action cutoff gap',
      lagA: 'Final-action cutoff lag', lagB: 'Filing cutoff lag',
      monthTick: value => monthFormatter.format(new Date(toDay(value) * DAY_MS)),
      dateTick: value => value,
      dayTick: (days, months) => number.format(days) + ' (' + decimal.format(months) + ')',
      cutoffTooltip: (chart, bulletin, value) => 'Chart ' + chart + ' · ' + bulletin.slice(0, 7) + ': ' + value,
      distanceTooltip: (name, bulletin, days, months) => name + ' · ' + bulletin.slice(0, 7) + ': ' + number.format(days) + ' days (≈ ' + decimal.format(months) + ' months)'
    }, options.labels || {});
    const label = (key, ...args) => typeof labels[key] === 'function' ? labels[key](...args) : labels[key];
    const dateValues = points.flatMap(point => [point.cutoffA, point.cutoffB]).filter(value => value !== null);
    const distances = points.flatMap(point => [point.gap, point.lagA, point.lagB]).filter(value => value !== null);
    const dates = dateScale(dateValues), days = distanceScale(distances);
    const width = 900, height = 450;
    const left = 130, right = 720, top = 48, bottom = 365;
    const x = index => points.length < 2 ? (left + right) / 2 : left + index * (right - left) / (points.length - 1);
    const yDate = value => bottom - (value - dates.min) / (dates.max - dates.min) * (bottom - top);
    const yDays = value => bottom - (value - days.min) / (days.max - days.min) * (bottom - top);
    const coordinate = value => Number(value.toFixed(2));
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="history-five-line-chart" role="img" aria-labelledby="history-plot-title history-plot-description" style="display:block;width:100%;height:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff"><title id="history-plot-title">${escape(label('title'))}</title><desc id="history-plot-description">${escape(label('description'))}</desc>`;
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`;
    if (dates) {
      for (const tick of dates.ticks) {
        const y = coordinate(yDate(tick));
        svg += `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/><text x="${left - 12}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#475569" font-size="15">${escape(label('dateTick', fromDay(tick)))}</text>`;
      }
    }
    svg += `<path d="M${left} ${top}V${bottom}H${right}V${top}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
    for (const tick of days.ticks) {
      const y = coordinate(yDays(tick));
      svg += `<line x1="${right}" x2="${right + 5}" y1="${y}" y2="${y}" stroke="#94a3b8"/><text x="${right + 10}" y="${y}" dominant-baseline="middle" fill="#475569" font-size="15">${escape(label('dayTick', tick, tick / DAYS_PER_MONTH))}</text>`;
    }
    svg += `<text x="${right + 9}" y="26" fill="#475569" font-size="15">${escape(label('tickHeading'))}</text>`;
    svg += `<text x="20" y="${(top + bottom) / 2}" text-anchor="middle" transform="rotate(-90 20 ${(top + bottom) / 2})" fill="#334155" font-size="15" font-weight="600">${escape(label('dateAxis'))}</text>`;
    svg += `<text x="883" y="${(top + bottom) / 2}" text-anchor="middle" transform="rotate(90 883 ${(top + bottom) / 2})" fill="#334155" font-size="15" font-weight="600">${escape(label('dayAxis'))}</text>`;
    if (points.length) {
      const stride = Math.max(1, Math.ceil((points.length - 1) / 5));
      const indices = [];
      for (let index = 0; index < points.length; index += stride) indices.push(index);
      if (indices[indices.length - 1] !== points.length - 1) {
        if (indices.length > 1 && points.length - 1 - indices[indices.length - 1] < stride / 2) indices.pop();
        indices.push(points.length - 1);
      }
      for (const index of indices) {
        const px = coordinate(x(index));
        svg += `<line x1="${px}" x2="${px}" y1="${bottom}" y2="${bottom + 5}" stroke="#94a3b8"/><text x="${px}" y="${bottom + 27}" text-anchor="middle" fill="#475569" font-size="15">${escape(label('monthTick', points[index].bulletin))}</text>`;
      }
    }
    svg += `<text x="${(left + right) / 2}" y="430" text-anchor="middle" fill="#334155" font-size="15" font-weight="600">${escape(label('bulletinAxis'))}</text>`;
    for (const series of SERIES) {
      let path = '', previous = null, hovers = '';
      const yValue = series.axis === 'date' ? yDate : yDays;
      points.forEach((point, index) => {
        const value = point[series.key];
        if (value === null) { previous = null; return; }
        const px = coordinate(x(index)), py = coordinate(yValue(value));
        path += previous === null ? `M${px} ${py}` : `H${px}V${py}`;
        previous = value;
        const tooltip = series.axis === 'date'
          ? label('cutoffTooltip', series.key === 'cutoffA' ? 'A' : 'B', point.bulletin, fromDay(value))
          : label('distanceTooltip', label(series.key), point.bulletin, value, value / DAYS_PER_MONTH);
        hovers += `<circle class="history-hover" data-series-point="${series.key}" data-bulletin="${point.bulletin}" data-value="${value}" cx="${px}" cy="${py}" r="5" fill="transparent" stroke="none"><title>${escape(tooltip)}</title></circle>`;
      });
      svg += `<path class="history-series" data-series="${series.key}" d="${path}" fill="none" stroke="${series.color}" stroke-width="${series.axis === 'date' ? 2.2 : 2}"${series.dash ? ` stroke-dasharray="${series.dash}" stroke-linecap="round"` : ''} stroke-linejoin="round"><title>${escape(label(series.key))}</title></path>${hovers}`;
    }
    if (!dateValues.length) {
      svg += `<text class="history-no-date" x="${left + 12}" y="${top + 23}" fill="#64748b" font-size="14">${escape(label('noDateLabel'))}</text>`;
    }
    if (!dateValues.length && !distances.length) {
      svg += `<text class="history-no-data" x="${(left + right) / 2}" y="${(top + bottom) / 2}" text-anchor="middle" fill="#475569" font-size="15">${escape(label('noDataLabel'))}</text>`;
    }
    return svg + '</svg>';
  }

  const api = Object.freeze({ render, prepare, DAYS_PER_MONTH });
  root.EBHistoryChart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
