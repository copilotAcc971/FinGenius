import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { 
  Building2, 
  FileText, 
  CreditCard, 
  Shield, 
  TrendingUp,
  Globe,
  Zap,
  Lock,
  CheckCircle,
  BarChart3,
  Database,
  Workflow,
  Users,
  Landmark,
  Receipt,
  Package,
  FolderKanban,
  Mail,
  DollarSign,
  Brain,
  BookOpen,
  ArrowRight
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground">
              <Building2 className="h-5 w-5 text-background" />
            </div>
            <span className="text-xl font-semibold text-foreground">Copilot Accountant</span>
          </div>
          <Button variant="outline" asChild data-testid="button-login">
            <a href="/api/login">Log In</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-32">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-foreground">
                AI-Powered Accounting
                <br />
                Built for Modern Business
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                Enterprise-grade multi-tenant accounting with AI document extraction, Open Banking, 
                IFRS compliance, and automated workflows. Everything you need to manage financial operations at scale.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild data-testid="button-get-started" className="text-base">
                  <a href="/api/login">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-view-demo" className="text-base">
                  <a href="/api/login">View Demo</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-foreground">
                Complete Financial Management Platform
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                100% Zoho Books feature parity with advanced capabilities for UAE and international markets
              </p>
            </div>

            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {/* AI Document Extraction */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-ai">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Brain className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">AI Document Extraction</CardTitle>
                  <CardDescription className="text-base">
                    GPT-5 powered extraction of line items, tax details, and account mappings from invoices and bills with high accuracy
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Open Banking */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-banking">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Landmark className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Open Banking Integration</CardTitle>
                  <CardDescription className="text-base">
                    Lean Technologies integration for UAE market with automated transaction sync, bank reconciliation, and payment initiation
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* IFRS Compliance */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-ifrs">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <BookOpen className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">IFRS Compliant</CardTitle>
                  <CardDescription className="text-base">
                    Full compliance with IAS 1, 2, 7, and 21 standards for presentation, inventory, cash flows, and foreign currency translation
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Multi-Currency */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-currency">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Globe className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Multi-Currency Support</CardTitle>
                  <CardDescription className="text-base">
                    Automated daily exchange rate updates with CBUAE, ECB, FED, BOE support and complete foreign currency transaction handling
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Enterprise RBAC */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-rbac">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Shield className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Enterprise-Grade RBAC</CardTitle>
                  <CardDescription className="text-base">
                    180 granular permissions with default and custom roles, multi-role support, and complete route/UI protection
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Automated Workflows */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-workflows">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Workflow className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Approval Workflows</CardTitle>
                  <CardDescription className="text-base">
                    Multi-stage routing for journal entries with workflow matching, multi-approver support, and automated posting
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Automated Journal Entries */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-journal">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <FileText className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Automated Accounting</CardTitle>
                  <CardDescription className="text-base">
                    Double-entry bookkeeping with atomic transactions, historical balance tracking, and cascade recalculation for all documents
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Financial Reports */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-reports">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <BarChart3 className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Comprehensive Reports</CardTitle>
                  <CardDescription className="text-base">
                    P&L, Balance Sheet, Cash Flow, Trial Balance with comparison periods, variance analysis, and scheduled email delivery
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Inventory Management */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-inventory">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Package className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Inventory Management</CardTitle>
                  <CardDescription className="text-base">
                    FIFO and Weighted Average costing, stock adjustments, composite items, and IAS 2 compliant valuation reports
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Project Tracking */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-projects">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <FolderKanban className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Project Tracking</CardTitle>
                  <CardDescription className="text-base">
                    Full project management with time tracking, budgets, tasks, and profitability reports for service-based businesses
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Employee Expenses */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-expenses">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <Receipt className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Expense Management</CardTitle>
                  <CardDescription className="text-base">
                    Employee expense submission with receipt upload, approval workflows, reimbursement processing, and automatic journal entries
                  </CardDescription>
                </CardHeader>
              </Card>

              {/* Payment Processing */}
              <Card className="hover-elevate border border-border" data-testid="card-feature-payments">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mb-4">
                    <CreditCard className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-xl">Payment Processing</CardTitle>
                  <CardDescription className="text-base">
                    Integrated Stripe payment processing for customer invoices with automatic reconciliation and payment tracking
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Multi-Tenant & Scale */}
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                  Built for Multi-Tenant Operations
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Manage multiple businesses or clients with complete data isolation, instant workspace switching, 
                  and tenant-scoped permissions. Built from the ground up with security and scalability in mind.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-base text-muted-foreground">Complete data isolation with server-side tenant enforcement</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-base text-muted-foreground">Independent role and permission management per workspace</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-base text-muted-foreground">Instant workspace switching with zero cross-contamination</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-base text-muted-foreground">Scalable architecture supporting thousands of tenants</span>
                  </li>
                </ul>
              </div>
              <div className="lg:order-first">
                <Card className="border-2 border-border p-8">
                  <CardHeader className="p-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-foreground mb-6">
                      <Database className="h-8 w-8 text-background" />
                    </div>
                    <CardTitle className="text-2xl mb-4">Enterprise Architecture</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      Verified-tenant pattern with server-side enforcement, optimistic UI for instant feedback, 
                      and production-ready cache management for maximum performance.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Compliance & Security */}
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-foreground">
                Compliance & Security First
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Built with financial integrity, regulatory compliance, and data security as core principles
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border border-border text-center" data-testid="card-compliance-tax">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mx-auto mb-4">
                    <CheckCircle className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-lg">Tax Compliance</CardTitle>
                  <CardDescription className="text-sm">
                    VAT/GST ready with tax registration enforcement and multi-jurisdiction support
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border text-center" data-testid="card-compliance-ifrs">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mx-auto mb-4">
                    <BookOpen className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-lg">IFRS Standards</CardTitle>
                  <CardDescription className="text-sm">
                    Full compliance with IAS 1, 2, 7, and 21 for international financial reporting
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border text-center" data-testid="card-compliance-audit">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mx-auto mb-4">
                    <FileText className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-lg">Audit Trails</CardTitle>
                  <CardDescription className="text-sm">
                    Comprehensive change tracking for all critical entities with immutable logs
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border text-center" data-testid="card-compliance-security">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground mx-auto mb-4">
                    <Lock className="h-6 w-6 text-background" />
                  </div>
                  <CardTitle className="text-lg">Bank-Level Security</CardTitle>
                  <CardDescription className="text-sm">
                    AES-256 encryption, HMAC verification, and multi-tenant data isolation
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Integration Ecosystem */}
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-foreground">
                Seamless Integrations
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Connect with the tools and services you already use
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border border-border" data-testid="card-integration-banking">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Landmark className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">Lean Technologies</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Open Banking for UAE with OAuth2, transaction sync, and payment initiation
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border" data-testid="card-integration-payment">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">Stripe</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Payment processing with automatic reconciliation and webhook handling
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border" data-testid="card-integration-ai">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Brain className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">OpenAI GPT-5</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    AI-powered document extraction and intelligent bank reconciliation
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border" data-testid="card-integration-email">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">Microsoft Outlook</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Email invoices and scheduled report delivery via Microsoft Graph API
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border" data-testid="card-integration-fx">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">Central Bank FX</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Daily exchange rates from CBUAE, ECB, FED, BOE, and SAMA
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border border-border" data-testid="card-integration-auth">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-foreground" />
                    <CardTitle className="text-base">Replit Auth</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    Secure authentication with Google SSO and session management
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                Ready to Transform Your Accounting?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Join businesses worldwide using AI-powered accounting to streamline operations, 
                ensure compliance, and gain real-time financial insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild data-testid="button-start-now" className="text-base">
                  <a href="/api/login">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild data-testid="button-schedule-demo" className="text-base">
                  <a href="/api/login">Schedule Demo</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                No credit card required • Full features included • Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground">
                  <Building2 className="h-5 w-5 text-background" />
                </div>
                <span className="text-lg font-semibold text-foreground">Copilot Accountant</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered accounting for modern business. Built for scale, compliance, and efficiency.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Security</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Compliance</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Guides</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/api/login" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="/api/login" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                © 2025 Copilot Accountant. All rights reserved.
              </p>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <a href="/api/login" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="/api/login" className="hover:text-foreground transition-colors">Terms of Service</a>
                <a href="/api/login" className="hover:text-foreground transition-colors">Cookie Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
