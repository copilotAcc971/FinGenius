import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Building2, FileText, CreditCard, Zap, Shield, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">AccounBooks</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Log In</a>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            AI-Powered Accounting Made Simple
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Multi-tenant accounting software with AI document extraction and seamless vendor payments via Stripe Connect
          </p>
          <Button size="lg" asChild data-testid="button-get-started">
            <a href="/api/login">Get Started Free</a>
          </Button>
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-16">
          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>AI Document Extraction</CardTitle>
              <CardDescription>
                Upload invoices, bills, and receipts - let AI automatically extract and populate all data
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Vendor Payments</CardTitle>
              <CardDescription>
                Pay vendors directly through Stripe Connect with scheduled and batch payment options
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Complete Accounting</CardTitle>
              <CardDescription>
                Invoices, bills, expenses, and comprehensive financial reports all in one place
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multi-Tenant</CardTitle>
              <CardDescription>
                Manage multiple businesses or clients with complete data isolation and workspace switching
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure & Reliable</CardTitle>
              <CardDescription>
                Bank-level security with encrypted data storage and secure Stripe payment processing
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Financial Insights</CardTitle>
              <CardDescription>
                Real-time P&L, Balance Sheet, and cash flow reports to track business health
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="text-center bg-primary/5 rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your accounting?</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Join thousands of businesses using AI-powered accounting
          </p>
          <Button size="lg" asChild data-testid="button-start-now">
            <a href="/api/login">Start Now</a>
          </Button>
        </section>
      </main>

      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 AccounBooks. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
