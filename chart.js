import { chart } from '@rawgraphs/rawgraphs-core';
import { treemap }  from '@rawgraphs/rawgraphs-charts';
import { JSDOM } from "jsdom";
import fs from 'fs';
import fetch from 'node-fetch';

// Global config
const HSx = 'HS4';
const YEAR = 2021;
const template = JSON.parse(fs.readFileSync(`./template_${HSx}.json`).toString());

function drawTreemap(countryName, countryISO2, oecCode, HSx, im, titleOffset, data, netPort) {
  // 1. defining data
  const [width, height] = getWidthHeight(netPort);
  const _id = `${countryISO2.replace(/\W/g,'_')}_nt${im>0?'im':'ex'}`;
  const _titleSize = Math.ceil(Math.max(11, width/100));
  const _value = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netPort/1000)+' M'; //netPort value in 1k USD

  // 2. defining mapping
  const mapping = {
    hierarchy: { value: ["Section ID", "HS2 ID", `${HSx} ID`] },
    size: { value: "Trade Value" },
    color: { value: "Section" },
    label: { value: [HSx, "Trade Value"] }
  };

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
    <g transform="translate(10,${titleOffset})" id="${_id}_${YEAR}"><text dominant-baseline="text-before-edge" class="txt"><tspan x="20" y="0.2em" style="font-family: Arial, sans-serif; font-size: ${_titleSize}px; fill: black; font-weight: bold;">${countryName} net ${im>0?'import':'export'} ${_value}</tspan></text><g id="${_id}_${YEAR}_leaves" transform="translate(0, ${Math.ceil(15+(_titleSize-11)*1.5)})">`)
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
    const url = (port) => `https://oec.world/olap-proxy/data?cube=trade_i_baci_a_92&${port}er+Country=${oecCode}&drilldowns=${HSx}&measures=Trade+Value&parents=true&Year=${YEAR}&sparse=false&locale=en`;
    let importData = null;
    let exportData = null;
    try {      
      importData = (await (await fetch(url('Import'))).json()).data;
      exportData = (await (await fetch(url('Export'))).json()).data;
    } catch (error) {
      console.log(error)
    }
    if (!importData || !exportData || !Array.isArray(importData) || !Array.isArray(exportData) || importData.length == 0 || exportData.length == 0) {
      continue;
    }
    console.log(oecCode, importData.length, exportData.length)
    for (let index = 0; index < netImportData.length; index++) {
      const hsxid = template[index][`${HSx} ID`];
      const importValue = importData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      const exportValue = exportData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      // convert oec trade value (in USD) to thousand USD
      // the most recent year (last year of current year) oec data is using 0.1 USD
      const conversionRate = (year) => year>=(new Date().getFullYear()-1) ? 10000 : 1000; 
      const value = (importValue-exportValue)/conversionRate(YEAR);
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
  if (netImport == 0 || netExport == 0) {
    return null;
  }
  return {
    netImportData: netImportDataClean,
    netExportData: netExportDataClean,
    netImport: netImport,
    netExport: netExport,
  }

  function cleanPortData(portData) {
    const threshold = 20000; // discard trade less than 20 million $
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
    <g transform="translate(${xOffset},${yOffset})" id="${countryISO2.replace(/\W/g, '')}_${YEAR}">
  ${importSvgG}
  ${exportSvgG}
    </g>\n</svg>`;
  return svg;
}

async function makeMapGroup(HSx,mapWidth, mapHeight) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mapWidth}" height="${mapHeight}">
  <rect width="${mapWidth}" height="${mapHeight}" x="0" y="0" fill="#FFFFFF" id="backgorund"/>
  <g id="legend" transform="translate(10,1500)"><g transform="translate(5,0)"><g class="legendColor" transform="translate(0,0)"><g class="legendCells" transform="translate(0,16)"><g class="cell" transform="translate(0, 0)"><rect class="swatch" height="15" width="15" style="fill: rgb(158, 1, 66);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal Hides</tspan></text></g><g class="cell" transform="translate(0, 21)"><rect class="swatch" height="15" width="15" style="fill: rgb(185, 31, 72);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal Products</tspan></text></g><g class="cell" transform="translate(0, 42)"><rect class="swatch" height="15" width="15" style="fill: rgb(209, 60, 75);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal and Vegetable</tspan><tspan x="0" dy="1.2em">Bi-Products</tspan></text></g><g class="cell" transform="translate(0, 78.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(228, 86, 73);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Arts and Antiques</tspan></text></g><g class="cell" transform="translate(0, 99.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(240, 112, 74);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Chemical Products</tspan></text></g><g class="cell" transform="translate(0, 120.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(248, 142, 83);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Foodstuffs</tspan></text></g><g class="cell" transform="translate(0, 141.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(252, 172, 99);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Footwear and Headwear</tspan></text></g><g class="cell" transform="translate(0, 162.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(253, 198, 118);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Instruments</tspan></text></g><g class="cell" transform="translate(0, 183.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(254, 221, 141);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Machines</tspan></text></g><g class="cell" transform="translate(0, 204.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(254, 238, 163);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Metals</tspan></text></g><g class="cell" transform="translate(0, 225.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(251, 248, 176);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Mineral Products</tspan></text></g><g class="cell" transform="translate(0, 246.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(241, 249, 171);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Miscellaneous</tspan></text></g><g class="cell" transform="translate(0, 267.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(224, 243, 161);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Paper Goods</tspan></text></g><g class="cell" transform="translate(0, 288.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(200, 233, 159);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Plastics and Rubbers</tspan></text></g><g class="cell" transform="translate(0, 309.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(169, 221, 162);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Precious Metals</tspan></text></g><g class="cell" transform="translate(0, 330.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(137, 207, 165);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Stone And Glass</tspan></text></g><g class="cell" transform="translate(0, 351.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(105, 189, 169);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Textiles</tspan></text></g><g class="cell" transform="translate(0, 372.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(78, 164, 176);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Transportation</tspan></text></g><g class="cell" transform="translate(0, 393.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(66, 136, 181);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Vegetable Products</tspan></text></g><g class="cell" transform="translate(0, 414.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(74, 108, 174);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Weapons</tspan></text></g><g class="cell" transform="translate(0, 435.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(94, 79, 162);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Wood Products</tspan></text></g></g><text class="legendTitle"><tspan x="0" dy="0em">Section</tspan></text></g></g></g>
  <g id="legend" transform="translate(59830,19500)"><g transform="translate(5,0)"><g class="legendColor" transform="translate(0,0)"><g class="legendCells" transform="translate(0,16)"><g class="cell" transform="translate(0, 0)"><rect class="swatch" height="15" width="15" style="fill: rgb(158, 1, 66);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal Hides</tspan></text></g><g class="cell" transform="translate(0, 21)"><rect class="swatch" height="15" width="15" style="fill: rgb(185, 31, 72);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal Products</tspan></text></g><g class="cell" transform="translate(0, 42)"><rect class="swatch" height="15" width="15" style="fill: rgb(209, 60, 75);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Animal and Vegetable</tspan><tspan x="0" dy="1.2em">Bi-Products</tspan></text></g><g class="cell" transform="translate(0, 78.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(228, 86, 73);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Arts and Antiques</tspan></text></g><g class="cell" transform="translate(0, 99.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(240, 112, 74);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Chemical Products</tspan></text></g><g class="cell" transform="translate(0, 120.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(248, 142, 83);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Foodstuffs</tspan></text></g><g class="cell" transform="translate(0, 141.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(252, 172, 99);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Footwear and Headwear</tspan></text></g><g class="cell" transform="translate(0, 162.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(253, 198, 118);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Instruments</tspan></text></g><g class="cell" transform="translate(0, 183.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(254, 221, 141);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Machines</tspan></text></g><g class="cell" transform="translate(0, 204.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(254, 238, 163);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Metals</tspan></text></g><g class="cell" transform="translate(0, 225.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(251, 248, 176);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Mineral Products</tspan></text></g><g class="cell" transform="translate(0, 246.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(241, 249, 171);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Miscellaneous</tspan></text></g><g class="cell" transform="translate(0, 267.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(224, 243, 161);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Paper Goods</tspan></text></g><g class="cell" transform="translate(0, 288.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(200, 233, 159);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Plastics and Rubbers</tspan></text></g><g class="cell" transform="translate(0, 309.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(169, 221, 162);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Precious Metals</tspan></text></g><g class="cell" transform="translate(0, 330.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(137, 207, 165);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Stone And Glass</tspan></text></g><g class="cell" transform="translate(0, 351.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(105, 189, 169);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Textiles</tspan></text></g><g class="cell" transform="translate(0, 372.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(78, 164, 176);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Transportation</tspan></text></g><g class="cell" transform="translate(0, 393.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(66, 136, 181);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Vegetable Products</tspan></text></g><g class="cell" transform="translate(0, 414.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(74, 108, 174);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Weapons</tspan></text></g><g class="cell" transform="translate(0, 435.609375)"><rect class="swatch" height="15" width="15" style="fill: rgb(94, 79, 162);"/><text class="label" transform="translate(20, 0)"><tspan x="0" dy="0em">Wood Products</tspan></text></g></g><text class="legendTitle"><tspan x="0" dy="0em">Section</tspan></text></g></g></g>\n
  `;

  for(const country of fs.readFileSync('./countries1.tsv').toString().split(/\r?\n/).map(c=>c.split('\t'))){
    if (country.length===3){
      // add continent group
      //TODO: move the </g> in line 5 to the end of file before </svg>
      svg += `  </g>\n  <g transform="translate(${country[1]},${country[2]})" id="${country[0]}">\n`
      continue;
    }
    const oecCode = country[0];
    const iso2 = country[1];
    const latitude = country[2];
    const longitude = country[3];
    const countryName = country[4];
    const xOffset = country[5] || 0;
    const yOffset = country[6] || 0;
    console.log(oecCode, countryName);
    let singleSvg = await makeMap(HSx, [oecCode], countryName, iso2, xOffset, yOffset);
    if (!singleSvg) {
      appendFileSync('./countries1.tsv', country.join('\t')+'\n');
      continue;
    } 
    svg += singleSvg.split('\n').slice(2,-1).join('\n')+'\n';
  }
  svg +=`</svg>`
  fs.writeFileSync(`./worldtrademap_${YEAR}.svg`, svg)
}

async function makeGroupMap(HSx, groupName) {
  const oecCodes = [];
  const iso2s = [];
  const countryNames = [];
  for(const country of readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    oecCodes.push(country[0]);
    iso2s.push(country[1]);
    countryNames.push(country[4]);
  }
  let svg = await makeMap(HSx, oecCodes, groupName, groupName, 0, 0);
  writeFileSync(`./group/${groupName}_trademap.svg`, svg)
}


function getWidthHeight(area) {
  // https://www.usinflationcalculator.com/ 
  // compare to the end of 2020 (fill-in 2021) as 100%
  const CumulativeInflation = {
    1995: 56.24,
    1996: 57.90,
    1997: 59.23,
    1998: 60.15,
    1999: 61.48,
    2000: 63.55,
    2001: 65.32,
    2002: 66.39,
    2003: 67.90,
    2004: 69.71,
    2005: 72.07,
    2006: 74.40,
    2007: 76.52,
    2008: 79.46,
    2009: 79.17,
    2010: 80.47,
    2011: 83.01,
    2012: 84.73,
    2013: 85.97,
    2014: 87.37,
    2015: 87.47,
    2016: 88.57,
    2017: 90.46,
    2018: 92.67,
    2019: 94.35,
    2020: 95.51,
    2021: 100.00,
    2022: 108.00,
  }
  // area in 1k USD; scale to 1px = 10k USD equivalent as of 2020
  const scale = 1 / CumulativeInflation[YEAR];
  const ratio = 2; //16/9; //1.618;
  const width  = Math.ceil(Math.sqrt(area*scale*ratio));
  const height = Math.ceil(Math.sqrt(area*scale/ratio));
  return [width, height]
}

// makeMap(150000,60000)
// makeGroupMap('HS4', process.argv.slice(2).join(' '))
makeMapGroup(HSx, 60000, 20000)