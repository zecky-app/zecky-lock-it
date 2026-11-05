import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { Tools } from 'react-native-zcash';
import { Button } from '../../components/Button';
import {
  defaultServerName,
  forgetServer,
  isHomeNode,
  MAX_SERVER_NAME,
  parseServer,
  sameServer,
  saveServer,
  Server,
  SERVER_PRESETS,
  serverLabel,
  serverName,
  nodeKind,
  nodeLabel,
  setServer,
  useSavedServers,
  useServer,
} from '../../lib/server';
import { setTorWanted, TorStatus, useTorWanted } from '../../lib/tor';
import { restartKeyRemovalIfRunning } from '../../lib/securityKey';
import { fonts, makeStyles, space, useColors } from '../../theme';

const TIMEOUT_MS = 12_000;

/** Resolves if the server answers like a Zcash light-wallet server. */
async function checkServer(server: Server): Promise<void> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
  );
  const height = await Promise.race([
    Tools.getBirthdayHeight(server.host, server.port),
    timeout,
  ]);
  if (!(height > 0)) throw new Error('no height');
}

const TOR_STATUS: Record<TorStatus, string> = {
  off: 'Off. The server sees your internet address.',
  starting: 'Connecting to Tor…',
  on: 'On. Releases and looking up your payments go through Tor.',
  failed:
    'Tor could not connect on this network. The wallet is using a direct connection.',
  unavailable: 'Tor is not available in this build of Zecky.',
  ownNode:
    'Not needed with your own node: Rock it is yours, so there is nobody to hide your address from. Zecky talks to it directly; the price still goes through Tor.',
};

