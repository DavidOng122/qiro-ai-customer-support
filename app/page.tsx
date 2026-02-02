'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import ActionPanel from '@/components/ActionPanel';
import styles from './page.module.css';

export default function Home() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  return (
    <div className={styles.dashboard}>
      <Sidebar
        selectedSession={selectedSession}
        onSelectSession={setSelectedSession}
      />
      <ChatArea sessionId={selectedSession} />
      <ActionPanel sessionId={selectedSession} />
    </div>
  );
}

