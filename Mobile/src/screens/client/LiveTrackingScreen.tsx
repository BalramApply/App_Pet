import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Crosshair, AlertTriangle, PhoneCall, Clock, MapPin } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { useSessionStore } from '../../store/useSessionStore';
import { apiClient } from '../../api/client';

const LeafletWebView = WebView as React.ComponentType<any>;

type Props = NativeStackScreenProps<RootStackParamList, 'LiveTracking'>;

const DEFAULT_LAT = 28.4694;
const DEFAULT_LNG = 77.0648;

const formatSeconds = (sec: number) => {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

const buildLeafletHtml = (
  initLat: number,
  initLng: number,
  destLat: number,
  destLng: number,
  routeCoords: Array<{ lat: number; lng: number }>
) => {
  const safeRoute = JSON.stringify(
    routeCoords.length > 0 ? routeCoords.map((p) => [p.lat, p.lng]) : [[initLat, initLng]]
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
    .pro-pin {
      width: 22px; height: 22px; border-radius: 50%;
      background: #FF5A5F; border: 3px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
    .home-pin {
      width: 18px; height: 18px; border-radius: 50%;
      background: #1E1E2D; border: 3px solid #E8F5E9;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const initLat = ${initLat};
    const initLng = ${initLng};
    const destLat = ${destLat};
    const destLng = ${destLng};
    const initialPath = ${safeRoute};

    const map = L.map('map').setView([initLat, initLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const homeIcon = L.divIcon({ className: 'home-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
    const proIcon = L.divIcon({ className: 'pro-pin', iconSize: [22, 22], iconAnchor: [11, 11] });

    L.marker([destLat, destLng], { icon: homeIcon }).addTo(map).bindPopup('Client / Destination');
    const proMarker = L.marker([initLat, initLng], { icon: proIcon }).addTo(map).bindPopup('Assigned Professional');

    const polyline = L.polyline(initialPath, {
      color: '#FF5A5F',
      weight: 4,
      opacity: 0.9
    }).addTo(map);

    window.updateProPosition = function(lat, lng, shouldCenter) {
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      proMarker.setLatLng([lat, lng]);
      polyline.addLatLng([lat, lng]);
      if (shouldCenter) {
        map.panTo([lat, lng], { animate: true });
      }
    };

    window.centerOnPro = function() {
      const ll = proMarker.getLatLng();
      map.setView([ll.lat, ll.lng], 16, { animate: true });
    };
  </script>
</body>
</html>`;
};

export const LiveTrackingScreen: React.FC<Props> = ({ route }) => {
  const { sessionId, bookingId } = route.params;
  const webViewRef = useRef<any>(null);

  const {
    activeSession,
    liveCoords,
    latestLocation,
    distanceCovered,
    remainingSeconds,
    elapsedSeconds,
    fetchSessionById,
    connectToSessionRoom,
    disconnectSocket,
    tickTimer,
  } = useSessionStore();

  const [followPro, setFollowPro] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetchSessionById(sessionId).catch(() => {});
    connectToSessionRoom(sessionId).catch(() => {});

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => {
      clearInterval(interval);
      disconnectSocket();
    };
  }, [sessionId, fetchSessionById, connectToSessionRoom, disconnectSocket, tickTimer]);

  useEffect(() => {
    if (mapReady && latestLocation && webViewRef.current) {
      const js = `window.updateProPosition && window.updateProPosition(${latestLocation.lat}, ${latestLocation.lng}, ${followPro}); true;`;
      webViewRef.current.injectJavaScript(js);
    }
  }, [mapReady, latestLocation, followPro]);

  const handleCenterOnPro = () => {
    setFollowPro(true);
    webViewRef.current?.injectJavaScript('window.centerOnPro && window.centerOnPro(); true;');
  };

  const handleSos = async () => {
    try {
      const res = await apiClient.post('/support/tickets', {
        type: 'emergency_sos',
        priority: 'critical',
        subject: 'Live Session Emergency SOS',
        notes: `SOS triggered during live Leaflet tracking for session ${sessionId}.`,
        sessionId,
        bookingId: bookingId || null,
      });
      Alert.alert('SOS Alert Sent', `Ticket #${res.data.data.ticket.ticketNumber} created.`);
    } catch (err: any) {
      Alert.alert('SOS Failed', err?.response?.data?.message || 'Unable to send SOS.');
    }
  };

  const handleContactRm = async () => {
    try {
      const res = await apiClient.post('/support/tickets', {
        type: 'callback_request',
        priority: 'high',
        subject: 'Relationship Manager Callback During Live Session',
        notes: `Requested RM callback for active session ${sessionId}.`,
        sessionId,
        bookingId: bookingId || null,
      });
      Alert.alert(
        'RM Callback Requested',
        `Ticket #${res.data.data.ticket.ticketNumber} logged. Your Relationship Manager will call shortly.`
      );
    } catch {
      Alert.alert('RM Support', 'Contact PetJeeva RM Desk at +91-124-400-0100.');
    }
  };

  const bookingObj =
    activeSession?.booking && typeof activeSession.booking === 'object'
      ? activeSession.booking
      : null;
  const destLat = bookingObj?.addressSnapshot?.coordinates?.lat || DEFAULT_LAT;
  const destLng = bookingObj?.addressSnapshot?.coordinates?.lng || DEFAULT_LNG;
  const startLat = latestLocation?.lat || destLat;
  const startLng = latestLocation?.lng || destLng;

  const html = buildLeafletHtml(startLat, startLng, destLat, destLng, liveCoords);

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <LeafletWebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          onLoadEnd={() => setMapReady(true)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        <TouchableOpacity style={styles.centerBtn} onPress={handleCenterOnPro}>
          <Crosshair size={20} color={Colors.slateDark} />
          <Text style={styles.centerBtnText}>Center on Pro</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <MapPin size={14} color={Colors.primary} />
            <Text style={styles.statusText}>
              {(activeSession?.status || 'in_progress').replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.distText}>Distance: {distanceCovered.toFixed(2)} km</Text>
        </View>

        <View style={styles.timerRow}>
          <View style={styles.timerBox}>
            <Clock size={16} color={Colors.slateDark} />
            <Text style={styles.timerLabel}>Elapsed</Text>
            <Text style={styles.timerVal}>{formatSeconds(elapsedSeconds)}</Text>
          </View>
          <View style={styles.timerBox}>
            <Clock size={16} color={Colors.primary} />
            <Text style={styles.timerLabel}>Remaining</Text>
            <Text style={[styles.timerVal, { color: Colors.primary }]}>
              {formatSeconds(remainingSeconds)}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rmBtn} onPress={handleContactRm}>
            <PhoneCall size={16} color={Colors.slateDark} />
            <Text style={styles.rmBtnText}>Call RM</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sosBtn} onPress={handleSos}>
            <AlertTriangle size={16} color={Colors.white} />
            <Text style={styles.sosBtnText}>Emergency SOS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapWrapper: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  centerBtn: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  centerBtnText: { fontWeight: '700', fontSize: 12, color: Colors.slateDark },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    gap: 5,
  },
  statusText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  distText: { fontWeight: '800', fontSize: 13, color: Colors.slateDark },
  timerRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  timerBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  timerLabel: { ...Typography.caption, marginTop: 2 },
  timerVal: { fontSize: 20, fontWeight: '800', color: Colors.slateDark, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  rmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: Radii.md,
    gap: 6,
  },
  rmBtnText: { fontWeight: '700', color: Colors.slateDark, fontSize: 14 },
  sosBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    paddingVertical: 12,
    borderRadius: Radii.md,
    gap: 6,
  },
  sosBtnText: { fontWeight: '700', color: Colors.white, fontSize: 14 },
});