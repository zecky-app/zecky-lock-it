jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Settings: {},
}));
import { sortContacts } from '../src/lib/contacts';
import {
  defaultServerName,
  isHomeNode,
  parseSavedServers,
  parseServer,
  serverLabel,
} from '../src/lib/server';

jest.mock('react-native-keychain', () => ({}));

test('parses server addresses', () => {
  expect(parseServer('zec.rocks')).toEqual({ host: 'zec.rocks', port: 443 });
  expect(parseServer(' https://EU.zec.rocks:443/ ')).toEqual({
    host: 'eu.zec.rocks',
    port: 443,
  });
  expect(parseServer('my-node.example:9067')).toEqual({
    host: 'my-node.example',
    port: 9067,
  });
  expect(serverLabel({ host: 'a.b', port: 1 })).toBe('a.b:1');
  for (const bad of ['', 'has space.com', 'host:99999', 'host:0', '-bad.com']) {
    expect(parseServer(bad)).toBeNull();
  }
});

test('contacts sort by name, ignoring case', () => {
  const list = sortContacts([
    { id: '1', name: 'bob', address: 'b' },
    { id: '2', name: 'Alice', address: 'a' },
  ]);
  expect(list.map(c => c.name)).toEqual(['Alice', 'bob']);
});

test('recognises a home node by its private address', () => {
  for (const host of [
    '192.168.1.20',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '100.101.102.103',
    '127.0.0.1',
  ]) {
    expect(isHomeNode({ host, port: 8137 })).toBe(true);
  }
  for (const host of [
    'zec.rocks',
    '172.32.0.1',
    '100.128.0.1',
    '8.8.8.8',
    '192.169.1.1',
    '300.1.1.1',
    '192.168.1',
  ]) {
    expect(isHomeNode({ host, port: 443 })).toBe(false);
  }
});

test('names a saved server Rock it by default when it is a home node', () => {
  expect(defaultServerName({ host: '192.168.1.20', port: 8137 })).toBe(
    'Rock it',
  );
  expect(defaultServerName({ host: 'my-node.example', port: 9067 })).toBe(
    'my-node.example',
  );
});

test('reads saved servers and drops malformed ones', () => {
  const raw = JSON.stringify([
    { name: ' Rock it at home ', address: '192.168.1.20:8137' },
    { name: '', address: '100.101.102.103:8137' },
    { name: 'Duplicate', address: '192.168.1.20:8137' },
    { name: 'Bad', address: 'not a host' },
    { name: 42, address: 'zec.rocks' },
    'nonsense',
  ]);
  expect(parseSavedServers(raw)).toEqual([
    { host: '192.168.1.20', port: 8137, name: 'Rock it at home' },
    { host: '100.101.102.103', port: 8137, name: 'Rock it' },
  ]);
  expect(parseSavedServers('not json')).toEqual([]);
  expect(parseSavedServers(undefined)).toEqual([]);
});
