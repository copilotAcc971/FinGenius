import { useQuery } from '@tanstack/react-query';
import { Card } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { apiRequest } from '@/shared/lib/api/queryClient';

interface ComplianceItem {
  category: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  score: number;
  deadline?: string;
}

interface ComplianceDashboard {
  id: number;
  complianceType: string;
  status: string;
  score: number;
  auditItems: ComplianceItem[];
  deadlines: Array<{ item: string; date: string }>;
}

export default function CompliancePage() {
  const { data: dashboards, isLoading } = useQuery({
    queryKey: ['/api/compliance/dashboards'],
    queryFn: async () => {
      const response = await apiRequest('/api/compliance/dashboards', { method: 'GET' });
      return response || [];
    },
  });

  const mockDashboards: ComplianceDashboard[] = [
    {
      id: 1,
      complianceType: 'SOX',
      status: 'partial',
      score: 87,
      auditItems: [
        { category: 'Financial Reporting Controls', status: 'compliant', score: 95 },
        { category: 'Access Controls', status: 'compliant', score: 90 },
        { category: 'Audit Logging', status: 'partial', score: 75 },
        { category: 'Document Retention', status: 'compliant', score: 85 },
      ],
      deadlines: [
        { item: 'Annual Audit Completion', date: '2025-12-31' },
        { item: 'Control Assessment Review', date: '2025-09-30' },
      ],
    },
    {
      id: 2,
      complianceType: 'AML/KYC',
      status: 'compliant',
      score: 94,
      auditItems: [
        { category: 'Customer Verification', status: 'compliant', score: 98 },
        { category: 'Transaction Monitoring', status: 'compliant', score: 92 },
        { category: 'Sanctions Screening', status: 'compliant', score: 90 },
        { category: 'SAR Filing', status: 'compliant', score: 93 },
      ],
      deadlines: [
        { item: 'Quarterly AML Review', date: '2025-12-31' },
        { item: 'Risk Assessment Update', date: '2025-06-30' },
      ],
    },
    {
      id: 3,
      complianceType: 'GDPR',
      status: 'compliant',
      score: 91,
      auditItems: [
        { category: 'Data Privacy Controls', status: 'compliant', score: 94 },
        { category: 'Consent Management', status: 'compliant', score: 89 },
        { category: 'Data Retention Policies', status: 'compliant', score: 90 },
        { category: 'Breach Notification', status: 'compliant', score: 92 },
      ],
      deadlines: [
        { item: 'Privacy Impact Assessment', date: '2025-08-31' },
        { item: 'Processor Audit', date: '2025-10-31' },
      ],
    },
  ];

  const getStatusIcon = (status: string) => {
    if (status === 'compliant') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (status === 'partial') return <AlertCircle className="h-5 w-5 text-amber-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const getStatusColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6" data-testid="page-compliance">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-compliance">
          Compliance Dashboard
        </h1>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        {mockDashboards.map((dashboard) => (
          <Card key={dashboard.id} className="p-6" data-testid={`card-compliance-${dashboard.complianceType.toLowerCase()}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground" data-testid={`label-compliance-type-${dashboard.complianceType.toLowerCase()}`}>
                  {dashboard.complianceType}
                </p>
                <p className={`text-3xl font-bold ${getStatusColor(dashboard.score)}`} data-testid={`text-compliance-score-${dashboard.complianceType.toLowerCase()}`}>
                  {dashboard.score}%
                </p>
              </div>
              {getStatusIcon(dashboard.status)}
            </div>
            <Progress value={dashboard.score} className="mt-4" />
          </Card>
        ))}
      </div>

      {/* Detailed Dashboards */}
      <Tabs defaultValue="sox" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sox" data-testid="tab-sox">
            SOX
          </TabsTrigger>
          <TabsTrigger value="aml_kyc" data-testid="tab-aml-kyc">
            AML/KYC
          </TabsTrigger>
          <TabsTrigger value="gdpr" data-testid="tab-gdpr">
            GDPR
          </TabsTrigger>
        </TabsList>

        {mockDashboards.map((dashboard) => (
          <TabsContent
            key={dashboard.id}
            value={dashboard.complianceType.toLowerCase()}
            className="space-y-4"
          >
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4" data-testid={`heading-${dashboard.complianceType.toLowerCase()}`}>
                {dashboard.complianceType} Compliance Details
              </h2>

              {/* Audit Items */}
              <div className="space-y-3 mb-6">
                {dashboard.auditItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 border rounded"
                    data-testid={`item-audit-${item.category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium" data-testid={`text-audit-category-${idx}`}>
                          {item.category}
                        </p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-audit-status-${idx}`}>
                          Score: {item.score}%
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={item.status === 'compliant' ? 'default' : 'secondary'}
                      data-testid={`badge-audit-${item.category.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Deadlines */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2" data-testid={`heading-deadlines-${dashboard.complianceType.toLowerCase()}`}>
                  <Clock className="h-4 w-4" />
                  Key Deadlines
                </h3>
                <div className="space-y-2">
                  {dashboard.deadlines.map((deadline, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                      data-testid={`item-deadline-${dashboard.complianceType.toLowerCase()}-${idx}`}
                    >
                      <p className="text-sm" data-testid={`text-deadline-item-${idx}`}>
                        {deadline.item}
                      </p>
                      <p className="text-sm font-medium" data-testid={`text-deadline-date-${idx}`}>
                        {deadline.date}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
