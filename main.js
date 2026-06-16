/**
 * FIT5147 DVP — The Global Growth of Formula 1 Fandom
 * Tanisha Thapa (35909684) — Semester 1, 2026
 *
 * D3 v7 interactive narrative visualisation.
 * Sheet 5 realisation: choropleth (Sheet 2) + bump chart + country drill-down
 * (Sheet 3) + event timeline + slope chart + peak month heatmap (Sheet 4).
 */

//Shared state 
const state = {
  selectedCountry: null,
  selectedYear: 2022,
  activeEvent: null,
};

//Colour helpers
const TRAD = new Set(['GB','DE','IT','ES','BR']);
const TRAD_COLOR    = '#1f77b4';
const NONTRAD_COLOR = '#ff7f0e';

const mapScale = d3.scaleSequential()
  .domain([0, 120])
  .interpolator(d3.interpolateRgbBasis([
    '#1a2a6e','#2463a8','#4A90A4','#e8c56e','#F4A261','#e07b3d'
  ]));

function peakMonthColor(m) {
  if (m === 3)              return '#378add';
  if (m === 10 || m === 11) return '#F4A261';
  if (m === 12)             return '#D55E00';
  if (m === 2)              return '#009E73';
  return '#3a3a5a';
}

//Tooltip
const tooltip = d3.select('#tooltip');

function showTooltip(title, rows, event) {
  d3.select('#tt-title').text(title);
  d3.select('#tt-body').html(
    rows.map(r =>
      `<div class="tt-row"><span>${r[0]}</span><span class="tt-val">${r[1]}</span></div>`
    ).join('')
  );
  tooltip.style('opacity', 1);
  moveTooltip(event);
}
function moveTooltip(event) {
  tooltip
    .style('left', Math.min(event.clientX + 14, window.innerWidth  - 240) + 'px')
    .style('top',  Math.min(event.clientY - 10, window.innerHeight - 120) + 'px');
}
function hideTooltip() { tooltip.style('opacity', 0); }

//Linked country selection
function selectCountry(code) {
  state.selectedCountry = code;
  d3.select('#onboarding').style('display', 'none');

  // Sync map highlight
  d3.selectAll('.country-path').classed('selected', d => d.properties?.iso === code);
  // Sync Singapore dot
  d3.selectAll('.sg-dot').classed('selected', code === 'SG');

  // Sync bump chart
  d3.selectAll('.bump-line')
    .classed('highlighted', d => d[0] === code)
    .classed('dimmed',      d => d[0] !== code);
  d3.selectAll('.bump-label')
    .classed('highlighted', function() { return d3.select(this).attr('data-cc') === code; });

  // Sync slope chart — highlight selected country, dim others
  // (only if no event pill is active; event pills manage their own focus)
  if (!state.activeEvent) {
    d3.selectAll('.slope-group')
      .style('opacity', function() {
        return d3.select(this).attr('data-cc') === code ? 1 : 0.15;
      });
    d3.selectAll('.slope-group').filter(function() {
      return d3.select(this).attr('data-cc') === code;
    }).raise();
  }

  renderCountryPanel(code);
}

