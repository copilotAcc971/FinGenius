import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, TrendingDown, HelpCircle, MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useTenant } from "@/shared/hooks/useTenant";
import type { BankabilityScore, FinancialMetricsSnapshot, ScoreHistory } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const gradeColors: Record<string, string> = {
  "A+": "bg-green-600 dark:bg-green-600",
  "A": "bg-green-600 dark:bg-green-600",
  "B+": "bg-blue-600 dark:bg-blue-600",
  "B": "bg-blue-600 dark:bg-blue-600",
  "C+": "bg-amber-600 dark:bg-amber-600",
  "C": "bg-amber-600 dark:bg-amber-600",
  "D": "bg-orange-600 dark:bg-orange-600",
  "F": "bg-red-600 dark:bg-red-600",
};

const eligibilityColors: Record<string, string> = {
  excellent: "bg-green-600 dark:bg-green-600",
  good: "bg-blue-600 dark:bg-blue-600",
  fair: "bg-amber-600 dark:bg-amber-600",
  poor: "bg-orange-600 dark:bg-orange-600",
  not_eligible: "bg-red-600 dark:bg-red-600",
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

const getProgressColor = (score: number) => {
  if (score >= 80) return "bg-green-600";
  if (score >= 60) return "bg-blue-600";
  if (score >= 40) return "bg-amber-600";
  return "bg-red-600";
};

export default function CreditPassportPage() {
  const { currentTenant } = useTenant();

  const { data: creditScore, isLoading: isLoadingScore } = useQuery<BankabilityScore>({
    queryKey: ["/api/credit-passport/current", currentTenant?.id],
    enabled: !!currentTenant,
  });

  const { data: scoreHistory, isLoading: isLoadingHistory } = useQuery<ScoreHistory[]>({
    queryKey: ["/api/credit-passport/history", currentTenant?.id],
    enabled: !!currentTenant,
  });

  const { data: metricsSnapshot } = useQuery<FinancialMetricsSnapshot>({
    queryKey: ["/api/credit-passport/metrics", currentTenant?.id],
    enabled: !!currentTenant && !!creditScore?.metricsSnapshotId,
  });

  const handleDownloadPDF = () => {
    window.open(`/api/credit-passport/pdf?tenantId=${currentTenant?.id}`, "_blank");
  };

  const componentScores = [
    { name: "Liquidity", score: creditScore?.liquidityScore || 0, description: "Ability to meet short-term obligations" },
    { name: "Leverage", score: creditScore?.leverageScore || 0, description: "Debt management and financial stability" },
    { name: "Profitability", score: creditScore?.profitabilityScore || 0, description: "Revenue generation and margins" },
    { name: "Cash Flow", score: creditScore?.cashFlowScore || 0, description: "Operating cash generation capacity" },
    { name: "Operational", score: creditScore?.operationalScore || 0, description: "Efficiency and working capital management" },
    { name: "Payment Behavior", score: creditScore?.paymentBehaviorScore || 0, description: "Historical payment patterns" },
  ];

  const chartData = scoreHistory?.map(h => ({
    date: format(new Date(h.scoreDate), "MMM yyyy"),
    score: h.overallScore || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Credit Passport
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Your comprehensive creditworthiness and bankability assessment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPDF} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {isLoadingScore ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-8">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : creditScore ? (
        <>
          {/* Hero Section - Overall Score */}
          <Card>
            <CardContent className="p-8">
              <div className="grid gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center justify-center md:col-span-1">
                  <div className="relative">
                    <svg className="h-48 w-48 transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        className="text-gray-200 dark:text-gray-800"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${((creditScore.overallScore || 0) / 100) * 552.64} 552.64`}
                        className={getScoreColor(creditScore.overallScore || 0)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className={`text-5xl font-bold ${getScoreColor(creditScore.overallScore || 0)}`} data-testid="text-overall-score">
                          {creditScore.overallScore || 0}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">out of 100</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 flex flex-col justify-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`${gradeColors[creditScore.scoreGrade || "F"]} text-white text-xl px-4 py-1`} data-testid="badge-score-grade">
                        {creditScore.scoreGrade}
                      </Badge>
                      <Badge className={`${eligibilityColors[creditScore.loanEligibility || "not_eligible"]} text-white px-4 py-1`} data-testid="badge-loan-eligibility">
                        {creditScore.loanEligibility?.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Your Credit Standing
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last updated: {format(new Date(creditScore.scoreDate), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {creditScore.liquidityScore || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Liquidity</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {creditScore.profitabilityScore || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Profitability</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {creditScore.cashFlowScore || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Cash Flow</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Trend Chart */}
          {!isLoadingHistory && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Score Trend</CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  Last 12 months performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
                    <XAxis dataKey="date" className="text-xs text-gray-500 dark:text-gray-400" />
                    <YAxis domain={[0, 100]} className="text-xs text-gray-500 dark:text-gray-400" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.375rem",
                      }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Component Scores */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Component Scores</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {componentScores.map((component) => (
                <Card key={component.name}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white">{component.name}</CardTitle>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-gray-500 dark:text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">{component.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className={`text-3xl font-bold ${getScoreColor(component.score)}`} data-testid={`score-${component.name.toLowerCase().replace(/\s+/g, "-")}`}>
                        {component.score}
                      </div>
                      <Progress value={component.score} className={getProgressColor(component.score)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Blocking Factors & Recommendations */}
          {creditScore.blockingFactors && Array.isArray(creditScore.blockingFactors) && (creditScore.blockingFactors as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Blocking Factors</CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  Key issues affecting your credit score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(creditScore.blockingFactors as any[]).slice(0, 5).map((factor: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">{factor.metric}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{factor.explanation}</p>
                        {factor.gap && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Gap: <span className="font-medium">{factor.gap}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" data-testid={`button-ai-help-${idx}`}>
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Get AI Help
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {creditScore.recommendations && Array.isArray(creditScore.recommendations) && (creditScore.recommendations as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Recommendations</CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  Actionable steps to improve your score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(creditScore.recommendations as any[]).map((rec: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <p className="text-sm text-gray-900 dark:text-white">{typeof rec === 'string' ? rec : rec.action}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Credit Passport Available
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              Your credit passport is being calculated. Please check back soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
