(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const MONTHS = Object.freeze([10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const COLOR_CAP_DAYS = 450;

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

  function monthIndex(value) {
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  }

  function fromMonth(month) {
    return String(Math.floor(month / 12)).padStart(4, '0') + '-' + String(month % 12 + 1).padStart(2, '0') + '-01';
  }

  function cutoffState(value) {
    if (value === 'currentPD') return 'current';
    if (value === 'unauthorized') return 'unavailable';
    return toDay(value) === null ? 'missing' : 'dated';
  }

  function movement(previous, current) {
    const before = cutoffState(previous), after = cutoffState(current);
    if (after === 'current' || after === 'unavailable') return { state: after, value: null };
    if (after === 'dated' && (before === 'current' || before === 'unavailable')) return { state: 'from-' + before, value: null };
    if (before !== 'dated' || after !== 'dated') return { state: 'missing', value: null };
    return { state: 'numeric', value: toDay(current) - toDay(previous) };
  }

  // Every cell compares the immediately preceding calendar month, including
  // months outside the highlighted window. An absent month is never bridged.
  function prepare({ history = [], windowStart, windowEnd } = {}) {
    const rows = Array.isArray(history) ? history.filter(row => row && toDay(row.bulletin) !== null) : [];
    const byMonth = new Map();
    for (const row of rows) {
      const month = monthIndex(row.bulletin);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(row);
    }
    const observedMonths = [...byMonth.keys()].sort((a, b) => a - b);
    if (!observedMonths.length) return { fiscalYears: [], months: [...MONTHS], cells: [], firstBulletin: null, lastBulletin: null };
    const first = observedMonths[0], last = observedMonths[observedMonths.length - 1];
    const firstYear = Math.floor((first + 3) / 12), lastYear = Math.floor((last + 3) / 12);
    const fiscalYears = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
    const hasWindow = toDay(windowStart) !== null || toDay(windowEnd) !== null;
    const start = toDay(windowStart) === null ? first : monthIndex(windowStart);
    const end = toDay(windowEnd) === null ? last : monthIndex(windowEnd);
    const getRow = month => {
      const matches = byMonth.get(month) || [];
      return matches.length === 1 ? matches[0] : null;
    };
    const cells = [];
    for (const chart of ['A', 'B']) {
      for (const fiscalYear of fiscalYears) {
        MONTHS.forEach((month, column) => {
          const year = month >= 10 ? fiscalYear - 1 : fiscalYear;
          const index = year * 12 + month - 1;
          const row = getRow(index), prior = getRow(index - 1);
          const key = chart.toLowerCase();
          const current = row?.[key] ?? null, previous = prior?.[key] ?? null;
          const outside = index < first || index > last;
          cells.push({
            chart, fiscalYear, monthIndex: column, bulletin: fromMonth(index),
            observed: row !== null,
            selected: hasWindow && row !== null && index >= start && index <= end,
            previous, current,
            ...(outside ? { state: 'outside', value: null } : movement(previous, current))
          });
        });
      }
    }
    return { fiscalYears, months: [...MONTHS], cells, firstBulletin: fromMonth(first), lastBulletin: fromMonth(last) };
  }

  function mix(color, amount) {
    return '#' + [1, 3, 5].map(offset => Math.round(255 + (parseInt(color.slice(offset, offset + 2), 16) - 255) * amount).toString(16).padStart(2, '0')).join('');
  }

  function fill(cell) {
    if (cell.state === 'numeric') {
      if (cell.value === 0) return '#eceff3';
      const strength = 0.16 + 0.67 * Math.pow(Math.min(Math.abs(cell.value) / COLOR_CAP_DAYS, 1), 0.55);
      return mix(cell.value > 0 ? '#079f83' : '#dc4b56', strength);
    }
    if (cell.state === 'current' || cell.state === 'from-current') return '#e5eaf7';
    if (cell.state === 'unavailable' || cell.state === 'from-unavailable') return '#f3e5d4';
    return cell.state === 'outside' ? '#f8fafc' : '#f1f3f7';
  }

  function render(options = {}) {
    const prepared = prepare(options);
    const { fiscalYears, cells } = prepared;
    const locale = options.locale || 'en-US';
    const chinese = /^zh(?:-|$)/i.test(locale);
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const dateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const signed = value => (value > 0 ? '+' : '') + number.format(value);
    const source = value => {
      if (value === 'currentPD') return chinese ? '无排期（C）' : 'Current (C)';
      if (value === 'unauthorized') return chinese ? '暂不可用（U）' : 'Unavailable (U)';
      const day = toDay(value);
      return day === null ? (chinese ? '未记录' : 'not observed') : dateFormatter.format(new Date(day * DAY_MS));
    };
    const detail = cell => {
      if (cell.state === 'numeric') return chinese ? `当月排期变化：${signed(cell.value)} 天` : `Monthly cutoff change: ${signed(cell.value)} days`;
      const descriptions = chinese ? {
        current: '无排期（C）；不计算推进天数', unavailable: '暂不可用（U）；不计算推进天数',
        'from-current': '从 C 变为具体日期；不计算推进天数', 'from-unavailable': '从 U 变为具体日期；不计算推进天数',
        missing: '缺少可比较的本月与上月截止日期', outside: '已保存历史之外'
      } : {
        current: 'Current (C); movement is not defined', unavailable: 'Unavailable (U); movement is not defined',
        'from-current': 'Transition from C to dated cutoff; movement is not defined',
        'from-unavailable': 'Transition from U to dated cutoff; movement is not defined',
        missing: 'No comparable pair of monthly cutoff dates', outside: 'Outside saved history'
      };
      return descriptions[cell.state];
    };
    const labels = Object.assign({
      title: chinese ? '按财政年度排列的月度排期变化' : 'Monthly cutoff progression by fiscal year',
      description: chinese
        ? '表 A 和表 B 的完整已保存历史。每个单元格显示与上一个日历月相比的排期变化天数；深色边框标出所选区间，含起止月份。行按十月至九月的财政年度排列。C、U 和缺失值不计算数值变化。'
        : 'Full saved history for Chart A and Chart B. Each cell shows the cutoff-date change from the immediately preceding calendar month. Dark outlines highlight the selected window, including both endpoints. Fiscal-year rows run October through September. Current, unavailable, and missing values have no numerical change.',
      chartTitle: chart => chinese ? `表 ${chart} · 月度排期变化（天）` : `Chart ${chart} · monthly cutoff change (days)`,
      monthTick: month => monthFormatter.format(new Date(Date.UTC(2024, month - 1, 1))),
      fiscalYear: year => chinese ? `${year} 财年` : `FY${year}`,
      fiscalAxis: chinese ? '十月至九月的财政年度' : 'Fiscal year: October–September',
      noData: chinese ? '没有已保存的公告历史' : 'No saved bulletin history',
      cellLabel: cell => {
        if (cell.state === 'numeric') return (cell.value > 0 ? '+' : '') + cell.value;
        return ({ current: 'C', unavailable: 'U', 'from-current': 'C→D', 'from-unavailable': 'U→D' })[cell.state] || '—';
      },
      cellTooltip: cell => {
        const chart = chinese ? `表 ${cell.chart}` : `Chart ${cell.chart}`;
        const selected = cell.selected ? (chinese ? ' · 所选区间' : ' · selected window') : '';
        return chinese
          ? `${cell.bulletin.slice(0, 7)} · ${chart} · ${detail(cell)}。上月截止日期：${source(cell.previous)}；本月截止日期：${source(cell.current)}${selected}`
          : `${cell.bulletin.slice(0, 7)} · ${chart} · ${detail(cell)}. Prior cutoff: ${source(cell.previous)}; cutoff: ${source(cell.current)}${selected}`;
      }
    }, options.labels || {});
    const label = (key, ...args) => typeof labels[key] === 'function' ? labels[key](...args) : labels[key];
    const width = 900, left = 108, cellWidth = 64, cellHeight = 40;
    const paneHeight = 100 + fiscalYears.length * cellHeight;
    const height = fiscalYears.length ? paneHeight * 2 + 20 : 112;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="fiscal-heatmap-chart" role="img" aria-labelledby="fiscal-heatmap-title fiscal-heatmap-description" style="display:block;width:100%;height:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff"><title id="fiscal-heatmap-title">${escape(label('title'))}</title><desc id="fiscal-heatmap-description">${escape(label('description'))}</desc><rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>`;
    if (!fiscalYears.length) return svg + `<text x="450" y="58" text-anchor="middle" fill="#64748b" font-size="15">${escape(label('noData'))}</text></svg>`;
    for (const [pane, chart] of ['A', 'B'].entries()) {
      const base = pane * paneHeight;
      svg += `<g class="fiscal-heatmap-pane" data-chart="${chart}"><text x="18" y="${base + 28}" fill="#334155" font-size="18" font-weight="600">${escape(label('chartTitle', chart))}</text>`;
      MONTHS.forEach((month, column) => {
        svg += `<text x="${left + column * cellWidth + cellWidth / 2}" y="${base + 60}" text-anchor="middle" fill="#475569" font-size="15">${escape(label('monthTick', month))}</text>`;
      });
      fiscalYears.forEach((year, row) => {
        svg += `<text x="${left - 12}" y="${base + 72 + row * cellHeight + cellHeight / 2}" text-anchor="end" dominant-baseline="middle" fill="#475569" font-size="15">${escape(label('fiscalYear', year))}</text>`;
      });
      for (const cell of cells.filter(cell => cell.chart === chart)) {
        const x = left + cell.monthIndex * cellWidth, y = base + 72 + fiscalYears.indexOf(cell.fiscalYear) * cellHeight;
        const tooltip = escape(label('cellTooltip', cell));
        svg += `<g class="fiscal-heatmap-cell" data-chart="${cell.chart}" data-bulletin="${cell.bulletin}" data-value="${cell.value === null ? '' : cell.value}" data-state="${cell.state}" data-selected="${cell.selected}" data-observed="${cell.observed}" role="img" aria-label="${tooltip}"><title>${tooltip}</title><rect x="${x + 2}" y="${y + 2}" width="${cellWidth - 4}" height="${cellHeight - 4}" rx="3" fill="${fill(cell)}" stroke="${cell.selected ? '#0f172a' : 'none'}" stroke-width="${cell.selected ? '2.5' : '0'}"/><text x="${x + cellWidth / 2}" y="${y + cellHeight / 2}" text-anchor="middle" dominant-baseline="middle" fill="${cell.state === 'outside' || cell.state === 'missing' ? '#64748b' : '#243344'}" font-size="15">${escape(label('cellLabel', cell))}</text></g>`;
      }
      svg += `<text x="${left}" y="${base + 72 + fiscalYears.length * cellHeight + 24}" fill="#64748b" font-size="14">${escape(label('fiscalAxis'))}</text></g>`;
    }
    return svg + '</svg>';
  }

  const api = Object.freeze({ prepare, render, COLOR_CAP_DAYS });
  root.EBHeatmap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
