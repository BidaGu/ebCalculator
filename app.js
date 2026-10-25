(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const model = globalThis.EBModel;
  const data = globalThis.EB_DATA;
  const historyChart = globalThis.EBHistoryChart;
  const fiscalHeatmap = globalThis.EBHeatmap;
  const rollingSpeedChart = globalThis.EBRollingSpeedChart;
  const messages = {
    en: {
      CHINA: 'China mainland', INDIA: 'India', ROW: 'Rest of world',
      current: 'Current', unavailable: 'Unavailable', nonnumeric: 'Not numeric',
      speed: (value) => `${value} days / month`, days: (value) => `${value} days`,
      estimatedBulletin: 'ESTIMATED BULLETIN', closureEstimate: 'ESTIMATE WITH CLOSURE ASSUMPTION',
      wait: (months, latest) => `${months} ${months === 1 ? 'month' : 'months'} after ${latest}`,
      currentWait: 'No cutoff-date wait in the latest bulletin', latestStatus: 'LATEST STATUS',
      reached: 'Already reached', reachedWait: 'Your date is at or before the latest cutoff',
      stalled: 'No forward pace', stalledWait: 'Zero net movement in this window', noEstimate: 'NO ESTIMATE',
      retrogressing: 'Moving backward', retrogressingWait: 'Negative net movement in this window',
      unavailableWait: 'The latest bulletin is marked U', insufficient: 'No estimate',
      insufficientWait: 'This window cannot produce an estimate',
      reasonFallback: 'A forward estimate cannot be calculated from this window.',
      adjustmentBefore: 'Moved from',
      adjustmentAfter: (months) => `to October under the closure assumption, adding ${months} ${months === 1 ? 'month' : 'months'}.`,
      chart: (chart) => `CHART ${chart}`, filing: 'Dates for filing', finalAction: 'Final action dates',
      latestCutoff: 'Latest cutoff', average: (months) => `${months}-month average`, gap: 'Priority-date gap',
      tableCaption: (category, region) => `${category} ${region} cutoff dates in the selected averaging window`,
      tableCaptionGeneric: 'Bulletin cutoff dates used in the selected averaging window',
      allCurrent: 'Current throughout this window', noNumeric: 'No numeric cutoff dates',
      allCurrentDetail: 'Both charts are marked C throughout the selected history. There are no numeric dates to average.',
      noNumericDetail: 'Current, unavailable, and missing dates are shown in the table below.',
      plotTitle: (category, region) => `${category} ${region}: cutoff dates and calendar-day distances`,
      plotDescription: (observations, months, start, end) => `Five monthly step lines for ${observations} observations across ${months} monthly intervals, ${start} through ${end}. Solid Chart A/B cutoff dates use the left axis. The filing–final-action cutoff gap and each cutoff's distance to the bulletin month's 15th use the right axis in days and approximate months. Current distances are shown as zero; missing and unavailable observations interrupt their lines.`,
      chartTooltip: (chart, month, date) => `Chart ${chart} · ${month}: ${date}`,
      plotDateAxis: 'Cutoff date', plotDayAxis: 'Days (approx. months)', plotTickHeading: 'Days (≈ months)',
      plotBulletinAxis: 'Bulletin month', plotNoDate: 'No dated cutoff in this window', plotNoData: 'No cutoff or day-distance values in this window',
      plotCutoffA: 'Chart A cutoff', plotCutoffB: 'Chart B cutoff',
      plotGap: 'Filing–final-action cutoff gap', plotLagA: 'Final-action cutoff lag', plotLagB: 'Filing cutoff lag',
      distanceTooltip: (name, month, days, months) => `${name} · ${month}: ${days} days (≈ ${months} months)`,
      heatmapHeading: 'Monthly progression across fiscal years',
      heatmapTitle: (category, region) => `${category} ${region}: monthly cutoff progression`,
      heatmapDescription: (start, end, selectedStart, selectedEnd) => `Chart A and Chart B monthly cutoff movement in calendar days across all saved history, ${start} through ${end}. Fiscal-year rows run October through September. Outlined cells mark the selected averaging window, ${selectedStart} through ${selectedEnd}, including both endpoints.`,
      heatmapRange: (start, end) => `All history: ${start} – ${end}`,
      heatmapSelection: (start, end) => `Outlined: ${start} – ${end}`,
      speedHeading: 'Rolling progression speed',
      speedTitle: (category, region) => `${category} ${region}: rolling progression speed`,
      speedDescription: (start, end, selectedStart, selectedEnd) => `Chart A and Chart B trailing 12-, 24-, 36-, and 48-month average cutoff progression in days per bulletin month. Source history: ${start} through ${end}. Shading marks the visible part of the selected period, ${selectedStart} through ${selectedEnd}. Fixed trailing windows require complete dated history; invalid windows remain gaps.`,
      speedSourceRange: (start, end) => `Source history: ${start} – ${end}`,
      speedSelection: (start, end) => `Selected period: ${start} – ${end}`,
      checkInputs: 'Check your inputs', historyHeading: 'Selected progression history',
      checkInputsContinue: 'Check your inputs to continue',
      chartCaption: 'The selected window determines the average speed',
      chooseInputs: 'Choose a valid priority date and averaging window to see estimates.',
      invalidPriority: 'Enter a valid priority date to calculate an estimate.',
      windowSummary: (months, count) => `${months} ${months === 1 ? 'month' : 'months'} · ${count} observations`,
      estimateNote: (start, end, latest) => `Speed: ${start} – ${end}. Waits start at ${latest}, rounded up to a monthly bulletin.`,
      progression: (months) => `${months} ${months === 1 ? 'month' : 'months'} of progression`,
      observationCaption: (count, start, end) => `${count} observations · ${start} – ${end}`,
      dataLoadError: 'The bundled calculator files could not be loaded. Keep data/bulletins.js, model.js, history-chart.js, fiscal-heatmap.js, and rolling-speed-chart.js with the app when moving the folder.',
      dataUnavailable: 'Data unavailable',
      presetUnavailable: (months) => `The latest ${months} months are not available in the saved history. Choose a custom start and end bulletin.`
    },
    'zh-CN': {
      CHINA: '中国大陆', INDIA: '印度', ROW: '世界其他地区',
      current: '无排期（C）', unavailable: '暂不可用', nonnumeric: '无数值日期',
      speed: (value) => `${value} 天 / 月`, days: (value) => `${value} 天`,
      estimatedBulletin: '预计排期公告月份', closureEstimate: '已按表 B 关闭假设调整',
      wait: (months, latest) => `从 ${latest} 起等待 ${months} 个月`,
      currentWait: '最新公告中无截止日期限制', latestStatus: '最新状态',
      reached: '已达到', reachedWait: '您的优先日期不晚于最新截止日期',
      stalled: '未向前推进', stalledWait: '所选期间内净推进为零', noEstimate: '无法估算',
      retrogressing: '排期倒退', retrogressingWait: '所选期间内排期整体倒退',
      unavailableWait: '最新公告标记为 U', insufficient: '无法估算',
      insufficientWait: '无法根据所选期间得出估算',
      reasonFallback: '无法根据所选期间计算向前推进的估算。',
      adjustmentBefore: '按表 B 关闭假设，预计月份从',
      adjustmentAfter: (months) => `顺延至 10 月，增加 ${months} 个月等待时间。`,
      chart: (chart) => `表 ${chart}`, filing: '递交申请日期', finalAction: '最终裁定日期',
      latestCutoff: '最新截止日期', average: (months) => `${months} 个月平均速度`, gap: '与优先日期的差距',
      tableCaption: (category, region) => `${category} · ${region} 在所选平均速度计算期间内的截止日期`,
      tableCaptionGeneric: '所选平均速度计算期间使用的排期截止日期',
      allCurrent: '所选期间始终无排期', noNumeric: '没有数值截止日期',
      allCurrentDetail: '所选期间内，两张表均标记为 C，没有可用于计算平均速度的数值日期。',
      noNumericDetail: '无排期、暂不可用及缺失的日期均列于下表。',
      plotTitle: (category, region) => `${category} · ${region}：截止日期与日期差`,
      plotDescription: (observations, months, start, end) => `从 ${start} 至 ${end}，共 ${observations} 个观测值、${months} 个月间隔。五条阶梯曲线中，表 A 和表 B 截止日期实线使用左轴；两表截止日期之差、公告月份 15 日与各表截止日期之差使用右轴，显示天数及约合月数。无排期的日期差显示为零；缺失或暂不可用的数据保留断点。`,
      chartTooltip: (chart, month, date) => `表 ${chart} · ${month}：${date}`,
      plotDateAxis: '截止日期', plotDayAxis: '天数（约合月数）', plotTickHeading: '天数（≈ 月）',
      plotBulletinAxis: '公告月份', plotNoDate: '此区间没有数值截止日期', plotNoData: '此区间没有可绘制的截止日期或日期差',
      plotCutoffA: '表 A 截止日期', plotCutoffB: '表 B 截止日期',
      plotGap: '递交与最终裁定截止日期之差', plotLagA: '最终裁定截止日期滞后', plotLagB: '递交截止日期滞后',
      distanceTooltip: (name, month, days, months) => `${name} · ${month}：${days} 天（约 ${months} 个月）`,
      heatmapHeading: '按财年比较月度推进',
      heatmapTitle: (category, region) => `${category} · ${region}：每月排期推进天数`,
      heatmapDescription: (start, end, selectedStart, selectedEnd) => `表 A 和表 B 在 ${start} 至 ${end} 全部已保存历史中的月度截止日期变化，以自然日计。每行代表一个财年，从 10 月至次年 9 月。边框标出 ${selectedStart} 至 ${selectedEnd} 的所选平均速度计算区间，包括起止月份。`,
      heatmapRange: (start, end) => `全部历史：${start} 至 ${end}`,
      heatmapSelection: (start, end) => `边框区间：${start} 至 ${end}`,
      speedHeading: '滚动平均推进速度',
      speedTitle: (category, region) => `${category} · ${region}：滚动平均推进速度`,
      speedDescription: (start, end, selectedStart, selectedEnd) => `表 A 和表 B 过去 12、24、36 和 48 个月的平均推进速度，单位为每公告月推进的截止日期天数。源数据为 ${start} 至 ${end}。阴影标出所选期间（${selectedStart} 至 ${selectedEnd}）与图中日期范围重叠的部分。固定历史区间需要完整的具体日期记录；无法计算的区间保留断点。`,
      speedSourceRange: (start, end) => `源数据：${start} 至 ${end}`,
      speedSelection: (start, end) => `所选期间：${start} 至 ${end}`,
      checkInputs: '请检查输入', historyHeading: '所选期间的排期历史',
      checkInputsContinue: '请检查输入后继续',
      chartCaption: '所选历史期间决定平均推进速度',
      chooseInputs: '请选择有效的优先日期和平均速度计算期间以查看估算。',
      invalidPriority: '请输入有效的优先日期以计算估算结果。',
      windowSummary: (months, count) => `${months} 个月 · ${count} 个观测值`,
      estimateNote: (start, end, latest) => `速度计算期间：${start} 至 ${end}。等待时间从 ${latest} 起算，并向上取整至每月排期公告。`,
      progression: (months) => `${months} 个月的排期推进历史`,
      observationCaption: (count, start, end) => `${count} 个观测值 · ${start} 至 ${end}`,
      dataLoadError: '无法加载随附的计算器文件。移动文件夹时，请保留 data/bulletins.js、model.js、history-chart.js、fiscal-heatmap.js 和 rolling-speed-chart.js 文件。',
      dataUnavailable: '数据不可用',
      presetUnavailable: (months) => `已保存的历史数据不足最近 ${months} 个月。请自行选择起始和结束公告。`
    }
  };
  const getLocale = () => globalThis.EBI18n?.getLocale() === 'zh-CN' ? 'zh-CN' : 'en';
  const localeTag = () => getLocale() === 'zh-CN' ? 'zh-CN' : 'en-US';
  const text = (key, ...args) => {
    const value = messages[getLocale()][key];
    return typeof value === 'function' ? value(...args) : value;
  };
  let dateFormatter, monthFormatter, shortMonthFormatter, axisFormatter;
  function refreshFormatters() {
    const locale = localeTag();
    dateFormatter = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
    monthFormatter = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric', timeZone: 'UTC'});
    shortMonthFormatter = new Intl.DateTimeFormat(locale, {month: 'short', timeZone: 'UTC'});
    axisFormatter = new Intl.DateTimeFormat(locale, {month: 'short', year: 'numeric', timeZone: 'UTC'});
  }
  refreshFormatters();
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  const dateObject = (value) => new Date(`${value}T00:00:00Z`);
  const formatDate = (value) => value === 'currentPD' ? text('current') : value === 'unauthorized' ? text('unavailable') : value ? dateFormatter.format(dateObject(value)) : '—';
  const formatMonth = (value) => monthFormatter.format(dateObject(value));
  const formatSpeed = (value) => value == null ? text('nonnumeric') : text('speed', `${value < 0 ? '−' : ''}${Math.abs(value).toLocaleString(localeTag(), {minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false})}`);

  function translateModelMessage(message) {
    if (getLocale() === 'en') return message;
    const translations = {
      'Expected a calendar date in YYYY-MM-DD format.': '日期须采用 YYYY-MM-DD 格式。',
      'Expected an integer UTC calendar day.': 'UTC 日历天数须为整数。',
      'Date is outside the supported years 0001–9999.': '日期超出支持的年份范围（0001–9999）。',
      'Month offset must be an integer.': '月份偏移量须为整数。',
      'Category must be EB1, EB2, or EB3.': '请选择 EB1、EB2 或 EB3 类别。',
      'Region must be ROW, CHINA, or INDIA.': '请选择世界其他地区、中国大陆或印度。',
      'At least one bulletin row is required.': '至少需要一条排期公告数据。',
      'Each bulletin must be an object.': '排期公告数据格式不正确。',
      'Averaging-window dates must be the first day of a month.': '平均速度计算期间的起止日期须为每月第一天。',
      'Averaging-window start must be earlier than its end.': '平均速度计算期间的起始月份须早于结束月份。',
      'The averaging window must be within the available bulletin dates.': '平均速度计算期间须在已有公告日期范围内。',
      'The latest bulletin lists this chart as current.': '最新公告将此表标记为无排期（C）。',
      'The latest bulletin lists this chart as unavailable (U).': '最新公告将此表标记为暂不可用（U）。',
      'The latest cutoff has reached or passed this priority date.': '最新截止日期已达到或超过该优先日期。',
      'The latest cutoff must be a valid numeric date to project from the latest bulletin.': '最新截止日期须为有效的数值日期，才能以最新公告为起点进行估算。',
      'All cutoffs in this chart’s selected averaging window must be valid numeric dates; C, U, missing, or invalid values cannot define a progression speed.': '此表在所选期间内的全部截止日期须为有效的数值日期；C、U、缺失值或无效值不能用于计算推进速度。',
      'There was no net cutoff advancement over the selected averaging window.': '所选期间内截止日期没有净推进。',
      'The cutoff moved backward overall during the selected averaging window.': '所选期间内截止日期整体倒退。',
      'The projected bulletin falls outside the supported calendar years 0001–9999.': '预计公告月份超出支持的年份范围（0001–9999）。'
    };
    if (translations[message]) return translations[message];
    const invalidDate = /^Invalid calendar date: (.*)$/.exec(message || '');
    if (invalidDate) return `无效的日历日期：${invalidDate[1]}`;
    const incomplete = /^The selected (\d+)-month window requires (\d+) consecutive monthly bulletins, with exactly one observation per month\.$/.exec(message || '');
    if (incomplete) return `所选 ${incomplete[1]} 个月期间需要连续 ${incomplete[2]} 个月的排期公告，且每月恰有一个观测值。`;
    const projected = /^Projected from the latest bulletin using the selected window’s signed net cutoff advancement divided by (\d+) calendar months\.(.*)$/.exec(message || '');
    if (projected) return `以最新公告为起点，使用所选期间截止日期的有符号净推进天数除以 ${projected[1]} 个日历月进行估算。${projected[2] ? '按表 B 在 5 月至 9 月关闭的假设，预计公告顺延至同年 10 月 1 日。' : ''}`;
    return text('reasonFallback');
  }

  function chartCard(chart, result) {
    const isB = chart === 'b';
    let title, wait, kicker;
    kicker = text('estimatedBulletin');
    switch (result.status) {
      case 'projected':
        title = formatMonth(result.estimatedBulletin);
        wait = text('wait', result.bulletinSteps, formatMonth(state.latestBulletin));
        if (isB && result.closureAdjusted) kicker = text('closureEstimate');
        break;
      case 'current': title = text('current'); wait = text('currentWait'); kicker = text('latestStatus'); break;
      case 'reached': title = text('reached'); wait = text('reachedWait'); kicker = text('latestStatus'); break;
      case 'stalled': title = text('stalled'); wait = text('stalledWait'); kicker = text('noEstimate'); break;
      case 'retrogressing': title = text('retrogressing'); wait = text('retrogressingWait'); kicker = text('noEstimate'); break;
      case 'unavailable': title = text('unavailable'); wait = text('unavailableWait'); kicker = text('latestStatus'); break;
      default: title = text('insufficient'); wait = text('insufficientWait'); kicker = text('noEstimate');
    }
    const reason = ['stalled', 'retrogressing', 'insufficient', 'unavailable'].includes(result.status)
      ? `<p class="result-reason">${escape(result.reason ? translateModelMessage(result.reason) : text('reasonFallback'))}</p>` : '';
    const adjustment = isB && result.status === 'projected' && result.closureAdjusted
      ? `<p class="closure-detail">${escape(text('adjustmentBefore'))} <strong>${escape(formatMonth(result.unadjustedEstimatedBulletin))}</strong> ${escape(text('adjustmentAfter', result.closureAdjustmentMonths))}</p>` : '';
    return `<article class="result-card ${chart}" data-chart="${chart}" data-status="${escape(result.status)}" aria-labelledby="chart-${chart}-title">
      <div class="chart-label" id="chart-${chart}-title"><i aria-hidden="true"></i>${escape(text('chart', chart.toUpperCase()))}</div>
      <p class="chart-name">${escape(text(isB ? 'filing' : 'finalAction'))}</p>
      <p class="result-kicker">${kicker}</p><p class="result-value${result.status === 'projected' ? '' : ' state'}">${escape(title)}</p>
      <p class="result-wait">${escape(wait)}</p>
      <dl class="result-stats"><div><dt>${escape(text('latestCutoff'))}</dt><dd>${escape(formatDate(result.latestCutoff))}</dd></div><div><dt>${escape(text('average', state.windowMonths))}</dt><dd>${escape(formatSpeed(result.speedDaysPerMonth))}</dd></div><div><dt>${escape(text('gap'))}</dt><dd>${escape(result.gapDays == null ? text('nonnumeric') : text('days', result.gapDays.toLocaleString(localeTag())))}</dd></div></dl>${reason}${adjustment}</article>`;
  }

  function renderHistory(history) {
    $('history-table-caption').textContent = text('tableCaption', state.category, text(state.region));
    $('history-table').innerHTML = history.map((row) => `<tr><td>${escape(formatMonth(row.bulletin))}</td><td>${escape(formatDate(row.b))}</td><td>${escape(formatDate(row.a))}</td></tr>`).join('');
    const integer = (value) => value.toLocaleString(localeTag(), {maximumFractionDigits: 0});
    const decimal = (value) => value.toLocaleString(localeTag(), {minimumFractionDigits: 1, maximumFractionDigits: 1});
    $('history-chart').innerHTML = historyChart.render({
      history, windowStart: state.windowStart, windowEnd: state.windowEnd, locale: localeTag(),
      labels: {
        title: text('plotTitle', state.category, text(state.region)),
        description: text('plotDescription', history.length, state.windowMonths, formatMonth(state.windowStart), formatMonth(state.windowEnd)),
        dateAxis: text('plotDateAxis'), dayAxis: text('plotDayAxis'), tickHeading: text('plotTickHeading'),
        bulletinAxis: text('plotBulletinAxis'), noDateLabel: text('plotNoDate'), noDataLabel: text('plotNoData'),
        cutoffA: text('plotCutoffA'), cutoffB: text('plotCutoffB'), gap: text('plotGap'),
        lagA: text('plotLagA'), lagB: text('plotLagB'),
        dateTick: (value) => axisFormatter.format(dateObject(value)),
        dayTick: (days, months) => `${integer(days)} (${decimal(months)})`,
        cutoffTooltip: (chart, bulletin, cutoff) => text('chartTooltip', chart, formatMonth(bulletin), formatDate(cutoff)),
        distanceTooltip: (name, bulletin, days, months) => text('distanceTooltip', name, formatMonth(bulletin), integer(days), decimal(months))
      }
    });
    // Full source history is needed for monthly movement and fixed trailing
    // averages, independently of the window used to calculate the estimate.
    const allHistory = data.rows.map((row) => ({
      bulletin: row.bulletin,
      a: row[state.category]?.[state.region]?.a,
      b: row[state.category]?.[state.region]?.b
    }));
    const first = axisFormatter.format(dateObject(bulletinDates[0]));
    const last = axisFormatter.format(dateObject(lastBulletin));
    const start = axisFormatter.format(dateObject(state.windowStart));
    const end = axisFormatter.format(dateObject(state.windowEnd));
    $('fiscal-heatmap').innerHTML = fiscalHeatmap.render({
      history: allHistory, windowStart: state.windowStart, windowEnd: state.windowEnd, locale: localeTag(),
      labels: {
        title: text('heatmapTitle', state.category, text(state.region)),
        description: text('heatmapDescription', first, last, start, end),
        chartTitle: (chart) => `${text('chart', chart)} · ${text(chart === 'A' ? 'finalAction' : 'filing')}`
      }
    });
    $('heatmap-range').textContent = text('heatmapRange', first, last);
    $('heatmap-selection').textContent = text('heatmapSelection', start, end);
    $('rolling-speed-chart').innerHTML = rollingSpeedChart.render({
      history: allHistory, windowStart: state.windowStart, windowEnd: state.windowEnd, locale: localeTag(),
      labels: {
        title: text('speedTitle', state.category, text(state.region)),
        description: text('speedDescription', first, last, start, end),
        chartTitle: (chart) => `${text('chart', chart)} · ${text(chart === 'A' ? 'finalAction' : 'filing')}`
      }
    });
    $('speed-source-range').textContent = text('speedSourceRange', first, last);
    $('speed-selection').textContent = text('speedSelection', start, end);
  }

  let state;
  let activePlot = 'lines';
  const plotViews = ['lines', 'heatmap', 'speed'];
  function updateHistoryHeading() {
    if (state) $('history-heading').textContent = activePlot === 'speed' ? text('speedHeading')
      : activePlot === 'heatmap' ? text('heatmapHeading') : text('progression', state.windowMonths);
  }
  function activatePlot(view, focus = false) {
    activePlot = view;
    for (const name of plotViews) {
      const selected = name === view;
      const tab = $(`history-tab-${name}`);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`history-panel-${name}`).hidden = !selected;
    }
    updateHistoryHeading();
    if (focus) $(`history-tab-${view}`).focus();
  }
  for (const view of plotViews) {
    const tab = $(`history-tab-${view}`);
    tab.addEventListener('click', () => activatePlot(view));
    tab.addEventListener('keydown', (event) => {
      const index = plotViews.indexOf(view);
      let next;
      if (event.key === 'ArrowRight') next = plotViews[(index + 1) % plotViews.length];
      else if (event.key === 'ArrowLeft') next = plotViews[(index + plotViews.length - 1) % plotViews.length];
      else if (event.key === 'Home') next = plotViews[0];
      else if (event.key === 'End') next = plotViews[plotViews.length - 1];
      if (next) { event.preventDefault(); activatePlot(next, true); }
    });
  }

  function updateWindowPresets() {
    for (const {months, id} of windowPresets) {
      const start = model.shiftMonths(lastBulletin, -months);
      const active = $('window-start').value === start && $('window-end').value === lastBulletin;
      $(id).setAttribute('aria-pressed', String(active));
    }
  }

  function clearResults(message) {
    state = undefined;
    $('form-error').textContent = message;
    $('form-error').hidden = false;
    $('result-cards').innerHTML = '';
    $('target-summary').textContent = text('checkInputs');
    $('history-heading').textContent = text('historyHeading');
    $('history-chart').innerHTML = '';
    $('fiscal-heatmap').innerHTML = '';
    $('heatmap-range').textContent = '';
    $('heatmap-selection').textContent = '';
    $('rolling-speed-chart').innerHTML = '';
    $('speed-source-range').textContent = '';
    $('speed-selection').textContent = '';
    $('history-table').innerHTML = '';
    $('history-table-caption').textContent = text('tableCaptionGeneric');
    $('window-label').textContent = text('checkInputsContinue');
    $('chart-caption').textContent = text('chartCaption');
    $('estimate-note').textContent = text('chooseInputs');
  }

  function calculate() {
    updateWindowPresets();
    // Keep the data badge localized even while another input is invalid.
    $('latest-bulletin').textContent = formatMonth(lastBulletin);
    const input = $('priority-date');
    if (!input.checkValidity()) {
      clearResults(text('invalidPriority'));
      return;
    }
    try {
      state = model.estimate({rows: data.rows, category: $('category').value, region: $('region').value, priorityDate: input.value, windowStart: $('window-start').value, windowEnd: $('window-end').value});
      $('form-error').hidden = true;
      $('latest-bulletin').textContent = formatMonth(state.latestBulletin);
      $('window-label').textContent = text('windowSummary', state.windowMonths, state.history.length);
      $('target-summary').textContent = `${state.category} · ${text(state.region)} · ${formatDate(state.priorityDate)}`;
      $('result-cards').innerHTML = chartCard('b', state.charts.b) + chartCard('a', state.charts.a);
      $('estimate-note').textContent = text('estimateNote', axisFormatter.format(dateObject(state.windowStart)), axisFormatter.format(dateObject(state.windowEnd)), formatMonth(state.latestBulletin));
      updateHistoryHeading();
      $('chart-caption').textContent = text('observationCaption', state.history.length, axisFormatter.format(dateObject(state.windowStart)), axisFormatter.format(dateObject(state.windowEnd)));
      renderHistory(state.history);
    } catch (error) {
      clearResults(translateModelMessage(error.message));
    }
  }
  if (!model || !historyChart || typeof historyChart.render !== 'function' || !fiscalHeatmap || typeof fiscalHeatmap.render !== 'function' || !rollingSpeedChart || typeof rollingSpeedChart.render !== 'function' || !data || !Array.isArray(data.rows) || !data.rows.length) {
    const showDataError = () => {
      $('form-error').hidden = false;
      $('form-error').textContent = text('dataLoadError');
      $('latest-bulletin').textContent = text('dataUnavailable');
    };
    showDataError();
    document.addEventListener('eb-language-change', showDataError);
    return;
  }
  const bulletinDates = [...new Set(data.rows.map((row) => row.bulletin))].sort();
  const lastBulletin = bulletinDates[bulletinDates.length - 1];
  const windowPresets = [{months: 24, id: 'latest-24-months'}, {months: 12, id: 'latest-12-months'}];
  function populateBulletinOptions() {
    const start = $('window-start').value, end = $('window-end').value;
    const options = bulletinDates.slice().reverse().map((bulletin) => `<option value="${escape(bulletin)}">${escape(axisFormatter.format(dateObject(bulletin)))}</option>`).join('');
    $('window-start').innerHTML = options;
    $('window-end').innerHTML = options;
    if (bulletinDates.includes(start)) $('window-start').value = start;
    if (bulletinDates.includes(end)) $('window-end').value = end;
  }
  populateBulletinOptions();
  function applyWindowPreset(months) {
    const start = model.shiftMonths(lastBulletin, -months);
    if (!bulletinDates.includes(start)) {
      updateWindowPresets();
      clearResults(text('presetUnavailable', months));
      return;
    }
    $('window-start').value = start;
    $('window-end').value = lastBulletin;
    // Setting select values does not emit change events, so refresh explicitly.
    calculate();
  }
  $('calculator-form').addEventListener('submit', (event) => {event.preventDefault(); calculate();});
  $('category').addEventListener('change', calculate);
  $('region').addEventListener('change', calculate);
  $('priority-date').addEventListener('change', calculate);
  $('window-start').addEventListener('change', calculate);
  $('window-end').addEventListener('change', calculate);
  for (const {months, id} of windowPresets) $(id).addEventListener('click', () => applyWindowPreset(months));
  document.addEventListener('eb-language-change', () => {
    refreshFormatters();
    populateBulletinOptions();
    calculate();
  });
  applyWindowPreset(24);
}());
