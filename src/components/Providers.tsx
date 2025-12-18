'use client';

import { SessionProvider } from 'next-auth/react';
import { AccountProvider } from '@/contexts/AccountContext';
import { CampaignsDataProvider } from '@/contexts/CampaignsDataContext';
import { DrillDownProvider } from '@/contexts/DrillDownContext';
import { DetailPanelProvider } from '@/contexts/DetailPanelContext';
import { ActionQueueProvider } from '@/contexts/ActionQueueContext';
import { GuardrailsProvider } from '@/contexts/GuardrailsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ModeProvider } from '@/contexts/ModeContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ApprovalsProvider } from '@/contexts/ApprovalsContext';
import { UndoRedoProvider } from '@/contexts/UndoRedoContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { ToastProvider } from '@/components/Toast/ToastProvider';
import FloatingActionQueue from '@/components/FloatingActionQueue';
import { ReactNode, Suspense } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ModeProvider>
          <ToastProvider>
            <UndoRedoProvider>
              <AccountProvider>
                <CampaignsDataProvider>
                  <PermissionsProvider>
                    <ApprovalsProvider>
                      <GuardrailsProvider>
                        <ActionQueueProvider>
                          <DashboardProvider>
                            <Suspense fallback={null}>
                              <DrillDownProvider>
                                <DetailPanelProvider>
                                  {children}
                                  <FloatingActionQueue />
                                </DetailPanelProvider>
                              </DrillDownProvider>
                            </Suspense>
                          </DashboardProvider>
                        </ActionQueueProvider>
                      </GuardrailsProvider>
                    </ApprovalsProvider>
                  </PermissionsProvider>
                </CampaignsDataProvider>
              </AccountProvider>
            </UndoRedoProvider>
          </ToastProvider>
        </ModeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
