'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import styles from './ActionPanel.module.css';

interface ActionPanelProps {
    sessionId: string | null;
}

type AuditStatus = 'idle' | 'auditing' | 'pass' | 'block';

interface AuditResponse {
    status: 'PASS' | 'BLOCK';
    advice?: string;
}

export default function ActionPanel({ sessionId }: ActionPanelProps) {
    const [draft, setDraft] = useState('');
    const [auditStatus, setAuditStatus] = useState<AuditStatus>('idle');
    const [auditAdvice, setAuditAdvice] = useState('');
    const [sending, setSending] = useState(false);

    const handleAudit = async () => {
        if (!draft.trim()) {
            alert('Please enter a message to audit');
            return;
        }

        setAuditStatus('auditing');
        setAuditAdvice('');

        try {
            const auditUrl = process.env.NEXT_PUBLIC_N8N_AUDIT_URL;

            if (!auditUrl) {
                throw new Error('N8N audit URL not configured');
            }

            const response = await fetch(auditUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    draft: draft,
                    channel: 'web',
                }),
            });

            if (!response.ok) {
                throw new Error('Audit request failed');
            }

            const result: AuditResponse = await response.json();

            if (result.status === 'BLOCK') {
                setAuditStatus('block');
                setAuditAdvice(result.advice || 'This message was flagged by the AI auditor.');
            } else {
                setAuditStatus('pass');
            }
        } catch (error) {
            console.error('Error during audit:', error);
            alert('Failed to audit message. Please check your N8N configuration.');
            setAuditStatus('idle');
        }
    };

    const handleSend = async () => {
        if (!sessionId) {
            alert('No session selected');
            return;
        }

        if (!draft.trim()) {
            alert('Please enter a message');
            return;
        }

        if (auditStatus !== 'pass') {
            alert('Please audit your message first');
            return;
        }

        setSending(true);

        try {
            // Insert the human agent message
            const { error: insertError } = await supabase.from('messages').insert({
                session_id: sessionId,
                role: 'human_agent',
                content: draft.trim(),
                status: 'resolved',
                source: 'web',
            });

            if (insertError) throw insertError;

            // Update all pending messages in this session to resolved
            const { error: updateError } = await supabase
                .from('messages')
                .update({ status: 'resolved' })
                .eq('session_id', sessionId)
                .eq('status', 'pending_human');

            if (updateError) throw updateError;

            // Clear the draft and reset audit status
            setDraft('');
            setAuditStatus('idle');
            setAuditAdvice('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    if (!sessionId) {
        return (
            <div className={styles.actionPanel}>
                <div className={styles.disabled}>
                    <div className={styles.disabledIcon}>🔒</div>
                    <p>Select a session to respond</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.actionPanel}>
            <div className={styles.header}>
                <h3>✍️ Response Panel</h3>
            </div>

            <div className={styles.content}>
                <div className={styles.textareaWrapper}>
                    <textarea
                        className={styles.textarea}
                        placeholder="Type your response here..."
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            // Reset audit when draft changes
                            if (auditStatus !== 'idle') {
                                setAuditStatus('idle');
                                setAuditAdvice('');
                            }
                        }}
                        rows={8}
                    />
                </div>

                {auditStatus === 'block' && auditAdvice && (
                    <div className={styles.auditAlert}>
                        <div className={styles.alertIcon}>🚫</div>
                        <div className={styles.alertContent}>
                            <strong>AI Audit: BLOCKED</strong>
                            <p>{auditAdvice}</p>
                        </div>
                    </div>
                )}

                {auditStatus === 'pass' && (
                    <div className={styles.auditSuccess}>
                        <div className={styles.successIcon}>✅</div>
                        <div className={styles.successContent}>
                            <strong>AI Audit: PASSED</strong>
                            <p>Your message is ready to send!</p>
                        </div>
                    </div>
                )}

                <div className={styles.actions}>
                    <button
                        className={`${styles.button} ${styles.auditButton}`}
                        onClick={handleAudit}
                        disabled={!draft.trim() || auditStatus === 'auditing' || sending}
                    >
                        {auditStatus === 'auditing' ? (
                            <>
                                <span className={styles.spinner}></span>
                                Auditing...
                            </>
                        ) : (
                            <>🔍 AI Audit</>
                        )}
                    </button>

                    <button
                        className={`${styles.button} ${styles.sendButton}`}
                        onClick={handleSend}
                        disabled={auditStatus !== 'pass' || sending}
                    >
                        {sending ? (
                            <>
                                <span className={styles.spinner}></span>
                                Sending...
                            </>
                        ) : (
                            <>🚀 Send</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
