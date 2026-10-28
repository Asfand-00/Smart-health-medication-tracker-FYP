/**
 * Drug information management — search the medicine reference, read uses /
 * side effects / warnings, and check the patient's current medications for
 * known interactions (GET /medication/drug-info, /interactions).
 */
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { qk } from '../api/queryClient';
import { medicationApi } from '../api/services';
import { PatientPicker, usePatientContext } from '../components/PatientContext';
import { AppText } from '../components/ui/AppText';
import { Button } from '../components/ui/Button';
import { Card, Divider, ListItem, Pill, SectionHeader } from '../components/ui/Card';
import { TextField } from '../components/ui/Form';
import { Screen, screenStyles } from '../components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useTheme } from '../context/AccessibilityContext';

export default function DrugInfoScreen() {
  const { colors } = useTheme();
  const ctx = usePatientContext();
  const params = useLocalSearchParams<{ name?: string }>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(params.name ?? null);

  useEffect(() => {
    if (params.name) setSelected(params.name);
  }, [params.name]);

  const results = useQuery({ queryKey: qk.drugSearch(query.trim().toLowerCase()), queryFn: () => medicationApi.searchDrugs(query.trim()) });
  const detail = useQuery({ queryKey: qk.drugInfo(selected ?? ''), queryFn: () => medicationApi.drugInfo(selected!), enabled: Boolean(selected), retry: false });
  const interactions = useQuery({
    queryKey: qk.interactions(ctx.patientId),
    queryFn: () => medicationApi.interactions(ctx.patientParam),
    enabled: Boolean(ctx.patientId),
  });

  return (
    <Screen onRefresh={() => Promise.all([results.refetch(), interactions.refetch()])}>
      <PatientPicker ctx={ctx} />
      {ctx.patientId ? (
        <>
          <SectionHeader title="Interaction check" icon="git-compare-outline" />
          <Card>
            {interactions.isPending ? (
              <LoadingState />
            ) : interactions.isError ? (
              <ErrorState error={interactions.error} onRetry={interactions.refetch} />
            ) : interactions.data ? (
              <>
                <AppText variant="caption" tone="faint">
                  Checked {interactions.data.checked} active medication{interactions.data.checked === 1 ? '' : 's'}
                  {interactions.data.unrecognised.length ? ` · not in the reference: ${interactions.data.unrecognised.join(', ')}` : ''}.
                </AppText>
                {interactions.data.warnings.length === 0 ? (
                  <AppText tone="success" weight="600">
                    ✓ No known interactions between the current medications.
                  </AppText>
                ) : (
                  interactions.data.warnings.map((w, i) => (
                    <View key={i} style={screenStyles.gap}>
                      <View style={screenStyles.row}>
                        <AppText weight="700" style={screenStyles.flex}>
                          {w.medications.join(' + ')}
                        </AppText>
                        <Pill label={`${w.severity} risk`} color={w.severity === 'high' ? colors.danger : colors.warning} />
                      </View>
                      <AppText variant="caption" tone="muted">
                        {w.message}
                      </AppText>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Medicine reference" icon="book-outline" />
      <TextField icon="search-outline" placeholder="Search by name, brand or class…" value={query} onChangeText={setQuery} autoCapitalize="none" accessibilityLabel="Search medicines" />

      {selected && (
        <Card accent={colors.primary}>
          {detail.isPending ? (
            <LoadingState />
          ) : detail.isError ? (
            <>
              <AppText weight="700">{selected}</AppText>
              <AppText tone="faint">No reference information for this medicine. Ask your pharmacist or doctor.</AppText>
            </>
          ) : detail.data ? (
            <>
              <View style={screenStyles.row}>
                <AppText variant="title" style={screenStyles.flex}>
                  {detail.data.name}
                </AppText>
                <Pill label={detail.data.class} color={colors.teal} />
              </View>
              {detail.data.aliases.length ? (
                <AppText variant="caption" tone="faint">
                  Also known as: {detail.data.aliases.join(', ')}
                </AppText>
              ) : null}
              <AppText>
                <AppText weight="700">Used for: </AppText>
                {detail.data.uses}
              </AppText>
              <AppText>
                <AppText weight="700">Side effects: </AppText>
                {detail.data.sideEffects.join(', ')}
              </AppText>
              <AppText color={colors.warning}>
                <AppText weight="700" color={colors.warning}>
                  Warnings:{' '}
                </AppText>
                {detail.data.warnings}
              </AppText>
              <AppText>
                <AppText weight="700">With food: </AppText>
                {detail.data.foodAdvice}
              </AppText>
              <AppText>
                <AppText weight="700">Interacts with: </AppText>
                {detail.data.interactions.join(', ')}
              </AppText>
            </>
          ) : null}
          <Button title="Close" variant="ghost" onPress={() => setSelected(null)} />
        </Card>
      )}

      <Card>
        {results.isPending ? (
          <LoadingState />
        ) : results.isError ? (
          <ErrorState error={results.error} onRetry={results.refetch} />
        ) : results.data && results.data.length > 0 ? (
          results.data.map((d, i) => (
            <View key={d.name}>
              {i > 0 && <Divider />}
              <ListItem title={d.name} subtitle={`${d.class} — ${d.uses}`} icon="medkit-outline" onPress={() => setSelected(d.name)} />
            </View>
          ))
        ) : (
          <EmptyState icon="search-outline" title="No medicines match" message="Try a generic name such as Donepezil or a class such as statin." />
        )}
      </Card>
    </Screen>
  );
}
