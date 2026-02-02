'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Message } from '@/types/database';
import styles from './ChatArea.module.css';

interface ChatAreaProps {
    sessionId: string | null;
}

export default function ChatArea({ sessionId }: ChatAreaProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!sessionId) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setMessages(data || []);
            } catch (error) {
                console.error('Error fetching messages:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to real-time updates for this session
        console.log(`ChatArea: Setting up subscription for session ${sessionId}`);

        const channel = supabase
            .channel(`messages-${sessionId}`, {
                config: {
                    broadcast: { self: true },
                },
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    console.log('✅ ChatArea: New message received!', payload.new);
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    console.log('✅ ChatArea: Message updated!', payload.new);
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === (payload.new as Message).id ? (payload.new as Message) : msg
                        )
                    );
                }
            )
            .subscribe((status) => {
                console.log(`📡 ChatArea subscription status for ${sessionId}:`, status);
            });

        return () => {
            console.log(`🔌 ChatArea: Unsubscribing from ${sessionId}`);
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

    if (!sessionId) {
        return (
            <div className={styles.chatArea}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>💬</div>
                    <h3>No Session Selected</h3>
                    <p>Select a session from the sidebar to view the conversation</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={styles.chatArea}>
                <div className={styles.header}>
                    <h3>Session {sessionId.slice(0, 12)}</h3>
                </div>
                <div className={styles.loading}>Loading messages...</div>
            </div>
        );
    }

    return (
        <div className={styles.chatArea}>
            <div className={styles.header}>
                <h3>📨 Session {sessionId.slice(0, 12)}</h3>
                <span className={styles.messageCount}>{messages.length} messages</span>
            </div>

            <div className={styles.messagesContainer}>
                {messages.length === 0 ? (
                    <div className={styles.noMessages}>No messages yet</div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`${styles.message} ${styles[message.role]}`}
                        >
                            <div className={styles.messageHeader}>
                                <span className={styles.role}>
                                    {message.role === 'user' && '👤 User'}
                                    {message.role === 'ai' && '🤖 AI Assistant'}
                                    {message.role === 'human_agent' && '👨‍💼 Human Agent'}
                                </span>
                                <span className={styles.timestamp}>
                                    {new Date(message.created_at).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className={styles.messageContent}>{message.content}</div>
                            {message.status === 'pending_human' && (
                                <div className={styles.statusBadge}>⏳ Pending Human Review</div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}
