import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { ModernCard } from '../../screens/DashboardScreen';
import { MessageSquare, Send } from 'lucide-react-native';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ChatbotCardProps {
  feedbacks: any[];
}

export default function ChatbotCard({ feedbacks }: ChatbotCardProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const customerAppUrl = process.env.EXPO_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3000";

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${customerAppUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbacks,
          messages,
          userMessage: userText
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get chatbot response from backend.");
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModernCard delay={600}>
      <View style={styles.header}>
        <MessageSquare color="#000000" size={20} />
        <Text style={styles.kpiLabel}>ASK AI ABOUT REVIEWS</Text>
      </View>

      <View style={styles.chatContainer}>
        {messages.length === 0 ? (
          <Text style={styles.emptyChatText}>Ask a question like: "Did anyone complain about the food temperature today?"</Text>
        ) : (
          <ScrollView 
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            style={styles.messagesList} 
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, idx) => (
              <View key={idx} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.modelBubble]}>
                <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.modelText]}>{msg.text}</Text>
              </View>
            ))}
            {loading && <ActivityIndicator color="#000000" style={{ alignSelf: 'flex-start', marginVertical: 8 }} />}
          </ScrollView>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask a specific question..."
          placeholderTextColor="#94a3b8"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={loading || !input.trim()}>
          <Send color="#ffffff" size={16} />
        </TouchableOpacity>
      </View>
    </ModernCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kpiLabel: { 
    fontSize: 12, 
    fontWeight: '800', 
    color: '#000000', 
    textTransform: 'uppercase', 
    letterSpacing: 1,
    marginLeft: 8,
  },
  chatContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 12,
    minHeight: 180,
    maxHeight: 300,
    marginBottom: 12,
  },
  emptyChatText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 55,
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  messagesList: {
    flexGrow: 0,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  modelBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  userText: {
    color: '#ffffff',
  },
  modelText: {
    color: '#000000',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 46,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  sendButton: {
    backgroundColor: '#000000',
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  }
});

