// Audit G2/G1: the version and build the app shows are the ones Xcode builds.
import { APP_BUILD, about } from '../src/lib/about';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '26.1',
    constants: { reactNativeVersion: { major: 0, minor: 87, patch: 1 } },
  },
}));

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
}>('fs');

test('version and build match the Xcode project and package.json', () => {
  const project = fs.readFileSync(
    'ios/Zecky.xcodeproj/project.pbxproj',
    'utf8',
  );
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    version: string;
  };
  const builds = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(
    m => Number(m[1]),
  );
  const versions = [...project.matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map(
    m => m[1],
  );
  expect(new Set(builds)).toEqual(new Set([APP_BUILD]));
  expect(new Set(versions)).toEqual(new Set([pkg.version]));
  expect(about.appVersion).toBe(`${pkg.version} (${APP_BUILD})`);
});

test('the changelog heading names this version and build', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    version: string;
  };
  const log = fs.readFileSync('docs/CHANGELOG.md', 'utf8');
  expect(log).toContain(`## ${pkg.version} (${APP_BUILD})`);
});
