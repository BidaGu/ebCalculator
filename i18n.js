(function () {
  'use strict';

  const storageKey = 'eb-calculator-language';
  const messages = {
    en: {
      documentTitle: 'Employment-Based Priority Date Calculator',
      description: 'Estimate when EB1, EB2, and EB3 Chart A and Chart B reach your priority date using a custom window of saved Visa Bulletin history.',
      pageTitle: 'When could your date be reached?', latestBulletin: 'Latest saved bulletin',
      viewOnGithub: 'View on GitHub', feedbackPrompt: 'Found an issue or have a suggestion?',
      reportOnGithub: 'Report it on GitHub.', starPrompt: 'If you find this tool useful, consider',
      starOnGithub: 'giving it a star ⭐.',
      yourDetails: 'YOUR DETAILS', setTarget: 'Set your target', category: 'Employment category',
      region: 'Chargeability region', china: 'China — mainland', india: 'India', restOfWorld: 'Rest of world',
      priorityDate: 'Priority date', priorityHint: 'A sample date is filled in. Replace it with yours.',
      averagingWindow: 'Averaging window',
      windowHelp: 'Choose the historical period used to calculate each chart’s average progression speed. That speed is then used to estimate when the cutoff date could reach your priority date.',
      startBulletin: 'Start bulletin', endBulletin: 'End bulletin',
      windowHint: 'Both endpoints count. Choose at least one monthly interval.', historyShortcuts: 'Recent history shortcuts',
      latestTwelve: 'Use latest 12 months', latestTwentyFour: 'Use latest 24 months', sharedWindow: 'Both charts use the same history window.',
      estimateResults: 'Estimate results', yourEstimates: 'YOUR ESTIMATES',
      closureTitle: 'Chart B closure assumption',
      closureNote: 'Chart B is assumed closed from May through September. A projected date in these months moves to October of the same year, the start of the next fiscal year. This adjustment applies to future Chart B estimates only.',
      historyEyebrow: 'THE HISTORY BEHIND THE ESTIMATE', chartB: 'Chart B', chartA: 'Chart A',
      verticalAxis: 'Left: cutoff dates · Right: days (approx. months)', viewDates: 'View the underlying dates', bulletinMonth: 'Bulletin month',
      historyLegend: 'History chart series', historyChartRegion: 'Cutoff dates and day distances',
      chartACutoff: 'Chart A cutoff', chartBCutoff: 'Chart B cutoff',
      filingFinalGap: 'Filing–final-action cutoff gap', finalActionLag: 'Final-action cutoff lag', filingLag: 'Filing cutoff lag',
      gapExplanation: 'B − A: distance between the two cutoff dates.',
      finalLagExplanation: "Bulletin month's 15th − A: how far the final-action cutoff trails that reference date.",
      filingLagExplanation: "Bulletin month's 15th − B: how far the filing cutoff trails that reference date.",
      historyScrollHint: 'Scroll sideways to see the full chart on a narrow screen.',
      historyDistanceNote: "These date gaps are not expected waits or I-485 processing times. Chart B filing use depends on USCIS's monthly chart selection.",
      historyCurrentNote: 'Current is shown as 0 on distance lines, with solid cutoff lines omitted. Unavailable and missing observations remain gaps. Months are approximate (365.25 ÷ 12 days per month).',
      historyTabs: 'History plot views', linesTab: 'Cutoffs & gaps', heatmapTab: 'Monthly heatmap',
      heatmapIntro: 'Monthly cutoff movement in days, across all saved history. Compare the same month down each column.',
      heatmapLegend: 'Heatmap key', heatmapRegion: 'Monthly progression by fiscal year',
      heatmapForward: '+ Forward', heatmapUnchanged: '0 Unchanged', heatmapBackward: '− Retrogression', heatmapSelected: 'Selected window',
      heatmapWindowNote: "Outlined cells mark both endpoints and every saved bulletin in the selected window. Each cell compares its cutoff with the previous calendar month's cutoff, including a previous month outside the window.",
      heatmapStatusNote: 'C = Current; U = Unavailable; C→D / U→D = return to a dated cutoff. — means no comparable prior month or outside saved history. These states are not counted as zero movement.',
      heatmapScaleNote: 'Fiscal years run October–September. Color intensity caps at ±450 days; the numbers show the full change.',
      speedTab: 'Rolling speed', speedLegend: 'Rolling speed key', speedRegion: 'Trailing average cutoff progression speed',
      speedIntro: 'Compare trailing 12-, 24-, 36-, and 48-month average progression. Each point uses a window ending at that bulletin month.',
      speedTwelve: '12 months', speedTwentyFour: '24 months', speedThirtySix: '36 months', speedFortyEight: '48 months',
      speedCalendar: '30.4 days/month ≈ calendar pace', speedSelected: 'Selected period',
      speedWindowNote: 'Shading marks the selected period where it overlaps the plotted dates. The four lines always use their fixed trailing windows and all saved history, independently of the averaging window used for the estimate.',
      speedMethodNote: 'Speed at month t = [cutoff(t) − cutoff(t − N months)] ÷ N, in cutoff days per bulletin month. Each N-month rate needs N + 1 consecutive dated observations. Current, Unavailable, and missing values leave gaps; negative rates mean net retrogression.',
      speedReferenceNote: 'Rates describe historical cutoff movement, not applicant waiting times or guaranteed future speeds. The 30.4 reference is approximate calendar pace (365.25 ÷ 12).',
      methodEyebrow: 'A SIMPLE, VISIBLE ASSUMPTION', methodHeading: 'Your selected pace continues.',
      methodDescription: 'The selected history sets the speed. The latest saved cutoff is always the starting point for your estimate.',
      averageSpeed: 'Average speed', speedFormula: '(Window end cutoff − window start cutoff) ÷ months',
      speedDescription: 'Signed calendar-day movement across the selected window', estimatedWait: 'Estimated wait',
      waitFormula: '(Your date − latest cutoff) ÷ average speed', waitDescription: 'Projected from the latest saved bulletin, rounded up',
      disclaimer: 'A historical extrapolation, not a prediction or a filing / approval determination.', runsLocally: 'Runs locally', noDataSent: 'No data sent'
    },
    'zh-CN': {
      documentTitle: '职业移民优先日期计算器',
      description: '根据自选时段的历史签证公告，估算 EB1、EB2 和 EB3 的表 A、表 B 何时推进至您的优先日期。',
      pageTitle: '何时能到您的优先日期？', latestBulletin: '最新已保存的签证公告',
      viewOnGithub: '在 GitHub 上查看', feedbackPrompt: '发现问题或有改进建议？',
      reportOnGithub: '在 GitHub 上反馈。', starPrompt: '如果您觉得这个工具有帮助，欢迎',
      starOnGithub: '在 GitHub 上点个 Star ⭐。',
      yourDetails: '您的信息', setTarget: '设定您的目标', category: '职业移民类别',
      region: '排期所属地区', china: '中国大陆', india: '印度', restOfWorld: '世界其他地区',
      priorityDate: '优先日期', priorityHint: '当前填入的是示例日期，请替换为您的优先日期。',
      averagingWindow: '平均速度计算区间',
      windowHelp: '选择一段历史时期，用于分别计算表 A 和表 B 的平均排期推进速度，再据此估算排期何时能到您的优先日期。',
      startBulletin: '起始公告月份', endBulletin: '结束公告月份',
      windowHint: '计算包含起止月份，两者至少间隔一个月。', historyShortcuts: '近期历史区间快捷选项',
      latestTwelve: '使用最近 12 个月', latestTwentyFour: '使用最近 24 个月', sharedWindow: '表 A 和表 B 使用相同的历史区间。',
      estimateResults: '估算结果', yourEstimates: '您的估算结果',
      closureTitle: '表 B 关闭假设',
      closureNote: '假设表 B 在每年 5 月至 9 月关闭。若预计到达月份在此期间，则顺延至同年 10 月（下一财年开始）。此调整仅适用于表 B 的未来估算。',
      historyEyebrow: '估算所依据的历史数据', chartB: '表 B', chartA: '表 A',
      verticalAxis: '左轴：截止日期 · 右轴：天数（约合月数）', viewDates: '查看原始日期', bulletinMonth: '公告月份',
      historyLegend: '历史图表曲线', historyChartRegion: '截止日期与日期差',
      chartACutoff: '表 A 截止日期', chartBCutoff: '表 B 截止日期',
      filingFinalGap: '递交与最终裁定截止日期之差', finalActionLag: '最终裁定截止日期滞后', filingLag: '递交截止日期滞后',
      gapExplanation: 'B − A：两张表截止日期之间的天数差。',
      finalLagExplanation: '公告月份 15 日 − A：最终裁定截止日期距该参考日期的天数。',
      filingLagExplanation: '公告月份 15 日 − B：递交截止日期距该参考日期的天数。',
      historyScrollHint: '屏幕较窄时，可左右滚动查看完整图表。',
      historyDistanceNote: '这些日期差不代表实际等待时间或 I-485 审理时长。能否使用表 B 递交 I-485，取决于 USCIS 当月指定的表格。',
      historyCurrentNote: '无排期（C）在日期差曲线上显示为 0，截止日期实线留空；暂不可用（U）和缺失数据均保留断点。月数为近似值，按每月 365.25 ÷ 12 天换算。',
      historyTabs: '历史图表视图', linesTab: '截止日期与日期差', heatmapTab: '月度推进热图',
      heatmapIntro: '显示全部已保存历史中，每月截止日期的推进天数。沿同一列可比较不同年份的同一个月。',
      heatmapLegend: '热图图例', heatmapRegion: '按财年排列的月度推进天数',
      heatmapForward: '+ 向前推进', heatmapUnchanged: '0 未变化', heatmapBackward: '− 排期倒退', heatmapSelected: '所选区间',
      heatmapWindowNote: '边框标出所选区间内的全部已保存公告，包括起止月份。每个单元格均与前一个自然月的截止日期比较，即使前一个月位于所选区间之外。',
      heatmapStatusNote: 'C = 无排期；U = 暂不可用；C→D / U→D = 恢复为具体截止日期。— 表示没有可比较的上月日期，或不在已保存的历史范围内。这些状态不计为零推进。',
      heatmapScaleNote: '财年从 10 月至次年 9 月。颜色深浅在 ±450 天处封顶；数字显示完整变化天数。',
      speedTab: '滚动推进速度', speedLegend: '滚动推进速度图例', speedRegion: '截止日期的滚动平均推进速度',
      speedIntro: '比较过去 12、24、36 和 48 个月的平均推进速度。每个点均使用截至该公告月份的历史区间。',
      speedTwelve: '12 个月', speedTwentyFour: '24 个月', speedThirtySix: '36 个月', speedFortyEight: '48 个月',
      speedCalendar: '30.4 天/月 ≈ 日历推进速度', speedSelected: '所选期间',
      speedWindowNote: '阴影标出所选期间与图中日期范围重叠的部分。四条曲线始终使用各自固定长度的历史区间及全部已保存历史，不受估算所用平均速度计算区间的限制。',
      speedMethodNote: '速度 =（当月截止日期 − N 个月前的截止日期）÷ N，单位为每公告月推进的截止日期天数。N 个月的速度需要连续 N + 1 个具体日期观测值。无排期、暂不可用和缺失值均保留断点；负值表示净倒退。',
      speedReferenceNote: '这些速度描述历史排期变化，不代表申请人的等待时间，也不保证未来速度。30.4 参考线为近似日历推进速度（365.25 ÷ 12）。',
      methodEyebrow: '简单且明确的假设', methodHeading: '假设所选区间的推进速度持续。',
      methodDescription: '所选历史区间决定平均推进速度，估算始终从最新保存的排期截止日期开始。',
      averageSpeed: '平均推进速度', speedFormula: '（区间结束排期日期 − 区间起始排期日期）÷ 月数',
      speedDescription: '按自然日计算区间内的净推进，倒退计为负值', estimatedWait: '预计等待时间',
      waitFormula: '（您的优先日期 − 最新排期截止日期）÷ 平均推进速度', waitDescription: '从最新保存的公告月份起算，向上取整至整月',
      disclaimer: '本工具仅根据历史数据外推，不构成预测，也不判断递交申请或获批资格。', runsLocally: '本地运行', noDataSent: '不发送数据'
    }
  };

  let locale = 'en';
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(messages, saved)) locale = saved;
  } catch (_) { /* Browser storage may be unavailable when opened as a local file. */ }

  function applyLanguage(nextLocale, notify) {
    if (!Object.hasOwn(messages, nextLocale)) return;
    locale = nextLocale;
    const copy = messages[locale];
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = copy.description;
    for (const node of document.querySelectorAll('[data-i18n]')) {
      const text = copy[node.dataset.i18n];
      if (text !== undefined) node.textContent = text;
    }
    for (const node of document.querySelectorAll('[data-i18n-aria-label]')) {
      const text = copy[node.dataset.i18nAriaLabel];
      if (text !== undefined) node.setAttribute('aria-label', text);
    }
    document.getElementById('language-select').value = locale;
    if (notify) {
      try { localStorage.setItem(storageKey, locale); } catch (_) { /* Language switching still works without storage. */ }
      document.dispatchEvent(new CustomEvent('eb-language-change', {detail: {locale}}));
    }
  }

  globalThis.EBI18n = Object.freeze({getLocale: () => locale});
  document.getElementById('language-select').addEventListener('change', (event) => applyLanguage(event.target.value, true));
  applyLanguage(locale, false);
}());
