const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const packageJson = require('../package.json');


const PACKAGE_DIR = 'package'
const DIST_PACKAGE_DIR = 'dist/package'

async function ensurePackageDir() {
    await fsp.mkdir(DIST_PACKAGE_DIR, { recursive: true });
}

async function copyTextFile(sourceDir, targetDir, fileName, transformer) {
    if (transformer) {
        let content = await fsp.readFile(path.join(sourceDir, fileName), 'utf8');
        content = await transformer(content)
        await fsp.writeFile(path.join(targetDir, fileName), content);
    } else {
        await fsp.copyFile(path.join(sourceDir, fileName), path.join(targetDir, fileName));
    }
}

async function zipArchive(targetDir, targetFile, func) {
    const archiveName = path.join(targetDir, targetFile);

    const output = fs.createWriteStream(archiveName);
    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.pipe(output);

    var closeOutput = new Promise((resolve) => {
        output.on('close', () => resolve());
    })

    archive.on('error', (err) => {
        reject(err);
    });

    await func(archive);

    await archive.finalize();
    await closeOutput;

    return archive.pointer()
}

async function buildPackage() {
    await ensurePackageDir();

    await copyTextFile(PACKAGE_DIR, DIST_PACKAGE_DIR, 'config.json', async (content) => {
        const configJson = {
            name: packageJson.name,
            version: packageJson.version,
            title: packageJson.title ?? packageJson.name,
            description: packageJson.description ?? '',
            ...JSON.parse(content),
        }

        // return '\uFEFF' + JSON.stringify(configJson, undefined, 2);
        return JSON.stringify(configJson, undefined, 2);
    })

    await zipArchive(DIST_PACKAGE_DIR, `${packageJson.name}.zip`, async (archive) => {
        archive.glob('**/*', {
            ignore: ['system/wrapper.bs'],
            cwd: path.resolve(__dirname, '../package/src')
        }, {
            prefix: 'package'
        });

        const filePath = path.join(PACKAGE_DIR, 'src/system/wrapper.bs');
        let fileContent = await fsp.readFile(filePath, 'utf8');
        fileContent = fileContent.replace('{{VERSION}}', packageJson.version);
        archive.append(fileContent, { name: 'package/system/wrapper.bs' });

        archive.file('package/installer.bs', { name: 'installer.bs' })
        archive.file('dist/package/config.json', { name: 'config.json' })
    })
}

buildPackage();