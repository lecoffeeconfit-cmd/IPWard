import React from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { Card, Txt, Icon, Button, Badge, EmptyState, InfoNote, styles } from '../components/ui';
import { filterByRange, formatTime } from '../services/analytics';

export function AlertsScreen() {
  const { dataset, range, openDetail, navigate, settings } = useApp();
  const t = useTheme();
  const alerts = settings.alerts ? filterByRange(dataset.alerts, range) : [];
  return <View style={styles.stack}>
    {alerts.map(alert => <Card key={alert.id}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ width: 39, height: 39, borderRadius: 12, backgroundColor: alert.severity === 'Important' ? t.amberTint : t.blueTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={alert.severity === 'Important' ? 'arrow-up-right' : 'bell'} color={alert.severity === 'Important' ? t.amber : t.blue}/></View>
        <View style={{ flex: 1 }}>
          <Txt size={11} color={t.muted}>{alert.severity} · {formatTime(alert.timestamp)}</Txt>
          <Txt size={17} weight="500" style={{ marginTop: 6 }}>{alert.title}</Txt>
          <Txt size={13} color={t.muted} style={{ marginTop: 10, marginBottom: 17 }}>{alert.description}</Txt>
          <Badge state="Observed"/>
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}><Button small label="Inspect connection" variant="secondary" onPress={() => openDetail({ type: 'connection', id: alert.connectionId })}/></View>
        </View>
      </View>
    </Card>)}
    {!alerts.length && <EmptyState title={settings.alerts ? 'Nothing to call out' : 'Activity notices are off'} description={settings.alerts ? 'Changes in observable activity will appear here. Unfamiliar destinations are not automatically unsafe.' : 'You can enable sample notices in Protect.'} icon="bell"/>}
    <InfoNote>Sample notices demonstrate changes in activity. They are not security findings about your device.</InfoNote>
    <View style={{ alignSelf: 'flex-start' }}><Button label="Manage alert preferences" variant="secondary" icon="sliders" onPress={() => navigate('Protect')}/></View>
  </View>;
}
