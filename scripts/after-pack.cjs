const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`Running ad-hoc codesign on ${appPath}...`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to ad-hoc codesign app:', err);
  }
};
