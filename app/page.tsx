'use client';

import { useEffect } from 'react';
import { ChatDashboard } from '@/components/chat-dashboard';
import { ensureDatabaseInitialized } from './actions';

export default function Page() {
  useEffect(() => {
    // Initialize database on first load
    ensureDatabaseInitialized().catch(error => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

  return <ChatDashboard />;
}