//Main
Promise.all([
  d3.json('data/interest_by_country.json'),
  d3.json('data/global_trend.json'),
  d3.json('data/driver_perf.json'),
  d3.json('data/media_events.json'),
  d3.json('data/slope_data.json'),
  d3.json('data/peak_month.json'),
  d3.json('data/champion_data.json'),
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
]).then(([interestData, globalTrend, driverPerf, mediaEvents,
          slopeData, peakMonth, championData, world]) => {

  //Index data
  const interestByCC = d3.group(interestData, d => d.country_code);
  const driverByCC   = d3.group(driverPerf,   d => d.country_code);
  const years        = [...new Set(interestData.map(d => d.year))].sort();
  const ccToName     = {};
  interestData.forEach(d => { ccToName[d.country_code] = d.country; });

  //Event timeline pills
  const EVENTS = [
  { id: 'dts_2019', year: 2019, label: 'DtS Release (2019)', type: 'dts' },
  { id: 'rivalry_2021', year: 2021, label: 'Hamilton–Verstappen Title Fight (2021)', type: 'race' },
  { id: 'perez_2021', year: 2021, label: 'Pérez Joins Red Bull (2021)', type: 'race' },
  { id: 'movie_2025', year: 2025, label: 'F1 Movie Release (2025)', type: 'movie' },
  ];

  const EVENT_FOCUS = {
  dts_2019: ['US', 'IN'],
  rivalry_2021: ['GB','NL'],
  perez_2021: ['MX'],
  movie_2025: ['US','IN']
  };

  const timeline = d3.select('#event-timeline');
  timeline.selectAll('span')
    .data(EVENTS)
    .join('span')
    .attr('class', d => `event-pill ${d.type} active`)
    .attr('data-year', d => d.year)
    .attr('data-id', d => d.id)
    .text(d => d.label)
    .on('click', function(event, d) {
      const wasActive = d3.select(this).classed('active');

      d3.selectAll('.event-pill').classed('active', false);

      if (!wasActive) {
        d3.select(this).classed('active', true);

        state.selectedYear = d.year;
        d3.select('#year-slider').property('value', d.year);
        d3.select('#year-display').text(d.year);

        drawMap(d.year);
        highlightYear(d.year);

        applyEventFocus(d.id, true);

        // Select the first focused country so all charts update
        const focused = EVENT_FOCUS[d.id];
        if (focused && focused.length > 0) {
          selectCountry(focused[0]);
        }
      } else {
        applyEventFocus(d.id, false);
        clearYearHighlight();
      }
    });

  function applyEventFocus(key, isActive) {
    const countries = (isActive && EVENT_FOCUS[key]) ? EVENT_FOCUS[key] : [];

    state.activeEvent = isActive ? key : null;

    d3.selectAll('.country-path')
      .classed('event-focus', d => countries.includes(d.properties.iso));

    d3.selectAll('.bump-line')
      .classed('event-focus', d => countries.includes(d[0]));

    d3.selectAll('.bump-label')
      .classed('event-focus', function() {
        return countries.includes(d3.select(this).attr('data-cc'));
      });

    // Slope chart: dim non-focused, highlight focused countries
    if (countries.length > 0) {
      d3.selectAll('.slope-group')
        .style('opacity', function() {
          return countries.includes(d3.select(this).attr('data-cc')) ? 1 : 0.12;
        });
      // Bring focused groups to front
      d3.selectAll('.slope-group').filter(function() {
        return countries.includes(d3.select(this).attr('data-cc'));
      }).raise();
    } else {
      // Reset slope opacity when event is deactivated
      d3.selectAll('.slope-group').style('opacity', null);
      // Reset bump dimming to whatever country is selected
      if (state.selectedCountry) {
        d3.selectAll('.bump-line')
          .classed('highlighted', d => d[0] === state.selectedCountry)
          .classed('dimmed',      d => d[0] !== state.selectedCountry);
        d3.selectAll('.slope-group')
          .style('opacity', function() {
            return d3.select(this).attr('data-cc') === state.selectedCountry ? 1 : 0.15;
          });
      }
    }
  }

  //Choropleth
  const mapContainer = document.getElementById('map-container');
  const mapW = mapContainer.clientWidth - 32;
  const mapH = Math.round(mapW * 0.52);
  const mapSvg = d3.select('#map-svg').attr('width', mapW).attr('height', mapH);

  d3.select('#map-legend-grad')
    .style('background','linear-gradient(to right,#1a2a6e,#4A90A4,#F4A261)');

  const projection = d3.geoNaturalEarth1()
    .scale(mapW / 6.2)
    .translate([mapW / 2, mapH / 2]);
  const pathGen = d3.geoPath().projection(projection);

  // ISO numeric → ISO-2 for our 14 countries
  const ISO_MAP = {
    '036':'AU','076':'BR','156':'CN','276':'DE','356':'IN','380':'IT',
    '392':'JP','484':'MX','528':'NL','702':'SG','724':'ES','784':'AE',
    '826':'GB','840':'US'
  };

  const topoFeatures = topojson.feature(world, world.objects.countries).features;
  topoFeatures.forEach(f => {
    f.properties.iso = ISO_MAP[String(f.id).padStart(3,'0')] || null;
  });

  function getInterest(cc, yr) {
    const rows = interestByCC.get(cc);
    if (!rows) return 0;
    const r = rows.find(d => d.year === yr);
    return r ? r.avg_interest : 0;
  }

  function drawMap(yr) {
    // Remove old paths but keep Singapore dot layer
    mapSvg.selectAll('.country-path').remove();
    mapSvg.selectAll('.sg-dot').remove();

    mapSvg.selectAll('.country-path')
      .data(topoFeatures)
      .join('path')
      .attr('class', d =>
        'country-path' + (d.properties.iso === state.selectedCountry ? ' selected' : ''))
      .attr('d', pathGen)
      .attr('fill', d => {
        const iso = d.properties.iso;
        if (!iso || !interestByCC.has(iso)) return '#1a1a3e';
        return mapScale(getInterest(iso, yr));
      })
      .on('mousemove', (event, d) => {
        const iso = d.properties.iso;
        if (!iso || !interestByCC.has(iso)) return;
        const row = (interestByCC.get(iso) || []).find(r => r.year === yr);
        showTooltip(ccToName[iso] || iso, [
          ['Year', yr],
          ['Avg interest', getInterest(iso, yr).toFixed(1)],
          ['Peak month', row ? row.peak_month_name : '—'],
        ], event);
      })
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => {
        if (d.properties.iso && interestByCC.has(d.properties.iso))
          selectCountry(d.properties.iso);
      });

    //Singapore dot — city-state is too small for 110m TopoJSON
    const sgCoords  = projection([103.8198, 1.3521]);
    const sgInterest = getInterest('SG', yr);
    mapSvg.append('circle')
      .attr('class', 'sg-dot' + (state.selectedCountry === 'SG' ? ' selected' : ''))
      .attr('cx', sgCoords[0]).attr('cy', sgCoords[1])
      .attr('r', 5)
      .attr('fill', mapScale(sgInterest))
      .attr('stroke', state.selectedCountry === 'SG' ? '#fff' : '#334')
      .attr('stroke-width', state.selectedCountry === 'SG' ? 2 : 1)
      .attr('cursor', 'pointer')
      .on('mousemove', event => {
        const row = (interestByCC.get('SG') || []).find(r => r.year === yr);
        showTooltip('Singapore', [
          ['Year', yr],
          ['Avg interest', sgInterest.toFixed(1)],
          ['Peak month', row ? row.peak_month_name : '—'],
          ['Note', 'Too small for map polygon — shown as dot']
        ], event);
      })
      .on('mouseleave', hideTooltip)
      .on('click', () => selectCountry('SG'));

    // SG label
    mapSvg.append('text')
      .attr('x', sgCoords[0] + 7).attr('y', sgCoords[1] + 4)
      .attr('fill', '#9a9ab0').attr('font-size', 8).attr('pointer-events', 'none')
      .text('SG');
  }

  drawMap(state.selectedYear);

  d3.select('#year-slider').on('input', function() {
    state.selectedYear = +this.value;
    d3.select('#year-display').text(this.value);
    drawMap(state.selectedYear);
  });

  //Year highlight across charts
  function highlightYear(yr) {
    d3.selectAll('.year-hl').remove();
    d3.selectAll('.hl-target').each(function() {
      const el  = d3.select(this);
      const xFn = el.node().__xScale;
      if (!xFn) return;
      const x   = typeof xFn === 'function' ? xFn(yr) : null;
      if (x === null) return;
      const h   = +el.attr('data-h');
      el.append('line').attr('class','year-hl')
        .attr('x1',x).attr('x2',x).attr('y1',0).attr('y2',h)
        .attr('stroke','#F4A261').attr('stroke-width',1.5).attr('stroke-dasharray','4,2');
    });
  }
  function clearYearHighlight() { d3.selectAll('.year-hl').remove(); }

  //Country panel
  window.renderCountryPanel = function(cc) {
    const rows = (interestByCC.get(cc) || []).sort((a,b) => a.year - b.year);
    if (!rows.length) return;

    const name  = ccToName[cc];
    const peak  = rows.reduce((a,b) => a.avg_interest > b.avg_interest ? a : b);
    const first = rows.find(r => r.year === 2015);
    const growth = first ? (((peak.avg_interest - first.avg_interest) / first.avg_interest) * 100).toFixed(0) : '—';

    d3.select('#country-name').text(name);
    d3.select('#country-subtitle').text('Click another country to compare');
    d3.select('#kpi-row').style('display','grid');
    d3.select('#kpi-peak').text(peak.avg_interest.toFixed(1));
    d3.select('#kpi-year').text(peak.year);
    d3.select('#kpi-growth').text(`+${growth}%`);

    const panelW = document.getElementById('country-panel').clientWidth - 32;
    const h = 130, m = {top:10, right:10, bottom:24, left:32};
    const iw = panelW - m.left - m.right;
    const ih = h - m.top - m.bottom;

    const lineSvg = d3.select('#country-line-svg').attr('width', panelW).attr('height', h);
    lineSvg.selectAll('*').remove();
    const g = lineSvg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    g.attr('class','hl-target').attr('data-h', ih);

    const x = d3.scaleLinear().domain([2015,2025]).range([0,iw]);
    g.node().__xScale = x;
    const y = d3.scaleLinear().domain([0, d3.max(rows,d=>d.avg_interest)*1.2]).range([ih,0]);

    // DtS band
    g.append('rect').attr('x',x(2019)).attr('y',0)
      .attr('width',x(2025)-x(2019)).attr('height',ih)
      .attr('fill','rgba(4,138,129,0.08)');

    g.append('g').attr('class','grid')
      .call(d3.axisLeft(y).ticks(4).tickSize(-iw).tickFormat(''));

    // Event reference lines
    EVENTS.forEach(ev => {
      if (ev.year >= 2015 && ev.year <= 2025) {
        g.append('line').attr('class','ref-line')
          .attr('x1',x(ev.year)).attr('x2',x(ev.year)).attr('y1',0).attr('y2',ih);
      }
    });

    const area = d3.area().x(d=>x(d.year)).y0(ih).y1(d=>y(d.avg_interest)).curve(d3.curveMonotoneX);
    const line = d3.line().x(d=>x(d.year)).y(d=>y(d.avg_interest)).curve(d3.curveMonotoneX);
    g.append('path').datum(rows).attr('fill','rgba(4,138,129,0.12)').attr('d',area);
    g.append('path').datum(rows).attr('class','line-path').attr('d',line);

    g.selectAll('circle').data(rows).join('circle')
      .attr('cx',d=>x(d.year)).attr('cy',d=>y(d.avg_interest)).attr('r',3)
      .attr('fill','#048A81')
      .on('mousemove',(ev,d) => showTooltip(name,[
        ['Year',d.year],['Interest',d.avg_interest.toFixed(1)],['Peak month',d.peak_month_name]
      ],ev))
      .on('mouseleave', hideTooltip);

    g.append('g').attr('class','axis').attr('transform',`translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')));
    g.append('g').attr('class','axis')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0f')));

    // Driver mini chart
    const drRows = (driverByCC.get(cc)||[])
      .filter(d => d.top_driver_position !== null)
      .sort((a,b) => a.year - b.year);

    if (drRows.length) {
      d3.select('#driver-info').style('display','block');
      const dh=60, dm={top:4,right:10,bottom:18,left:32};
      const diw=panelW-dm.left-dm.right, dih=dh-dm.top-dm.bottom;
      const ds = d3.select('#driver-bar-svg').attr('width',panelW).attr('height',dh);
      ds.selectAll('*').remove();
      const dg = ds.append('g').attr('transform',`translate(${dm.left},${dm.top})`);
      const dx = d3.scaleLinear().domain([2015,2025]).range([0,diw]);
      const dy = d3.scaleLinear().domain([1,20]).range([0,dih]);
      const lp = d3.line().x(d=>dx(d.year)).y(d=>dy(d.top_driver_position))
        .defined(d=>d.top_driver_position!==null).curve(d3.curveMonotoneX);
      dg.append('path').datum(drRows)
        .attr('fill','none').attr('stroke','#F4A261').attr('stroke-width',1.5).attr('d',lp);
      dg.selectAll('circle').data(drRows).join('circle')
        .attr('cx',d=>dx(d.year)).attr('cy',d=>dy(d.top_driver_position)).attr('r',2.5)
        .attr('fill','#F4A261')
        .on('mousemove',(ev,d) => showTooltip(d.top_driver,[
          ['Year',d.year],['Position',`P${d.top_driver_position}`],['Wins',d.top_driver_wins??0]
        ],ev))
        .on('mouseleave', hideTooltip);
      dg.append('g').attr('class','axis').attr('transform',`translate(0,${dih})`)
        .call(d3.axisBottom(dx).ticks(5).tickFormat(d3.format('d')));
      dg.append('g').attr('class','axis')
        .call(d3.axisLeft(dy).ticks(3).tickFormat(d=>`P${d}`));
    } else {
      d3.select('#driver-info').style('display','none');
    }
  };

  //Bump chart
  const bumpContainer = document.querySelector('#bump-svg').parentElement;
  const bumpW = bumpContainer ? bumpContainer.clientWidth - 32 : 800;
  const bumpH = 340;
  const bm = {top:20, right:90, bottom:20, left:90};
  const biw = bumpW - bm.left - bm.right;
  const bih = bumpH - bm.top  - bm.bottom;
  const baseW = bumpW;

  const bumpSvg = d3.select('#bump-svg').attr('width',bumpW).attr('height',bumpH);
  const bumpG   = bumpSvg.append('g').attr('transform',`translate(${bm.left},${bm.top})`);
  bumpG.attr('class','hl-target').attr('data-h',bih);

  const bx = d3.scalePoint().domain(years).range([0,biw]).padding(0.25);
  bumpG.node().__xScale = yr => bx(yr);
  const by = d3.scaleLinear().domain([1,14]).range([0,bih]);

  const countryGroups = d3.groups(interestData, d => d.country_code);
  const bumpLine = d3.line()
    .x(d => bx(d.year)).y(d => by(d.rank)).curve(d3.curveCatmullRom.alpha(0.5));

  bumpG.selectAll('.bump-line')
    .data(countryGroups)
    .join('path')
    .attr('class','bump-line')
    .attr('d', d => bumpLine(d[1].sort((a,b) => a.year - b.year)))
    .attr('stroke', d => TRAD.has(d[0]) ? TRAD_COLOR : NONTRAD_COLOR)
    .on('mousemove', (event,d) => {
      const last = d[1].find(r => r.year === 2025);
      showTooltip(ccToName[d[0]], [
        ['2025 rank', last ? `#${last.rank}` : '—'],
        ['Market', TRAD.has(d[0]) ? 'Traditional' : 'Non-Traditional'],
      ], event);
    })
    .on('mouseleave', hideTooltip)
    .on('click', (event,d) => selectCountry(d[0]));

  // Use rank-based y with a minimum gap between adjacent labels
  function staggeredLabels(rects, minGap, svgH) {
    // Sort by y, then push labels apart
    rects = rects.slice().sort((a,b) => a.y - b.y);
    for (let i = 1; i < rects.length; i++) {
      if (rects[i].y - rects[i-1].y < minGap) {
        rects[i].y = rects[i-1].y + minGap;
      }
    }
    return rects;
  }

  // Build label data for start (2015) and end (2025)
  ['start','end'].forEach(pos => {
    const isStart = pos === 'start';
    const yr      = isStart ? 2015 : 2025;
    const xPos    = isStart ? -5 : biw +5;
    const anchor  = isStart ? 'end' : 'start';

    let labels = countryGroups.map(([cc, rows]) => {
      const row = rows.find(r => r.year === yr);
      return { cc, rank: row ? row.rank : 14, y: by(row ? row.rank : 14) };
    });

    labels = staggeredLabels(labels, 14, bih);

    labels.forEach(({ cc, y }) => {
      const col = TRAD.has(cc) ? TRAD_COLOR : NONTRAD_COLOR;
      bumpG.append('text')
        .attr('class','bump-label')
        .attr('data-cc', cc)
        .attr('x', xPos).attr('y', y + 4)
        .attr('text-anchor', anchor)
        .attr('fill', col)
        .attr('font-size', 9)
        .text(cc)
        .on('click', () => selectCountry(cc));
    });
  });

  bumpG.append('g').attr('class','axis').call(d3.axisTop(bx).tickFormat(d3.format('d')));

  // Legend
  [{color:NONTRAD_COLOR,label:'Non-traditional'},{color:TRAD_COLOR,label:'Traditional'}]
    .forEach((l,i) => {
      bumpSvg.append('rect').attr('x',bm.left+i*130).attr('y',bumpH-8).attr('width',8).attr('height',8).attr('fill',l.color).attr('rx',2);
      bumpSvg.append('text').attr('x',bm.left+i*130+11).attr('y',bumpH-1).attr('fill','#9a9ab0').attr('font-size',9).text(l.label);
    });

  //Scatter (Q2 / Chapter 2)
  const scW = Math.max(Math.floor(baseW / 2), 180);
  const scH = 250;
  const sm  = {top:14, right:20, bottom:40, left:44};
  const siw = scW - sm.left - sm.right;
  const sih = scH - sm.top  - sm.bottom;

  const scData  = driverPerf.filter(d => d.top_driver_position !== null);
  const scSvg   = d3.select('#scatter-svg').attr('width',scW).attr('height',scH);
  const scG     = scSvg.append('g').attr('transform',`translate(${sm.left},${sm.top})`);

  const sx = d3.scaleLinear().domain([0, d3.max(scData,d=>d.top_driver_position)+1]).range([0,siw]);
  const sy = d3.scaleLinear().domain([0, d3.max(scData,d=>d.avg_interest)*1.1]).range([sih,0]);

  scG.append('g').attr('class','grid').call(d3.axisLeft(sy).ticks(5).tickSize(-siw).tickFormat(''));
  scG.append('g').attr('class','grid').attr('transform',`translate(0,${sih})`).call(d3.axisBottom(sx).ticks(5).tickSize(-sih).tickFormat(''));

  // OLS
  const n=scData.length, sX=d3.sum(scData,d=>d.top_driver_position),
    sY=d3.sum(scData,d=>d.avg_interest), sXY=d3.sum(scData,d=>d.top_driver_position*d.avg_interest),
    sXX=d3.sum(scData,d=>d.top_driver_position**2);
  const slope_m=(n*sXY-sX*sY)/(n*sXX-sX**2), int_b=(sY-slope_m*sX)/n;
  const xExt=d3.extent(scData,d=>d.top_driver_position);
  scG.append('line').attr('class','trend-line')
    .attr('x1',sx(xExt[0])).attr('x2',sx(xExt[1]))
    .attr('y1',sy(slope_m*xExt[0]+int_b)).attr('y2',sy(slope_m*xExt[1]+int_b));

  const ccColors = d3.scaleOrdinal(d3.schemeTableau10).domain([...new Set(scData.map(d=>d.country_code))]);
  scG.selectAll('.scatter-dot').data(scData).join('circle')
    .attr('class','scatter-dot')
    .attr('cx',d=>sx(d.top_driver_position)).attr('cy',d=>sy(d.avg_interest))
    .attr('r',5).attr('fill',d=>ccColors(d.country_code))
    .on('mousemove',(ev,d)=>showTooltip(`${d.country} ${d.year}`,[
      ['Driver',d.top_driver],['Position',`P${d.top_driver_position}`],['Interest',d.avg_interest.toFixed(1)]
    ],ev))
    .on('mouseleave',hideTooltip);

  scG.append('g').attr('class','axis').attr('transform',`translate(0,${sih})`).call(d3.axisBottom(sx).ticks(6));
  scG.append('g').attr('class','axis').call(d3.axisLeft(sy).ticks(5));
  scG.append('text').attr('x',siw/2).attr('y',sih+34).attr('fill','#9a9ab0').attr('font-size',10).attr('text-anchor','middle').text('Driver championship position');
  scG.append('text').attr('transform','rotate(-90)').attr('x',-sih/2).attr('y',-34).attr('fill','#9a9ab0').attr('font-size',10).attr('text-anchor','middle').text('Avg search interest');

  //Small multiples
  const FOCUS = ['MX','NL','GB','ES'];
  const smSvgW = 350, smSvgH=320;
  const smMarg={top:28,right:28,bottom:10,left:28};
  const cW=(smSvgW-smMarg.left-smMarg.right)-20;
  const cH=(smSvgH-smMarg.top-smMarg.bottom)/2-20;

  const smSvg = d3.select('#small-multiples-svg').attr('width',smSvgW).attr('height',smSvgH);

  FOCUS.forEach((cc,i) => {
    const col=i%2, row=Math.floor(i/2);
    const ox=smMarg.left+col*(cW+35), oy=smMarg.top+row*(cH+35);
    const g=smSvg.append('g').attr('transform',`translate(${ox},${oy})`);

    const intRows=(interestByCC.get(cc)||[]).sort((a,b)=>a.year-b.year);
    const drRows=(driverByCC.get(cc)||[]).filter(d=>d.top_driver_position!==null).sort((a,b)=>a.year-b.year);

    const x2=d3.scaleLinear().domain([2015,2025]).range([0,cW]);
    const yI=d3.scaleLinear().domain([0,d3.max(intRows,d=>d.avg_interest)*1.2]).range([cH,0]);
    const yP=d3.scaleLinear().domain([1,20]).range([0,cH]);

    g.append('rect').attr('width',cW).attr('height',cH).attr('fill','#080e1c').attr('rx',4);
    g.append('text').attr('x',4).attr('y',-5).attr('fill','#e8e8e8').attr('font-size',9).attr('font-weight',600)
      .text(`${ccToName[cc]} (${cc})`);

    g.append('line').attr('x1',x2(2019)).attr('x2',x2(2019)).attr('y1',0).attr('y2',cH)
      .attr('stroke','rgba(4,138,129,0.45)').attr('stroke-width',1).attr('stroke-dasharray','3,2');

    g.append('path').datum(intRows)
      .attr('fill','none').attr('stroke','#378add').attr('stroke-width',1.5)
      .attr('d',d3.line().x(d=>x2(d.year)).y(d=>yI(d.avg_interest)).curve(d3.curveMonotoneX));

    if (drRows.length) {
      g.append('path').datum(drRows)
        .attr('fill','none').attr('stroke','#F4A261').attr('stroke-width',1.5)
        .attr('d',d3.line().x(d=>x2(d.year)).y(d=>yP(d.top_driver_position))
          .defined(d=>d.top_driver_position!==null).curve(d3.curveMonotoneX));
    }

    g.append('g').attr('class','axis').attr('transform',`translate(0,${cH})`)
      .call(d3.axisBottom(x2).ticks(3).tickFormat(d=>`'${String(d).slice(2)}`));
    g.append('g').attr('class','axis').call(d3.axisLeft(yI).ticks(3).tickFormat(d3.format('.0f')));
  });

  //Slope chart
  const slW=400, slH=290;
  const slm={top:20,right:100,bottom:14,left:50};
  const sliw=(slW-slm.left-slm.right)*2, slih=slH-slm.top-slm.bottom;

  const slSvg=d3.select('#slope-svg').attr('width',slW).attr('height',slH);
  const slG=slSvg.append('g').attr('transform',`translate(${slm.left},${slm.top})`);

  const slY=d3.scaleLinear()
    .domain([0,d3.max(slopeData,d=>Math.max(d.avg_interest_pre,d.avg_interest_post))*1.1])
    .range([slih,0]);

  const slopeDataSorted = slopeData.slice().sort((a,b)=>b.avg_interest_post-a.avg_interest_post);

  // Group elements per country so we can highlight them together
  const slGroups = slG.selectAll('.slope-group')
    .data(slopeDataSorted)
    .join('g')
    .attr('class', 'slope-group')
    .attr('data-cc', d => d.country_code);

  slGroups.each(function(d) {
    const g = d3.select(this);
    const col = d.change > 0 ? '#1f77b4' : '#ff7f0e';

    const handler = ev => showTooltip(d.country,[
      ['Pre-DtS (15–18)', d.avg_interest_pre.toFixed(1)],
      ['DtS era (19–25)', d.avg_interest_post.toFixed(1)],
      ['Change', `${d.change>0?'+':''}${d.change.toFixed(1)}`]
    ],ev);

    g.append('line').attr('class','slope-line')
      .attr('x1',0).attr('x2',sliw)
      .attr('y1',slY(d.avg_interest_pre)).attr('y2',slY(d.avg_interest_post))
      .attr('stroke',col).attr('stroke-width',Math.abs(d.change)>15?2.5:1.5);

    g.append('circle').attr('class','slope-dot').attr('cx',0).attr('cy',slY(d.avg_interest_pre)).attr('r',4).attr('fill',col)
      .on('mousemove',handler).on('mouseleave',hideTooltip);
    g.append('circle').attr('class','slope-dot').attr('cx',sliw).attr('cy',slY(d.avg_interest_post)).attr('r',4).attr('fill',col)
      .on('mousemove',handler).on('mouseleave',hideTooltip);

    g.append('text').attr('class','slope-label slope-label-left').attr('x',-5).attr('y',slY(d.avg_interest_pre)+3)
      .attr('text-anchor','end').attr('fill',col).attr('font-size',9).text(d.country_code);
    g.append('text').attr('class','slope-label slope-label-right').attr('x',sliw+5).attr('y',slY(d.avg_interest_post)+3)
      .attr('text-anchor','start').attr('fill',col).attr('font-size',9)
      .text(`${d.country_code} ${d.change>0?'+':''}${d.change.toFixed(0)}`);
  });

  slG.append('text').attr('x',0).attr('y',-8).attr('text-anchor','middle').attr('fill','#9a9ab0').attr('font-size',10).text('2015–2018');
  slG.append('text').attr('x',sliw).attr('y',-8).attr('text-anchor','middle').attr('fill','#9a9ab0').attr('font-size',10).text('2019–2025');
  slG.append('line').attr('x1',0).attr('x2',0).attr('y1',0).attr('y2',slih).attr('stroke','#2a2a4a');
  slG.append('line').attr('x1',sliw).attr('x2',sliw).attr('y1',0).attr('y2',slih).attr('stroke','#2a2a4a');

  //Peak month heatmap
  const hmW=scW, hmH=310;
  const hmm={top:20,right:14,bottom:44,left:88};
  const hmiw=hmW-hmm.left-hmm.right, hmih=hmH-hmm.top-hmm.bottom;

  const hmSvg=d3.select('#heatmap-svg').attr('width',hmW).attr('height',hmH);
  const hmG=hmSvg.append('g').attr('transform',`translate(${hmm.left},${hmm.top})`);

  const hmCountries=[...new Set(peakMonth.map(d=>d.country))].sort();
  const hmX=d3.scaleBand().domain(years).range([0,hmiw]).padding(0.06);
  const hmY=d3.scaleBand().domain(hmCountries).range([0,hmih]).padding(0.06);

  hmG.selectAll('.heatmap-cell').data(peakMonth).join('rect')
    .attr('class','heatmap-cell')
    .attr('x',d=>hmX(d.year)).attr('y',d=>hmY(d.country))
    .attr('width',hmX.bandwidth()).attr('height',hmY.bandwidth())
    .attr('fill',d=>peakMonthColor(d.peak_month)).attr('rx',2)
    .on('mousemove',(ev,d)=>showTooltip(`${d.country} ${d.year}`,[
      ['Peak month',d.peak_month_name],['Month #',d.peak_month]
    ],ev))
    .on('mouseleave',hideTooltip);

  hmG.append('g').attr('class','axis').attr('transform',`translate(0,${hmih})`)
    .call(d3.axisBottom(hmX).tickFormat(d3.format('d')).tickSize(0))
    .select('.domain').remove();
  hmG.append('g').attr('class','axis').call(d3.axisLeft(hmY).tickSize(0))
    .select('.domain').remove();

  hmG.append('line').attr('x1',hmX(2019)).attr('x2',hmX(2019)).attr('y1',0).attr('y2',hmih)
    .attr('stroke','rgba(4,138,129,0.6)').attr('stroke-width',1.5).attr('stroke-dasharray','4,2');
  hmG.append('text').attr('x',hmX(2019)+2).attr('y',-6).attr('fill','#048A81').attr('font-size',8).text('DtS begins →');

  [{color:'#009E73',label:'Feb (DTS)'},{color:'#378add',label:'Mar (opener)'},{color:'#F4A261',label:'Oct–Nov (climax)'},
    {color:'#D55E00',label:'Dec (Final Race)'},{color:'#3a3a5a',label:'Other'}]
    .forEach((l,i) => {
      hmSvg.append('rect').attr('x',hmm.left+i*105).attr('y',hmH-14).attr('width',8).attr('height',8).attr('fill',l.color).attr('rx',2);
      hmSvg.append('text').attr('x',hmm.left+i*105+11).attr('y',hmH-5).attr('fill','#9a9ab0').attr('font-size',9).text(l.label);
    });

  //Default
  selectCountry('GB');

}).catch(err => {
  console.error('DVP data error:', err);
  document.getElementById('app').innerHTML +=
    `<div style="color:#E05C5C;padding:20px;background:#1a0a0a;border-radius:8px;margin-top:20px">
      <strong>Error loading data:</strong> ${err.message}<br>
      <em>Ensure you are running from a local server (<code>python3 -m http.server 8000</code>) and all JSON files are in ./data/</em>
    </div>`;
});
