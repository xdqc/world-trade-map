const { chart } = require('@rawgraphs/rawgraphs-core')
const { treemap } = require('@rawgraphs/rawgraphs-charts')
const { JSDOM } = require("jsdom");
const fs = require('fs')
const fetch = require('node-fetch');



function drawTreemap(countryName, countryISO2, oecCode, im, titleOffset, data, width, height) {
  // 1. defining data
  const _id = `${countryISO2}_nt${im>0?'im':'ex'}`;
  const _titleSize = Math.ceil(Math.max(10, width/100));
  const _value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(width*height/1000)+' B'

  // 2. defining mapping
  const mapping = {
    hierarchy: { value: ["Section ID", "HS2 ID", "HS4 ID"] },
    size: { value: "Trade Value" },
    color: { value: "Section" },
    label: { value: ["HS4", "Trade Value"] }
  };
  /**
   * // Fix bug - aggregation iterater over string  'c', 's', 'v' ... , add following line to \node_modules\@rawgraphs\rawgraphs-core\lib\index.cjs.js:4098 
   *  aggregatorExpression = 'csvDistinct';
   */

  // 3. define visualOptions
  const visualOptions = {
    width: width,
    height: height,
    padding: 1,
    legend: true,
  };

  // 4. creating a chart instance
  const viz = new chart(treemap, { data, mapping, visualOptions });

  // 5. rendering to the DOM
  const svg = viz.renderToString(new JSDOM(``).window.document)
    .replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace('<g transform="translate(10,10)" id="viz"><g id="leaves">',`
    <g transform="translate(10,${titleOffset})" id="${_id}_2020"><text dominant-baseline="text-before-edge" class="txt"><tspan x="20" y="0.2em" style="font-family: Arial, sans-serif; font-size: ${_titleSize}px; fill: black; font-weight: bold;">${countryName} net ${im>0?'import':'export'} ${_value}</tspan></text><g id="${_id}_2020_leaves" transform="translate(0, ${Math.ceil(10+(_titleSize-12)*1.4)})">`)
    .replace(/("(?:url\()?#?)((?:path|clip)\d+\)?")/g, `$1${_id}_$2`)
    .replace(/<\/svg>$/, '\n</svg>');
    // fs.writeFileSync(`./svg/${oecCode.slice(0,2)}_${oecCode.slice(2)}_${im>0?'im':'ex'}ports_${width*height}.svg`, svg);
  return svg;
}


async function getNetportData(im, oecCodes) {
  const template = JSON.parse(fs.readFileSync('./template.json').toString());
  for (const oecCode of oecCodes) {
    const url = (port) => `https://oec.world/olap-proxy/data?cube=trade_i_baci_a_92&${port}er+Country=${oecCode}&drilldowns=HS4&measures=Trade+Value&parents=true&Year=2020&sparse=false&locale=en`;
    const importData = (await (await fetch(url('Import'))).json()).data;
    const exportData = (await (await fetch(url('Export'))).json()).data;
    if (!importData || !exportData || !Array.isArray(importData) || !Array.isArray(importData)) continue;
    
    template.forEach(t => {
      const hs4id = t['HS4 ID']
      const importValue = importData.find(i => i['HS4 ID'] == hs4id)?.['Trade Value'] || 0;
      const exportValue = exportData.find(i => i['HS4 ID'] == hs4id)?.['Trade Value'] || 0;
      const value = im * (importValue-exportValue)/1000000; // in million
      t['Trade Value'] += value;        
    })
  }
  const netportData = [];
  let netPort = 0;
  let sectionId = 0;
  template.forEach(t => {
    netPort += Math.max(0,t['Trade Value'])
    t['Trade Value'] = Math.round(Math.max(0,t['Trade Value']))
    // skip 0 values, but keep all sections
    if (t['Section ID'] > sectionId) {
      sectionId = t['Section ID'];
      netportData.push(t);
    } else if (t['Trade Value'] >= 100) {
      netportData.push(t);
    }
  })
  const width = Math.round(Math.sqrt(netPort*2));
  const height = Math.round(Math.sqrt(netPort/2));
  fs.writeFileSync('./netports.json', JSON.stringify(netportData))
  if (width == 0) return null;
  return [netportData, width, height]
}