export function ServerPage({ tor }: { tor: TorStatus }) {
  const colors = useColors();
  const styles = useStyles();
  const current = useServer();
  const savedServers = useSavedServers();
  const torWanted = useTorWanted();
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [checking, setChecking] = useState<string | null>(null);
  // Scanning a server QR, such as the Wallet server code on Rock it's page.
  const [scanning, setScanning] = useState(false);
  // A node scanned from Rock it's code counts as your own (re-check R3).
  const [scannedNode, setScannedNode] = useState<Server | null>(null);
  const onScanned = (value: string) => {
    if (!scanning) return;
    setScanning(false);
    const server = parseServer(value);
    if (server == null) {
      setMessage('That QR code is not a server address. Nothing was changed.');
      return;
    }
    setMessage(null);
    setScannedNode(
      server.host.toLowerCase().endsWith('.ts.net') || isHomeNode(server)
        ? server
        : null,
    );
    setCustom(serverLabel(server));
    if (name.trim() === '') {
      setName(
        server.host.endsWith('.ts.net')
          ? 'Rock it (Tailscale)'
          : isHomeNode(server)
          ? 'Rock it at home'
          : '',
      );
    }
  };
  const [message, setMessage] = useState<string | null>(null);

  /** Checks a server and switches to it. A name saves it under that name. */
  const choose = async (server: Server, saveAs?: string) => {
    const switching = !sameServer(server, current);
    if (!switching && saveAs == null) return;
    setChecking(serverLabel(server));
    setMessage(null);
    try {
      if (switching) await checkServer(server);
      const fromScan = scannedNode != null && sameServer(scannedNode, server);
      const label =
        saveAs != null || fromScan
          ? saveServer(saveAs ?? 'Rock it', server, fromScan ? true : undefined)
              .name
          : serverName(server) ?? serverLabel(server);
      if (fromScan) setScannedNode(null);
      if (switching) {
        // A running "lost my keys" removal starts its 48 hours again.
        await restartKeyRemovalIfRunning().catch(() => {});
        setServer(server);
      }
      setCustom('');
      setName('');
      setMessage(
        switching
          ? `Now using ${label}. The wallet is reconnecting.`
          : `Saved as ${label}.`,
      );
    } catch {
      setMessage(
        `Could not reach ${serverLabel(server)}. Nothing was changed. ` +
          (isHomeNode(server)
            ? 'Check that your node is running, and that this phone is on the same home network or connected to Tailscale.'
            : 'Check the address, and that the server accepts secure connections.'),
      );
    } finally {
      setChecking(null);
    }
  };

  const isPreset = SERVER_PRESETS.some(p => sameServer(p.server, current));
  const isSaved = savedServers.some(s => sameServer(s, current));
  const parsed = parseServer(custom);

  return (
    <>
      <Text style={styles.info}>
        Zecky reads the Zcash blockchain through a server. The server can see
        your internet address and that a wallet is syncing, but not your balance
        or addresses. Running your own gives the most privacy.
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Use Tor</Text>
            <Text style={styles.rowSub}>
              {torWanted ? TOR_STATUS[tor] : TOR_STATUS.off}
            </Text>
          </View>
          <Switch
            value={torWanted}
            onValueChange={setTorWanted}
            trackColor={{ true: colors.gold, false: colors.line }}
            ios_backgroundColor={colors.line}
          />
        </View>
      </View>
      <Text style={styles.remark}>Tor might slow down the connection.</Text>
      {torWanted && tor !== 'ownNode' && (
        <Text style={styles.remark}>
          With Tor, a release sometimes needs a second try. Zecky tries again at
          once, and otherwise every few minutes by itself.
        </Text>
      )}
      <Text style={styles.info}>
        Tor hides your internet address when Zecky releases Zcash, looks up your
        own payments, checks the chain height or fetches the price. Downloading
        blocks stays direct, so the server can still tell that a Zcash wallet is
        syncing. Some networks block Tor.
      </Text>

      <View style={styles.card}>
        {SERVER_PRESETS.map(preset => {
          const on = sameServer(preset.server, current);
          const busy = checking === serverLabel(preset.server);
          return (
            <Pressable
              key={preset.server.host}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              disabled={checking != null}
              onPress={() => choose(preset.server)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{preset.label}</Text>
                <Text style={styles.rowSub}>{serverLabel(preset.server)}</Text>
              </View>
              <Text style={styles.rowState}>
                {busy ? 'Checking…' : on ? 'In use' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {(savedServers.length > 0 || (!isPreset && !isSaved)) && (
        <>
          <Text style={styles.label}>Your servers</Text>
          {(nodeKind(current) === 'home' ||
            nodeKind(current) === 'tailscaleIp') && (
            <Text style={styles.remark}>
              {nodeKind(current) === 'home' ? 'Home network only: ' : ''}
              Zecky can't check that the node at this address is yours. Use the
              Tailscale name (…ts.net) from your Rock it code instead: it only
              exists in your own Tailscale network.
            </Text>
          )}
          <View style={styles.card}>
            {savedServers.map(saved => {
              const on = sameServer(saved, current);
              const busy = checking === serverLabel(saved);
              return (
                <View key={serverLabel(saved)} style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    disabled={checking != null}
                    onPress={() => choose(saved)}
                    style={({ pressed }) => [
                      styles.rowText,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.rowTitle}>{saved.name}</Text>
                    <Text style={styles.rowSub}>
                      {serverLabel(saved)}
                      {nodeKind(saved) != null
                        ? ` · ${nodeLabel(nodeKind(saved) ?? 'home')}`
                        : ''}
                    </Text>
                  </Pressable>
                  {busy ? (
                    <Text style={styles.rowState}>Checking…</Text>
                  ) : on ? (
                    <Text style={styles.rowState}>In use</Text>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${saved.name}`}
                      disabled={checking != null}
                      hitSlop={8}
                      onPress={() => forgetServer(saved)}
                    >
                      <Text style={styles.remove}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
            {!isPreset && !isSaved && (
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    {defaultServerName(current)}
                  </Text>
                  <Text style={styles.rowSub}>{serverLabel(current)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save this server"
                  disabled={checking != null}
                  hitSlop={8}
                  onPress={() => choose(current, defaultServerName(current))}
                >
                  <Text style={styles.rowState}>In use · Save</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      <Text style={styles.label}>Add a server</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={MAX_SERVER_NAME}
        autoCorrect={false}
        placeholder="Name, for example Rock it at home"
        placeholderTextColor={colors.goldDim}
        selectionColor={colors.gold}
      />
      <View style={styles.gap} />
      <TextInput
        style={styles.input}
        value={custom}
        onChangeText={setCustom}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="url"
        placeholder="host or host:port"
        placeholderTextColor={colors.goldDim}
        selectionColor={colors.gold}
      />
      {scanning ? (
        <>
          <View style={styles.cameraFrame}>
            <Camera
              style={styles.camera}
              scanBarcode
              showFrame={false}
              onReadCode={event => onScanned(event.nativeEvent.codeStringValue)}
            />
          </View>
          <View style={styles.gap} />
          <Button
            label="Cancel scan"
            variant="back"
            onPress={() => setScanning(false)}
          />
        </>
      ) : (
        <>
          <View style={styles.gap} />
          <Button
            label="Scan QR code"
            variant="quiet"
            onPress={() => {
              setMessage(null);
              setScanning(true);
            }}
          />
        </>
      )}
      <Text style={styles.info}>
        Your own node: scan the Wallet server code on its Rock it page, or type
        its address. Save the home and Tailscale addresses under their own name.
      </Text>
      {torWanted && (
        <Text style={styles.info}>
          Checking a server connects to it directly, also with Tor on: it sees
          your internet address once, never anything about your wallet.
        </Text>
      )}
      <View style={styles.gap} />
      <Button
        label="Check, save and use"
        disabled={parsed == null}
        busy={
          checking != null && parsed != null && checking === serverLabel(parsed)
        }
        onPress={() => parsed != null && choose(parsed, name)}
      />
      {message != null && <Text style={styles.info}>{message}</Text>}
    </>
  );
}

const useStyles = makeStyles(colors => ({
  cameraFrame: {
    height: 280,
    marginTop: space.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: { flex: 1 },
  info: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.md,
  },
  remark: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
    marginTop: space.md,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    marginTop: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  pressed: { opacity: 0.5 },
  rowText: { flex: 1, paddingRight: space.md },
  rowTitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  rowSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowState: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold },
  remove: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  gap: { height: space.sm },
}));
