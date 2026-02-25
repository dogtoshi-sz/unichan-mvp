const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const zipPath = path.join(__dirname, 'src', 'assets', 'live2d', 'models', 'Nicole.zip');
const buf = fs.readFileSync(zipPath);
JSZip.loadAsync(buf).then(z => {
  console.log('Nicole.zip entries (files only):');
  Object.keys(z.files).sort().forEach(k => {
    if (!z.files[k].dir) console.log(k);
  });
}).catch(e => console.error(e));
