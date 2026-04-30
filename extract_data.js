const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../Mitus_IP_Web.html');
const targetPath = path.join(__dirname, 'src/data/mockData.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Function to extract a variable assignment
// We look for: const varName = { ... };
function extractVar(varName) {
  const regex = new RegExp(`const\\s+${varName}\\s*=\\s*({[\\s\\S]*?\\n    };|{[\\s\\S]*?\\n      };|{[\\s\\S]*?\\n    \\};|{[\\s\\S]*?\\n\\s*\\};)`, 'm');
  const match = htmlContent.match(regex);
  // for defaultProjOverview and defaultIpIndexMap, they might end with `};` slightly differently
  if (match) {
    return `export ${match[0]}`;
  }
  
  // fallback for REVISION_LOG_SEED and others
  const idx = htmlContent.indexOf(`const ${varName} =`);
  if (idx === -1) return null;
  let endIdx = htmlContent.indexOf('};', idx);
  
  // if this is too short, let's look for `  };` or similar
  while (endIdx !== -1) {
    const chunk = htmlContent.slice(idx, endIdx + 2);
    // a basic balanced brace check
    let openCount = 0;
    let closeCount = 0;
    for (let char of chunk) {
      if (char === '{') openCount++;
      if (char === '}') closeCount++;
    }
    if (openCount > 0 && openCount === closeCount) {
      return `export ` + chunk;
    }
    endIdx = htmlContent.indexOf('};', endIdx + 2);
  }
  return null;
}

const varsToExtract = [
  'foundryProcessMap',
  'ipCategoryNameMap',
  'REVISION_LOG_SEED',
  'defaultProjOverview',
  'defaultIpIndexMap'
];

let appends = '\n\n// --- Extracted from Mitus_IP_Web.html ---\n\n';

varsToExtract.forEach(v => {
  const extracted = extractVar(v);
  if (extracted) {
    appends += extracted + '\n\n';
    console.log(`Successfully extracted ${v}`);
  } else {
    console.error(`Failed to extract ${v}`);
  }
});

fs.appendFileSync(targetPath, appends);
console.log('Appended to mockData.js successfully.');
