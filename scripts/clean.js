const fs = require('fs');

fs.rmdirSync('dist/package', { recursive: true, force: true })