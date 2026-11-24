import React, { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Send } from 'lucide-react-native';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Radii, Spacing, Typography } from '../../theme/theme';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'TicketThread'>;

interface ThreadMessage {
  _id: string;
  body: string;
  createdAt: string;
  fromStaff: boolean;
  mine: boolean;
  authorName: string;
}

interface ThreadTicket {
  _id: string;
  ticketNumber: string;
  type: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  subject?: string;
  notes: string;
  createdAt: string;
  resolutionSummary: string;
  canReply: boolean;
}

export const TicketThreadScreen: React.FC<Props> = ({ route }) => {
  const { ticketId } = route.params;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [ticket, setTicket] = useState<ThreadTicket | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(`/support/tickets/${ticketId}`);
      setTicket(res.data.data.ticket);
      setMessages(res.data.data.messages || []);
    } catch (err: any) {
      Alert.alert('Could not load ticket', err?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await apiClient.post(`/support/tickets/${ticketId}/reply`, { body });
      setMessages(res.data.data.messages || []);
      setDraft('');
      await load();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Reply failed', err?.response?.data?.message || 'Unable to send your message.');
    } finally {
      setSending(false);
    }
  };

  if (loading && !ticket) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Ticket not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.headerCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.ticketNum}>#{ticket.ticketNumber}</Text>
            <Text style={styles.status}>{ticket.status.replace(/_/g, ' ').toUpperCase()}</Text>
          </View>
          <Text style={styles.type}>{ticket.type.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.body}>{ticket.notes}</Text>
          {ticket.resolutionSummary ? (
            <View style={styles.resolution}>
              <Text style={styles.resolutionLabel}>RESOLUTION</Text>
              <Text style={styles.body}>{ticket.resolutionSummary}</Text>
            </View>
          ) : null}
        </View>

        {messages.length === 0 ? (
          <Text style={[styles.muted, styles.noReplies]}>
            No replies yet. Our team will respond here as soon as possible.
          </Text>
        ) : null}

        {messages.map((m) => (
          <View key={m._id} style={[styles.bubble, m.fromStaff ? styles.staffBubble : styles.myBubble]}>
            <Text style={styles.author}>{m.fromStaff ? m.authorName : 'You'}</Text>
            <Text style={styles.body}>{m.body}</Text>
            <Text style={styles.time}>{new Date(m.createdAt).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>

      {ticket.canReply ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.slateMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.disabled]}
            onPress={send}
            disabled={!draft.trim() || sending}
          >
            {sending ? <ActivityIndicator color={Colors.white} /> : <Send size={18} color={Colors.white} />}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.closedNote}>This ticket is closed. Please raise a new request if you need more help.</Text>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  muted: { ...Typography.caption },
  noReplies: { textAlign: 'center', marginVertical: Spacing.lg },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNum: { fontWeight: '800', color: Colors.slateDark, fontSize: 14 },
  status: { fontSize: 11, fontWeight: '800', color: Colors.info },
  type: { fontWeight: '700', color: Colors.primary, fontSize: 12, marginVertical: 4 },
  body: { ...Typography.body, lineHeight: 20 },
  resolution: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.mint,
    borderRadius: Radii.md,
    padding: Spacing.sm,
  },
  resolutionLabel: { fontSize: 10, fontWeight: '800', color: Colors.mintDark, marginBottom: 2 },
  bubble: {
    maxWidth: '88%',
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  staffBubble: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderColor: Colors.border },
  myBubble: { alignSelf: 'flex-end', backgroundColor: Colors.primaryLight, borderColor: '#FFC9CB' },
  author: { fontSize: 11, fontWeight: '800', color: Colors.slateMuted, marginBottom: 3 },
  time: { fontSize: 10, color: Colors.slateMuted, marginTop: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: Colors.background,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.slateDark,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  closedNote: { ...Typography.caption, textAlign: 'center', padding: Spacing.md, backgroundColor: Colors.surface },
  newReply: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginTop: 6 },
  viewThread: { fontSize: 12, fontWeight: '700', color: Colors.slateMuted, marginTop: 6 },
});