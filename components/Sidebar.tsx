'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/utils/supabase/client';
import { SessionSummary } from '@/types/database';
import styles from './Sidebar.module.css';

interface SidebarProps {
    selectedSession: string | null;
    onSelectSession: (sessionId: string) => void;
}

export default function Sidebar({ selectedSession, onSelectSession }: SidebarProps) {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch sessions with aggregated data
    const fetchSessions = async () => {
        if (!isSupabaseConfigured) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('messages')
                .select('session_id, content, created_at, status, source');

            if (error) throw error;

            // Group by session_id and aggregate
            const sessionMap = new Map<string, SessionSummary>();

            data?.forEach((msg) => {
                const existing = sessionMap.get(msg.session_id);
                const hasPending = msg.status === 'pending_human';

                if (!existing) {
                    sessionMap.set(msg.session_id, {
                        session_id: msg.session_id,
                        latest_message: msg.content,
                        latest_timestamp: msg.created_at,
                        has_pending: hasPending,
                        source: msg.source,
                        message_count: 1,
                    });
                } else {
                    // Update if this message is newer
                    if (new Date(msg.created_at) > new Date(existing.latest_timestamp)) {
                        existing.latest_message = msg.content;
                        existing.latest_timestamp = msg.created_at;
                    }
                    // Mark as pending if any message is pending
                    if (hasPending) {
                        existing.has_pending = true;
                    }
                    existing.message_count++;
                }
            });

            // Convert to array and sort: pending first, then by latest timestamp
            const sessionsArray = Array.from(sessionMap.values()).sort((a, b) => {
                if (a.has_pending && !b.has_pending) return -1;
                if (!a.has_pending && b.has_pending) return 1;
                return new Date(b.latest_timestamp).getTime() - new Date(a.latest_timestamp).getTime();
            });

            setSessions(sessionsArray);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching sessions:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();

        // Subscribe to real-time changes
        console.log('Sidebar: Setting up real-time subscription for ALL messages');

        const channel = supabase
            .channel('messages-all-changes', {
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
                },
                (payload) => {
                    console.log('✅ Sidebar: New message inserted!', payload.new);
                    // Refetch sessions when any message is inserted
                    fetchSessions();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    console.log('✅ Sidebar: Message updated!', payload.new);
                    // Refetch sessions when any message is updated
                    fetchSessions();
                }
            )
            .subscribe((status) => {
                console.log('📡 Sidebar subscription status:', status);
            });

        return () => {
            console.log('🔌 Sidebar: Unsubscribing from messages');
            supabase.removeChannel(channel);
        };
    }, []);

    if (loading) {
        return (
            <div className={styles.sidebar}>
                <div className={styles.header}>
                    <h2>📬 Sessions</h2>
                </div>
                <div className={styles.loading}>
                    {isSupabaseConfigured ? 'Loading sessions...' : '⚠️ Please configure Supabase credentials in .env.local'}
                </div>
            </div>
        );
    }

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <h2>📬 Sessions</h2>
                <span className={styles.count}>{sessions.length}</span>
            </div>

            <div className={styles.sessionList}>
                {sessions.length === 0 ? (
                    <div className={styles.empty}>No sessions yet</div>
                ) : (
                    sessions.map((session) => (
                        <div
                            key={session.session_id}
                            className={`${styles.sessionItem} ${selectedSession === session.session_id ? styles.active : ''
                                }`}
                            onClick={() => onSelectSession(session.session_id)}
                        >
                            <div className={styles.sessionHeader}>
                                <div className={styles.sessionId}>
                                    {session.has_pending && <span className={styles.pendingBadge}>🔴</span>}
                                    <span className={styles.sourceIcon}>
                                        {session.source === 'whatsapp' ? '💬' : '🌐'}
                                    </span>
                                    Session {session.session_id.slice(0, 8)}
                                </div>
                                <div className={styles.messageCount}>{session.message_count}</div>
                            </div>

                            <div className={styles.latestMessage}>
                                {session.latest_message.substring(0, 50)}
                                {session.latest_message.length > 50 ? '...' : ''}
                            </div>

                            <div className={styles.timestamp}>
                                {new Date(session.latest_timestamp).toLocaleString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