// getNetportData(1, [ 'aszhn', 'China', 'zh', 'zh' ]).then(d => drawTreemap(...d))
async function makeMap(mapWidth, mapHeight) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
  <rect width="${mapWidth}" height="${mapHeight}" x="0" y="0" fill="#FFFFFF" id="backgorund"/>\n`;
  for(const country of fs.readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    const oecCode = country[0];
    const iso2 = country[1];
    const latitude = country[2];
    const longitude = country[3];
    const countryName = country[4];
    console.log(oecCode, countryName);
    try {      
      netImport = await getNetportData( 1, [oecCode])
      netExport = await getNetportData(-1, [oecCode])
    } catch (error) {
      continue;
    }
    const importWidth = netImport[1];
    const importHeight = netImport[2];
    const exportWidth = netExport[1];
    const exportHeight = netExport[2];
    if (!netImport || !netExport) continue;
    if (importWidth<50 || exportWidth<50) continue;

    const exportOffset = importHeight + Math.ceil(Math.max(10, (importWidth+exportWidth)/100-10)); // import height + export fontsize
    const importSvgG = drawTreemap(countryName, iso2, oecCode,  1, 10, ...netImport).split('\n')[1];
    const exportSvgG = drawTreemap(countryName, iso2, oecCode, -1, exportOffset, ...netExport).split('\n')[1];

    // Coordinate to mecator x,y
    // get x value
    let x = Math.round( (longitude+180)*(mapWidth/360)+mapWidth/2 - (importWidth+exportWidth)/3);
    // convert from degrees to radians
    const latRad = latitude*Math.PI/180;
    // get y value
    const mercN = Math.log(Math.tan((Math.PI/4)+(latRad/2)));
    let y     = Math.round( (mapHeight/2)-(mapWidth*(mapHeight/mapWidth*2)*mercN/(2*Math.PI)) - (importHeight+exportHeight)/3);

    console.log(oecCode, x, y);
    svg += `  <g transform="translate(${x},${y})" id="${iso2}_2020">\n`
    svg += importSvgG + `\n`
    svg += exportSvgG + `\n`
    svg +=`  </g>\n`
  }
  svg +=`</svg>\n`
  fs.writeFileSync(`./worldtrademap.svg`, svg)
}

async function makeGroupMap(groupName) {
  const oecCodes = [];
  const iso2s = [];
  const countryNames = [];
  for(const country of fs.readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    oecCodes.push(country[0]); iso2s.push(country[1]); countryNames.push(country[4]);
  }
  netImport = await getNetportData( 1, oecCodes);
  netExport = await getNetportData(-1, oecCodes);
  const importWidth = netImport[1];
  const importHeight = netImport[2];
  const exportWidth = netExport[1];
  const exportHeight = netExport[2];
  const importOffset = Math.ceil(importHeight/150);
  const exportOffset = importHeight + Math.ceil(Math.max(10, (importWidth+exportWidth)/150-10)); // import height + export fontsize
  
  const importSvgG = drawTreemap(groupName, groupName.replace(/\W/g,''), 'oecCode',  1, importOffset, ...netImport).split('\n')[1];
  const exportSvgG = drawTreemap(groupName, groupName.replace(/\W/g,''), 'oecCode', -1, exportOffset, ...netExport).split('\n')[1];
  const mapWidth = Math.max(importWidth,exportWidth) + 20;
  const mapHeight = importOffset*4 + exportHeight + exportOffset + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
  <rect width="${mapWidth}" height="${mapHeight}" x="0" y="0" fill="#FFFFFF" id="backgorund"/>
  <g transform="translate(0,0)" id="${groupName.replace(/\W/g,'')}_2020">
  ${importSvgG}
  ${exportSvgG}
  </g>\n</svg>`
  fs.writeFileSync(`./group/${groupName}_trademap.svg`, svg)
}

// makeMap(150000,60000)
makeGroupMap(process.argv.slice(2).join(' '))
