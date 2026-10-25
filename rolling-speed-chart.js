(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const CALENDAR_PACE = 365.25 / 12;
  const WINDOWS = Object.freeze([12, 24, 36, 48]);
  const SERIES = Object.freeze([
    { months: 12, color: '#2563eb', dash: '', width: 2.6 },
    { months: 24, color: '#d97706', dash: '8 4', width: 2.4 },
    { months: 36, color: '#059669', dash: '2 4', width: 2.4 },
    { months: 48, color: '#9333ea', dash: '10 4 2 4', width: 2.4 }
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

  function monthIndex(value) {
    return Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
  }

  function fromMonth(month) {
    return String(Math.floor(month / 12)).padStart(4, '0') + '-' + String(month % 12 + 1).padStart(2, '0') + '-01';
  }

  // A speed needs all N + 1 consecutive dated observations, even though only
  // the endpoints determine its signed net movement. Never bridge C/U or gaps.
  function prepare({ history = [], windowStart, windowEnd } = {}) {
    const rows = Array.isArray(history) ? history.filter(row => row && toDay(row.bulletin) !== null) : [];
    const byMonth = new Map();
    for (const row of rows) {
      const month = monthIndex(row.bulletin);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(row);
    }
    const months = [...byMonth.keys()].sort((a, b) => a - b);
    if (!months.length) return {
      points: [], values: [], windows: [...WINDOWS], firstBulletin: null, lastBulletin: null,
      plotStart: null, plotEnd: null, selectedStart: null, selectedEnd: null
    };
    const first = months[0], last = months[months.length - 1];
    const plotFirst = first + WINDOWS[0] <= last ? first + WINDOWS[0] : first;
    const start = toDay(windowStart) === null ? null : monthIndex(windowStart);
    const end = toDay(windowEnd) === null ? null : monthIndex(windowEnd);
    const hasSelection = start !== null && end !== null && start <= end;
    const selectedFirst = hasSelection ? Math.max(plotFirst, start) : null;
    const selectedLast = hasSelection ? Math.min(last, end) : null;
    const selected = month => hasSelection && month >= start && month <= end;
    const uniqueRow = month => {
      const matches = byMonth.get(month) || [];
      return matches.length === 1 ? matches[0] : null;
    };
    const points = [], values = [];
    for (let month = first; month <= last; month++) {
      const bulletin = fromMonth(month);
      const point = { bulletin, selected: selected(month), A: {}, B: {} };
      for (const chart of ['A', 'B']) {
        const key = chart.toLowerCase();
        for (const windowMonths of WINDOWS) {
          const windowFirst = month - windowMonths;
          let numericWindow = windowFirst >= first;
          if (numericWindow) {
            for (let observed = windowFirst; observed <= month; observed++) {
              if (toDay(uniqueRow(observed)?.[key]) === null) { numericWindow = false; break; }
            }
          }
          const netCutoffDays = numericWindow ? toDay(uniqueRow(month)[key]) - toDay(uniqueRow(windowFirst)[key]) : null;
          const speedDaysPerMonth = netCutoffDays === null ? null : netCutoffDays / windowMonths;
          point[chart][windowMonths] = speedDaysPerMonth;
          values.push({
            bulletin, chart, windowMonths, windowStart: fromMonth(windowFirst),
            speedDaysPerMonth, netCutoffDays, selected: point.selected,
            unavailableReason: speedDaysPerMonth !== null ? null : windowFirst < first ? 'insufficient_history' : 'nonnumeric_or_incomplete_window'
          });
        }
      }
      points.push(point);
    }
    return {
      points, values, windows: [...WINDOWS], firstBulletin: fromMonth(first), lastBulletin: fromMonth(last),
      plotStart: fromMonth(plotFirst), plotEnd: fromMonth(last),
      selectedStart: selectedFirst !== null && selectedFirst <= selectedLast ? fromMonth(selectedFirst) : null,
      selectedEnd: selectedLast !== null && selectedFirst <= selectedLast ? fromMonth(selectedLast) : null
    };
  }

  function speedScale(values) {
    const low = Math.min(-20, ...values), high = Math.max(60, ...values);
    const raw = (high - low) / 6;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const fraction = raw / magnitude;
    const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
    const min = Math.floor(low / step) * step, max = Math.ceil(high / step) * step;
    const ticks = [];
    for (let value = min; value <= max + step / 100; value += step) ticks.push(Number(value.toFixed(8)));
    return { min, max, ticks };
  }

  function render(options = {}) {
    const prepared = prepare(options);
    const locale = options.locale || 'en-US', chinese = /^zh(?:-|$)/i.test(locale);
    const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const precise = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const monthFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', timeZone: 'UTC' });
    const formatMonth = value => monthFormatter.format(new Date(toDay(value) * DAY_MS));
    const defaults = chinese ? {
      title: '滚动平均排期推进速度',
      description: '表 A 和表 B 分别显示每个公告月份之前 12、24、36、48 个月的平均排期推进速度，两图使用相同坐标轴。阴影标记所选时间段。C、U、缺失或重复公告使对应窗口无法计算；负值表示净倒退。',
      chartTitle: chart => chart === 'A' ? '表 A · 最终裁定日期' : '表 B · 递交申请日期',
      speedAxis: '截止日期天数 / 公告月', bulletinAxis: '公告月份（滚动窗口终点）',
      windowLabel: months => `${months} 个月`, calendarReference: '30.4 天/月 ≈ 日历推进速度',
      selectedLabel: '所选时间段', latestLabel: month => `最新：${formatMonth(month)}`,
      latestValue: (months, value) => `${months}个月：${value === null ? '无数据' : decimal.format(value)}`,
      unavailableWindows: months => `整个历史均无法计算：${months.join('、')} 个月窗口`,
      noData: '没有完整的连续日期窗口可供计算',
      noHistory: '没有已保存的公告历史',
      tooltip: value => `表 ${value.chart} · ${formatMonth(value.bulletin)} · 过去 ${value.windowMonths} 个月：${precise.format(value.speedDaysPerMonth)} 截止日期天数/公告月（${formatMonth(value.windowStart)}至${formatMonth(value.bulletin)}）${value.selected ? ' · 所选时间段' : ''}`,
      selectionTooltip: (start, end) => `所选时间段：${formatMonth(start)}至${formatMonth(end)}`,
      monthTick: formatMonth, speedTick: value => integer.format(value)
    } : {
      title: 'Rolling average cutoff progression speed',
      description: 'Chart A and Chart B compare trailing 12-, 24-, 36-, and 48-month average cutoff progression speeds, using identical axes. The shaded band marks the selected period. C, U, missing, or duplicate observations leave gaps; negative values mean net retrogression.',
      chartTitle: chart => chart === 'A' ? 'Chart A · Final action dates' : 'Chart B · Dates for filing',
      speedAxis: 'Cutoff days / bulletin month', bulletinAxis: 'Bulletin month (rolling-window endpoint)',
      windowLabel: months => `${months} months`, calendarReference: '30.4 days/month ≈ calendar pace',
      selectedLabel: 'Selected period', latestLabel: month => `Latest: ${formatMonth(month)}`,
      latestValue: (months, value) => `${months}m: ${value === null ? 'N/A' : decimal.format(value)}`,
      unavailableWindows: months => `Unavailable throughout: ${months.join(', ')}-month window${months.length > 1 ? 's' : ''}`,
      noData: 'No complete consecutive dated window',
      noHistory: 'No saved bulletin history',
      tooltip: value => `Chart ${value.chart} · ${formatMonth(value.bulletin)} · trailing ${value.windowMonths} months: ${precise.format(value.speedDaysPerMonth)} cutoff days per bulletin month (${formatMonth(value.windowStart)} to ${formatMonth(value.bulletin)})${value.selected ? ' · selected period' : ''}`,
      selectionTooltip: (start, end) => `Selected period: ${formatMonth(start)} to ${formatMonth(end)}`,
      monthTick: formatMonth, speedTick: value => integer.format(value)
    };
    const labels = Object.assign(defaults, options.labels || {});
    const label = (key, ...args) => typeof labels[key] === 'function' ? labels[key](...args) : labels[key];
    const numeric = prepared.values.filter(value => value.speedDaysPerMonth !== null).map(value => value.speedDaysPerMonth);
    const scale = speedScale(numeric);
    const width = 900, height = 840, left = 96, right = 856, plotHeight = 220;
    const plotFirst = prepared.plotStart === null ? 0 : monthIndex(prepared.plotStart);
    const plotLast = prepared.plotEnd === null ? 0 : monthIndex(prepared.plotEnd);
    const x = month => plotLast === plotFirst ? (left + right) / 2 : left + (month - plotFirst) / (plotLast - plotFirst) * (right - left);
    const y = (speed, top) => top + (scale.max - speed) / (scale.max - scale.min) * plotHeight;
    const coordinate = value => Number(value.toFixed(2));
    const text = (xx, yy, value, attrs = '') => `<text x="${coordinate(xx)}" y="${coordinate(yy)}" ${attrs}>${escape(value)}</text>`;
    const line = (x1, y1, x2, y2, color, strokeWidth = 1, dash = '', attrs = '') => `<line x1="${coordinate(x1)}" y1="${coordinate(y1)}" x2="${coordinate(x2)}" y2="${coordinate(y2)}" stroke="${color}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''} ${attrs}/>`;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="rolling-speed-plot" role="img" aria-labelledby="rolling-speed-title rolling-speed-description" style="display:block;width:100%;height:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff"><title id="rolling-speed-title">${escape(label('title'))}</title><desc id="rolling-speed-description">${escape(label('description'))}</desc><rect width="${width}" height="${height}" fill="#fff"/>`;
    if (!prepared.points.length) return svg + text((left + right) / 2, 220, label('noHistory'), 'text-anchor="middle" fill="#64748b" font-size="14"') + '</svg>';

    const ticks = [];
    const stride = Math.max(1, Math.ceil((plotLast - plotFirst) / 5));
    for (let month = plotFirst; month <= plotLast; month += stride) ticks.push(month);
    if (ticks[ticks.length - 1] !== plotLast) {
      if (ticks.length > 1 && plotLast - ticks[ticks.length - 1] < stride / 2) ticks.pop();
      ticks.push(plotLast);
    }
    ['A', 'B'].forEach((chart, panelIndex) => {
      const top = 62 + panelIndex * 390, bottom = top + plotHeight;
      const subset = prepared.values.filter(value => value.chart === chart && monthIndex(value.bulletin) >= plotFirst);
      const unavailable = WINDOWS.filter(months => !subset.some(value => value.windowMonths === months && value.speedDaysPerMonth !== null));
      const hasNumeric = subset.some(value => value.speedDaysPerMonth !== null);
      let selectionBoundaries = '';
      svg += `<g data-rolling-panel="${chart}">`;
      svg += text(left, top - 38, label('chartTitle', chart), 'fill="#183f35" font-size="18" font-weight="700"');
      svg += text(right, top - 38, label('speedAxis'), 'text-anchor="end" fill="#64748b" font-size="14"');
      if (unavailable.length && hasNumeric) svg += text(left, top - 17, label('unavailableWindows', unavailable), 'class="rolling-unavailable-windows" fill="#64748b" font-size="14"');
      svg += `<rect data-negative-band="${chart}" x="${left}" y="${coordinate(y(0, top))}" width="${right - left}" height="${coordinate(bottom - y(0, top))}" fill="#fff5f4"/>`;
      if (prepared.selectedStart !== null) {
        const selectedX = x(monthIndex(prepared.selectedStart)), selectedRight = x(monthIndex(prepared.selectedEnd));
        const minimumWidth = plotLast === plotFirst ? 12 : (right - left) / (plotLast - plotFirst);
        const bandX = selectedX === selectedRight ? Math.max(left, selectedX - minimumWidth / 2) : selectedX;
        const bandRight = selectedX === selectedRight ? Math.min(right, selectedRight + minimumWidth / 2) : selectedRight;
        svg += `<rect data-selected-window="${chart}" data-selection-start="${prepared.selectedStart}" data-selection-end="${prepared.selectedEnd}" x="${coordinate(bandX)}" y="${top}" width="${coordinate(bandRight - bandX)}" height="${plotHeight}" fill="#edf5ef" fill-opacity="0.85"><title>${escape(label('selectionTooltip', prepared.selectedStart, prepared.selectedEnd))}</title></rect>`;
        for (const [boundary, bulletin] of [['start', prepared.selectedStart], ['end', prepared.selectedEnd]]) {
          const xx = x(monthIndex(bulletin));
          selectionBoundaries += line(xx, top, xx, bottom, '#91b59c', 1, '3 3', `data-selection-boundary="${boundary}" data-bulletin="${bulletin}"`);
        }
      }
      for (const speed of scale.ticks) {
        const yy = y(speed, top);
        svg += line(left, yy, right, yy, speed === 0 ? '#849189' : '#e6ece8', speed === 0 ? 1.5 : 1);
        svg += text(left - 12, yy + 4, label('speedTick', speed), 'text-anchor="end" fill="#64748b" font-size="15"');
      }
      for (const month of ticks) {
        const xx = x(month);
        svg += line(xx, top, xx, bottom, '#edf0ed');
        const anchor = month === plotFirst ? 'start' : month === plotLast ? 'end' : 'middle';
        svg += text(xx, bottom + 27, label('monthTick', fromMonth(month)), `text-anchor="${anchor}" fill="#64748b" font-size="15"`);
      }
      svg += line(left, y(CALENDAR_PACE, top), right, y(CALENDAR_PACE, top), '#829488', 1.2, '3 4', `data-calendar-reference="${chart}" data-speed="${CALENDAR_PACE}"`);
      svg += selectionBoundaries;
      svg += `<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="#94a3b8" stroke-width="1"/>`;
      SERIES.slice().reverse().forEach(series => {
        const values = subset.filter(value => value.windowMonths === series.months);
        let path = '', active = false, hovers = '';
        for (const value of values) {
          if (value.speedDaysPerMonth === null) { active = false; continue; }
          const px = coordinate(x(monthIndex(value.bulletin))), py = coordinate(y(value.speedDaysPerMonth, top));
          path += `${active ? 'L' : 'M'}${px} ${py}`;
          active = true;
          const latest = value.bulletin === prepared.lastBulletin;
          hovers += `<circle data-rolling-point="true" data-chart="${chart}" data-window="${series.months}" data-bulletin="${value.bulletin}" data-speed="${value.speedDaysPerMonth}" data-selected="${value.selected}" cx="${px}" cy="${py}" r="${latest ? 3.7 : 5}" fill="${latest ? series.color : 'transparent'}"${latest ? ' stroke="#fff" stroke-width="1.2"' : ''}><title>${escape(label('tooltip', value))}</title></circle>`;
        }
        svg += `<path class="rolling-speed-series" data-chart="${chart}" data-window="${series.months}" d="${path}" fill="none" stroke="${series.color}" stroke-width="${series.width}"${series.dash ? ` stroke-dasharray="${series.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"><title>${escape(label('windowLabel', series.months))}</title></path>${hovers}`;
      });
      if (!hasNumeric) svg += text((left + right) / 2, top + plotHeight / 2, label('noData'), 'class="rolling-no-data" text-anchor="middle" fill="#64748b" font-size="14"');
      svg += `<rect x="${left}" y="${bottom + 40}" width="${right - left}" height="64" rx="5" fill="#f4f7f5"/>`;
      svg += text(left + 12, bottom + 62, label('latestLabel', prepared.lastBulletin), 'fill="#475569" font-size="14" font-weight="600"');
      SERIES.forEach((series, index) => {
        const latest = subset.find(value => value.windowMonths === series.months && value.bulletin === prepared.lastBulletin);
        svg += text(left + 14 + index * ((right - left) / 4), bottom + 87, label('latestValue', series.months, latest?.speedDaysPerMonth ?? null), `fill="${series.color}" font-size="14" font-weight="600"`);
      });
      svg += '</g>';
    });
    svg += text((left + right) / 2, 817, label('bulletinAxis'), 'text-anchor="middle" fill="#334155" font-size="15" font-weight="600"');
    return svg + '</svg>';
  }

  const api = Object.freeze({ prepare, render, WINDOWS, CALENDAR_PACE });
  root.EBRollingSpeedChart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
