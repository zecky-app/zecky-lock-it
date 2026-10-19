import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
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
  setServer,
  useSavedServers,
  useServer,
} from '../../lib/server';
import { setTorWanted, TorStatus, useTorWanted } from '../../lib/tor';
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
  on: 'On. Sending and looking up your payments goes through Tor.',
  failed:
    'Tor could not connect on this network. The wallet is using a direct connection.',
  unavailable: 'Tor is not available in this build of Zecky.',
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
  const [message, setMessage] = useState<string | null>(null);

  /** Checks a server and switches to it. A name saves it under that name. */
  const choose = async (server: Server, saveAs?: string) => {
    const switching = !sameServer(server, current);
    if (!switching && saveAs == null) return;
    setChecking(serverLabel(server));
    setMessage(null);
    try {
      if (switching) await checkServer(server);
      const label =
        saveAs != null
          ? saveServer(saveAs, server).name
          : serverName(server) ?? serverLabel(server);
      if (switching) setServer(server);
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
      <Text style={styles.info}>
        Tor hides your internet address when Zecky sends a payment, looks up
        your own payments, checks the chain height or fetches the price.
        Downloading blocks stays direct, so the server can still tell that a
        Zcash wallet is syncing. Some networks block Tor.
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
                      {isHomeNode(saved) ? ' · Rock it' : ''}
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
      <Text style={styles.info}>
        Your own node: use its home address, and its Tailscale address for
        when you are away. Save both under their own name.
      </Text>
      <View style={styles.gap} />
      <Button
        label="Check, save and use"
        variant="quiet"
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
    borderRadius: 16,
    paddingHorizontal: space.md,
    marginTop: space.lg,
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
