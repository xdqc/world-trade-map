const { chart } = require('@rawgraphs/rawgraphs-core')
const { treemap } = require('@rawgraphs/rawgraphs-charts')
const { JSDOM } = require("jsdom");
const fs = require('fs')
const fetch = require('node-fetch');

// Global config
const HSx = 'HS4';
const template = JSON.parse(fs.readFileSync(`./template_${HSx}.json`).toString());

function drawTreemap(countryName, countryISO2, oecCode, HSx, im, titleOffset, data, netPort) {
  // 1. defining data
  const [width, height] = getWidthHeight(netPort);
  const _id = `${countryISO2.replace(/\W/g,'_')}_nt${im>0?'im':'ex'}`;
  const _titleSize = Math.ceil(Math.max(11, width/100));
  const _value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netPort/1000)+' M'

  // 2. defining mapping
  const mapping = {
    hierarchy: { value: ["Section ID", "HS2 ID", `${HSx} ID`] },
    size: { value: "Trade Value" },
    color: { value: "Section" },
    label: { value: [HSx, "Trade Value"] }
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
    // add top-labels, offsets and newline after <svg>
    .replace('<g transform="translate(10,10)" id="viz"><g id="leaves">',`
    <g transform="translate(10,${titleOffset})" id="${_id}_2020"><text dominant-baseline="text-before-edge" class="txt"><tspan x="20" y="0.2em" style="font-family: Arial, sans-serif; font-size: ${_titleSize}px; fill: black; font-weight: bold;">${countryName} net ${im>0?'import':'export'} ${_value}</tspan></text><g id="${_id}_2020_leaves" transform="translate(0, ${Math.ceil(15+(_titleSize-11)*1.5)})">`)
    // add global id
    .replace(/("(?:url\()?#?)((?:path|clip)\d+\)?")/g, `$1${_id}_$2`)
    // remove extra style
    .replace(/ style="font-family: Arial, sans-serif; font-size: 10px; fill: black; font-weight: bold;"/g, '')
    // add <title> (tooltip on supported browsers)
    .replace(/<tspan x="3" y="0\.2em">([^<>]+)<\/tspan><tspan x="3" y="1\.3em">(\d+)<\/tspan><\/text>/g, `<tspan x="3" y="0.2em">$1</tspan><tspan x="3" y="1.3em">$2</tspan></text><title>$1&#10;$2</title>`)
    // remove <rect> with <=2 width|height
    .replace(/<g transform[^<]+<[^<]+(width|height)="[012]"[^&]+&#10;\d+<\/title><\/g>/g, '')
    // remove <text> on small width|height < 30px
    .replace(/(<g transform[^<]+<[^<]+(?:width)="[12345]?\d"[^\/]+\/[^\/]+)(<clipPath [^#]+#[^#]+#[^#]+<\/text>)/g, '$1')
    .replace(/(<g transform[^<]+<[^<]+(?:height)="[12]?\d"[^\/]+\/[^\/]+)(<clipPath [^#]+#[^#]+#[^#]+<\/text>)/g, '$1')
    // remove verbose HS6 labels
    .replace(/____[^<]+<\/tspan>/g, '</tspan>')
    .replace(/____/g, '&#10;')
    .replace(/<\/svg>$/, '\n</svg>');
    // fs.writeFileSync(`./svg/${oecCode.slice(0,2)}_${oecCode.slice(2)}_${im>0?'im':'ex'}ports_${width*height}.svg`, svg);
  return svg;
}


async function getNetportData(HSx, oecCodes) {
  const netImportData = JSON.parse(JSON.stringify(template));
  const netExportData = JSON.parse(JSON.stringify(template));
  for (const oecCode of oecCodes) {
    const url = (port) => `https://oec.world/olap-proxy/data?cube=trade_i_baci_a_92&${port}er+Country=${oecCode}&drilldowns=${HSx}&measures=Trade+Value&parents=true&Year=2020&sparse=false&locale=en`;
    const importData = (await (await fetch(url('Import'))).json()).data;
    const exportData = (await (await fetch(url('Export'))).json()).data;
    if (!importData || !exportData || !Array.isArray(importData) || !Array.isArray(exportData) || importData.length == 0 || exportData.length == 0) continue;
    console.log(oecCode, importData.length, exportData.length)
    for (let index = 0; index < netImportData.length; index++) {
      const hsxid = template[index][`${HSx} ID`];
      const importValue = importData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      const exportValue = exportData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      const value = (importValue-exportValue)/100000; // cent -> thousand$
      if (value > 0) {
        netImportData[index]['Trade Value'] += value;
      } else if (value < 0) {
        netExportData[index]['Trade Value'] -= value;
      }
    }
  }
  let [netImportDataClean, netImport] = cleanPortData(netImportData);
  let [netExportDataClean, netExport] = cleanPortData(netExportData);

  // fs.writeFileSync('./netports.json', JSON.stringify(netportData))
  console.log((oecCodes).join(' '), 'netImport:', netImport, 'netExport', netExport)
  if (netImport == 0 || netExport == 0) return null;
  return {
    netImportData: netImportDataClean,
    netExportData: netExportDataClean,
    netImport: netImport,
    netExport: netExport,
  }

  function cleanPortData(portData) {
    const threshold = 2000; // 20 million $
    const netportData = [];
    let netPort = 0;
    let sectionId = 0;
    portData.forEach((t) => {
      netPort += Math.max(0, t['Trade Value']);
      t['Trade Value'] = Math.round(Math.max(0, t['Trade Value']));
      // keep all sections to utilize full color palette
      if (t['Section ID'] > sectionId) {
        sectionId = t['Section ID'];
        netportData.push(t);
      } else if (t['Trade Value'] >= threshold) {
        if (netportData[netportData.length-1]['Trade Value'] < threshold){
          netportData.pop();
        }
        netportData.push(t);
      }
    });
    return [netportData,netPort];
  }
}

async function makeMap(HSx, oecCodes, countryName, countryISO2, xOffset, yOffset) {
  const npd = await getNetportData(HSx,oecCodes);
  if (!npd) return null;
  const [importWidth, importHeight] = getWidthHeight(npd.netImport);
  const [exportWidth, exportHeight] = getWidthHeight(npd.netExport);
  const importOffset = Math.ceil(importHeight / 150);
  const exportOffset = importHeight + Math.ceil(Math.max(10, (importWidth) / 50 - 10)); // import height + export fontsize

  const importSvgG = drawTreemap(countryName, countryISO2.replace(/\W/g, ''), 'oecCode', HSx,  1, importOffset, npd.netImportData, npd.netImport).split('\n')[1];
  const exportSvgG = drawTreemap(countryName, countryISO2.replace(/\W/g, ''), 'oecCode', HSx, -1, exportOffset, npd.netExportData, npd.netExport).split('\n')[1];
  const mapWidth = Math.max(importWidth, exportWidth) + 20;
  const mapHeight = importOffset * 4 + exportHeight + exportOffset + 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
  <rect width="${mapWidth}" height="${mapHeight}" x="0" y="0" fill="#FFFFFF" id="backgorund"/>
  <g transform="translate(${xOffset},${yOffset})" id="${countryISO2.replace(/\W/g, '')}_2020">
  ${importSvgG}
  ${exportSvgG}
  </g>\n</svg>`;
  return svg;
}

async function makeMapGroup(HSx,mapWidth, mapHeight) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
  <rect width="${mapWidth}" height="${mapHeight}" x="0" y="0" fill="#FFFFFF" id="backgorund"/>\n`;
  for(const country of fs.readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    const oecCode = country[0];
    const iso2 = country[1];
    const latitude = country[2];
    const longitude = country[3];
    const countryName = country[4];
    const xOffset = country[5] || 0;
    const yOffset = country[6] || 0;
    console.log(oecCode, countryName);
    let singleSvg = await makeMap(HSx, [oecCode], countryName, iso2, xOffset, yOffset);
    if (!singleSvg) continue;
    svg += singleSvg.split('\n').slice(2,-1).join('\n')+'\n';
  }
  svg +=`</svg>\n`
  fs.writeFileSync(`./worldtrademap_.svg`, svg)
}

async function makeGroupMap(HSx, groupName) {
  const oecCodes = [];
  const iso2s = [];
  const countryNames = [];
  for(const country of fs.readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    oecCodes.push(country[0]);
    iso2s.push(country[1]);
    countryNames.push(country[4]);
  }
  let svg = await makeMap(HSx, oecCodes, groupName, groupName, 0, 0);
  fs.writeFileSync(`./group/${groupName}_trademap.svg`, svg)
}


function getWidthHeight(area) {
  const scale = 0.1;
  const ratio = 2; //16/9; //1.618;
  // area in 1k US$; draw 1px = 10k US$
  width  = Math.ceil(Math.sqrt(area*scale*ratio));
  height = Math.ceil(Math.sqrt(area*scale/ratio));
  return [width, height]
}

// makeMap(150000,60000)
// makeGroupMap('HS4', process.argv.slice(2).join(' '))
makeMapGroup(HSx, 60000, 20000)