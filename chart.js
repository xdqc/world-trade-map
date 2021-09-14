const { chart } = require('@rawgraphs/rawgraphs-core')
const { treemap } = require('@rawgraphs/rawgraphs-charts')
const { JSDOM } = require("jsdom");
const fs = require('fs')
const fetch = require('node-fetch');


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
    // add top-labels and offsets
    .replace('<g transform="translate(10,10)" id="viz"><g id="leaves">',`
    <g transform="translate(10,${titleOffset})" id="${_id}_2020"><text dominant-baseline="text-before-edge" class="txt"><tspan x="20" y="0.2em" style="font-family: Arial, sans-serif; font-size: ${_titleSize}px; fill: black; font-weight: bold;">${countryName} net ${im>0?'import':'export'} ${_value}</tspan></text><g id="${_id}_2020_leaves" transform="translate(0, ${Math.ceil(15+(_titleSize-11)*1.5)})">`)
    // add global id
    .replace(/("(?:url\()?#?)((?:path|clip)\d+\)?")/g, `$1${_id}_$2`)
    // remove extra style
    .replace(/ style="font-family: Arial, sans-serif; font-size: 10px; fill: black; font-weight: bold;"/g, '')
    // add <title> (tooltip on supported browsers)
    .replace(/<tspan x="3" y="0\.2em">([^<>]+)<\/tspan><tspan x="3" y="1\.3em">(\d+)<\/tspan><\/text>/g, `<tspan x="3" y="0.2em">$1</tspan><tspan x="3" y="1.3em">$2</tspan></text><title>$1&#10;$2</title>`)
    // remove <rect> with 0 width|height
    .replace(/<g transform[^<]+<[^<]+(width|height)="0"[^&]+&#10;\d+<\/title><\/g>/g, '')
    // remove <text> on small width|height < 10px
    .replace(/(<g transform[^<]+<[^<]+(?:width|height)="\d"[^\/]+\/[^\/]+)(<clipPath [^#]+#[^#]+#[^#]+<\/text>)/g, '$1')
    // remove verbose HS6 labels
    .replace(/____[^<]+<\/tspan>/g, '</tspan>')
    .replace(/____/g, '&#10;')
    .replace(/<\/svg>$/, '\n</svg>');
    // fs.writeFileSync(`./svg/${oecCode.slice(0,2)}_${oecCode.slice(2)}_${im>0?'im':'ex'}ports_${width*height}.svg`, svg);
  return svg;
}


async function getNetportData(HSx, im, oecCodes) {
  const template = JSON.parse(fs.readFileSync(`./template_${HSx}.json`).toString());
  for (const oecCode of oecCodes) {
    const url = (port) => `https://oec.world/olap-proxy/data?cube=trade_i_baci_a_92&${port}er+Country=${oecCode}&drilldowns=${HSx}&measures=Trade+Value&parents=true&Year=2020&sparse=false&locale=en`;
    const importData = (await (await fetch(url('Import'))).json()).data;
    const exportData = (await (await fetch(url('Export'))).json()).data;
    if (!importData || !exportData || !Array.isArray(importData) || !Array.isArray(exportData) || importData.length == 0 || exportData.length == 0) continue;
    console.log(oecCode,im)
    template.forEach(t => {
      const hsxid = t[`${HSx} ID`]
      const importValue = importData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      const exportValue = exportData.find(i => i[`${HSx} ID`] == hsxid)?.['Trade Value'] || 0;
      const value = im * (importValue-exportValue)/100000; // cent -> thousand$
      t['Trade Value'] += value;        
    })
  }
  const netportData = [];
  let netPort = 0;
  let sectionId = 0;
  template.forEach(t => {
    netPort += Math.max(0,t['Trade Value'])
    t['Trade Value'] = Math.round(Math.max(0,t['Trade Value']))
    // keep all sections to utilize full color palette
    if (t['Section ID'] > sectionId) {
      sectionId = t['Section ID'];
      netportData.push(t);
    } else if (t['Trade Value'] >= 1000) {
      netportData.push(t);
    }
  })

  // fs.writeFileSync('./netports.json', JSON.stringify(netportData))
  if (netPort == 0) return null;
  return [netportData, netPort]
}

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

async function makeGroupMap(HSx, groupName) {
  const oecCodes = [];
  const iso2s = [];
  const countryNames = [];
  for(const country of fs.readFileSync('./countries1.tsv').toString().split('\r\n').map(c=>c.split('\t'))){
    oecCodes.push(country[0]); iso2s.push(country[1]); countryNames.push(country[4]);
  }
  netImport = await getNetportData(HSx, 1, oecCodes);
  netExport = await getNetportData(HSx,-1, oecCodes);
  const [importWidth, importHeight] = getWidthHeight(netImport[1]);
  const [exportWidth, exportHeight] = getWidthHeight(netExport[1]);
  const importOffset = Math.ceil(importHeight/150);
  const exportOffset = importHeight + Math.ceil(Math.max(10, (importWidth)/50-10)); // import height + export fontsize
  
  const importSvgG = drawTreemap(groupName, groupName.replace(/\W/g,''), 'oecCode', HSx, 1, importOffset, ...netImport).split('\n')[1];
  const exportSvgG = drawTreemap(groupName, groupName.replace(/\W/g,''), 'oecCode', HSx,-1, exportOffset, ...netExport).split('\n')[1];
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

function getWidthHeight(area) {
  area = Math.ceil(area/10); // area 1px = 10k$
  const ratio = 1.618034;
  width  = Math.ceil(Math.sqrt(area*ratio));
  height = Math.ceil(Math.sqrt(area/ratio));
  return [width, height]
}

// makeMap(150000,60000)
makeGroupMap('HS6', process.argv.slice(2).join(' '))
