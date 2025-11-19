export interface PendingApproval {
  id: string;
  entityType: string;
  entityId: string;
  currentStep: number;
  requestedBy: string;
  createdAt: string;
  approvalDeadline: string | null;
  
  entity: {
    journalEntryNumber: string | null;
    entryDate: string | null;
    description: string | null;
    totalAmount: string;
    currencyCode: string | null;
  };
  
  workflow: {
    id: string | null;
    name: string | null;
    totalSteps: number;
    currentStepName: string;
  };
  
  requester: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}
