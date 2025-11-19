import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { 
  RefreshCw, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  FileText,
  Users,
  CreditCard,
  Building,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ComplianceOverview {
  sox: {
    status: string;
    auditLogsCount: number;
    recentAuditLogs: number;
    lastAuditDate: string;
  };
  amlKyc: {
    status: string;
    verifiedKYC: number;
    pendingKYC: number;
    eddRequired: number;
    openAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
    pendingSARs: number;
  };
  gdpr: {
    status: string;
    dataSubjectRequests: number;
    pendingDSRs: number;
  };
  pciDss: {
    status: string;
    secureTransactions: number;
    failedTransactions: number;
  };
  psd2: {
    status: string;
    bankConnections: number;
    activeConnections: number;
  };
}

interface ComplianceDeadline {
  id: string;
  complianceArea: string;
  title: string;
  description: string | null;
  dueDate: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  completedAt: Date | null;
}

interface ComplianceTraining {
  id: string;
  trainingModule: string;
  status: string;
  completedAt: Date | null;
  expiresAt: Date | null;
  score: number | null;
  dueDate: string | null;
}

export default function ComplianceDashboardPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data: overview, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery<ComplianceOverview>({
    queryKey: ['/api/compliance/dashboard'],
  });

  const { data: deadlines = [], isLoading: isLoadingDeadlines, refetch: refetchDeadlines } = useQuery<ComplianceDeadline[]>({
    queryKey: ['/api/compliance/deadlines'],
  });

  const { data: training = [], isLoading: isLoadingTraining, refetch: refetchTraining } = useQuery<ComplianceTraining[]>({
    queryKey: ['/api/compliance/training'],
  });

  const handleRefresh = () => {
    refetchOverview();
    refetchDeadlines();
    refetchTraining();
    setLastUpdated(new Date());
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'default';
      case 'attention_required':
        return 'secondary';
      case 'critical':
        return 'destructive';
      case 'not_applicable':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'attention_required':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'outline';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Calculate audit checklist completion based on REAL data
  const auditChecklistItems = useMemo(() => {
    if (!overview) return [];
    
    const items = [
      {
        id: 'sox_logs',
        label: 'Review and verify all SOX audit logs',
        completed: overview.sox.auditLogsCount > 0 && overview.sox.recentAuditLogs > 0,
        link: '/audit-logs',
      },
      {
        id: 'kyc_pending',
        label: 'Complete all pending KYC verifications',
        completed: overview.amlKyc.pendingKYC === 0,
        link: '/compliance/kyc',
      },
      {
        id: 'alerts',
        label: 'Resolve high/critical transaction alerts',
        completed: overview.amlKyc.criticalAlerts === 0 && overview.amlKyc.highAlerts === 0,
        link: '/compliance/alerts',
      },
      {
        id: 'sars',
        label: 'File all pending SARs',
        completed: overview.amlKyc.pendingSARs === 0,
        link: '/compliance/sar',
      },
      {
        id: 'edd',
        label: 'Complete all EDD requirements',
        completed: overview.amlKyc.eddRequired === 0,
        link: '/compliance/kyc',
      },
      {
        id: 'bank_connections',
        label: 'Verify all bank connections are active (PSD2)',
        completed: overview.psd2.bankConnections > 0 && overview.psd2.activeConnections === overview.psd2.bankConnections,
        link: '/open-banking/connections',
      },
      {
        id: 'training',
        label: 'Complete all required compliance training',
        completed: training.length > 0 ? training.every(t => t.status === 'completed') : false,
        link: '#training',
      },
      {
        id: 'deadlines',
        label: 'Address all overdue compliance deadlines',
        completed: deadlines.length > 0 ? deadlines.every(d => d.status !== 'overdue') : true,
        link: '#deadlines',
      },
    ];
    
    return items;
  }, [overview, training, deadlines]);

  const completedChecklist = auditChecklistItems.filter(item => item.completed).length;
  const checklistProgress = auditChecklistItems.length > 0 ? (completedChecklist / auditChecklistItems.length) * 100 : 0;

  // Use REAL data from API for Alerts Severity Chart
  const alertsSeverityData = useMemo(() => {
    if (!overview?.amlKyc) return [];
    
    return [
      { severity: 'Critical', count: overview.amlKyc.criticalAlerts || 0 },
      { severity: 'High', count: overview.amlKyc.highAlerts || 0 },
      { severity: 'Medium', count: overview.amlKyc.mediumAlerts || 0 },
      { severity: 'Low', count: overview.amlKyc.lowAlerts || 0 },
    ].filter(item => item.count > 0);
  }, [overview]);

  // Use REAL data from API for KYC Status Chart
  const kycStatusData = useMemo(() => {
    // Show zero segments even when data is loading or missing
    const amlKyc = overview?.amlKyc || { verifiedKYC: 0, pendingKYC: 0, eddRequired: 0 };
    
    return [
      { name: 'Verified', value: amlKyc.verifiedKYC || 0, fill: 'hsl(var(--chart-1))' },
      { name: 'Pending', value: amlKyc.pendingKYC || 0, fill: 'hsl(var(--chart-2))' },
      { name: 'EDD Required', value: amlKyc.eddRequired || 0, fill: 'hsl(var(--chart-3))' },
    ];
  }, [overview]);

  const COLORS = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b'];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-compliance-dashboard">
      {/* Header Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-last-updated">
            Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm:ss')}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Compliance Status Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="section-status-cards">
        {/* SOX Compliance Card */}
        <Card data-testid="card-sox-compliance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SOX Compliance</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overview?.sox.status || 'not_applicable')}
                  <Badge variant={getStatusBadgeVariant(overview?.sox.status || 'not_applicable')} data-testid="badge-sox-status">
                    {overview?.sox.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-2xl font-semibold" data-testid="text-audit-logs-count">{overview?.sox.auditLogsCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {overview?.sox.recentAuditLogs || 0} logs in last 7 days
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AML/KYC Card */}
        <Card data-testid="card-aml-kyc">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AML/KYC</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overview?.amlKyc.status || 'not_applicable')}
                  <Badge variant={getStatusBadgeVariant(overview?.amlKyc.status || 'not_applicable')} data-testid="badge-aml-status">
                    {overview?.amlKyc.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Pending KYC</p>
                    <p className="text-lg font-semibold" data-testid="text-pending-kyc">{overview?.amlKyc.pendingKYC || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Open Alerts</p>
                    <p className="text-lg font-semibold" data-testid="text-open-alerts">{overview?.amlKyc.openAlerts || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Critical</p>
                    <p className="text-lg font-semibold text-destructive" data-testid="text-critical-alerts">{overview?.amlKyc.criticalAlerts || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pending SARs</p>
                    <p className="text-lg font-semibold" data-testid="text-pending-sars">{overview?.amlKyc.pendingSARs || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GDPR Card */}
        <Card data-testid="card-gdpr">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GDPR</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overview?.gdpr.status || 'not_applicable')}
                  <Badge variant="outline" data-testid="badge-not-implemented">Not Implemented</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Data subject requests: {overview?.gdpr.dataSubjectRequests || 0}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PCI-DSS Card */}
        <Card data-testid="card-pci-dss">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PCI-DSS</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overview?.pciDss.status || 'not_applicable')}
                  <Badge variant="outline" data-testid="badge-not-implemented-pci">Not Implemented</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payment security module pending
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PSD2 Card */}
        <Card data-testid="card-psd2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PSD2 (Open Banking)</CardTitle>
            <Building className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overview?.psd2.status || 'not_applicable')}
                  <Badge variant={getStatusBadgeVariant(overview?.psd2.status || 'not_applicable')} data-testid="badge-psd2-status">
                    {overview?.psd2.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-2xl font-semibold" data-testid="text-bank-connections">{overview?.psd2.bankConnections || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {overview?.psd2.activeConnections || 0} active connections
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines Section */}
      <Card data-testid="section-deadlines">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Compliance tasks and submission deadlines</CardDescription>
          </div>
          <Button data-testid="button-add-deadline">
            <Plus className="w-4 h-4" />
            Add Deadline
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingDeadlines ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deadlines">
              No upcoming deadlines
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Title</th>
                    <th className="text-left p-2 font-medium">Area</th>
                    <th className="text-left p-2 font-medium">Due Date</th>
                    <th className="text-left p-2 font-medium">Priority</th>
                    <th className="text-left p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deadlines.map((deadline) => (
                    <tr key={deadline.id} className="border-b" data-testid={`row-deadline-${deadline.id}`}>
                      <td className="p-2">{deadline.title}</td>
                      <td className="p-2">
                        <Badge variant="outline">{deadline.complianceArea}</Badge>
                      </td>
                      <td className="p-2">{format(new Date(deadline.dueDate), 'MMM dd, yyyy')}</td>
                      <td className="p-2">
                        <Badge variant={getPriorityBadgeVariant(deadline.priority)}>
                          {deadline.priority}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{deadline.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Requirements Section */}
      <Card data-testid="section-training">
        <CardHeader>
          <CardTitle>My Training Requirements</CardTitle>
          <CardDescription>Compliance training assignments and certifications</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTraining ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : training.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-training">
              No training assignments
            </p>
          ) : (
            <div className="space-y-4">
              {training.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 p-4 border rounded-md" data-testid={`training-${item.id}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{item.trainingModule.replace(/_/g, ' ')}</h4>
                    <Badge 
                      variant={item.status === 'completed' ? 'default' : item.status === 'expired' ? 'destructive' : 'secondary'}
                      data-testid={`badge-training-status-${item.id}`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  {item.status === 'in_progress' && (
                    <Progress value={50} data-testid={`progress-training-${item.id}`} />
                  )}
                  {item.score !== null && (
                    <p className="text-sm text-muted-foreground">Score: {item.score}%</p>
                  )}
                  {item.status === 'not_started' && (
                    <Button size="sm" data-testid={`button-start-training-${item.id}`}>
                      Start Training
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Preparation Checklist */}
      <Card data-testid="section-audit-checklist">
        <CardHeader>
          <CardTitle>Audit Preparation Checklist</CardTitle>
          <CardDescription>Items to complete before next audit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground" data-testid="text-checklist-progress">
                  {completedChecklist} of {auditChecklist.length} complete
                </span>
              </div>
              <Progress value={checklistProgress} data-testid="progress-audit-checklist" />
            </div>
            <div className="space-y-2">
              {auditChecklistItems.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-start gap-3 p-3 rounded-md hover-elevate cursor-pointer"
                  data-testid={`checklist-item-${item.id}`}
                >
                  <div className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center mt-0.5">
                    {item.completed && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className="text-sm flex-1">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Metrics Charts */}
      <div className="grid gap-4 md:grid-cols-2" data-testid="section-charts">
        {/* Transaction Alerts by Severity */}
        <Card data-testid="chart-alerts-severity">
          <CardHeader>
            <CardTitle>Transaction Alerts by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={alertsSeverityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="severity" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* KYC Verification Status Distribution */}
        <Card data-testid="chart-kyc-status">
          <CardHeader>
            <CardTitle>KYC Verification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={kycStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {kycStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
