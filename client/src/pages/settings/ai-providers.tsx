import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Input } from "@/shared/components/ui/input";
import { Loader2, AlertCircle, CheckCircle2, DollarSign, Link as LinkIcon, Copy } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import type { AiProviderConsent } from "@shared/schema";
import { useState, useEffect } from "react";

const PROVIDER_INFO = {
  openai: {
    name: "OpenAI",
    description: "GPT-4o for advanced reasoning, vision, and chat capabilities",
    models: ["gpt-4o", "gpt-4o-mini", "Whisper (voice)", "TTS (voice output)"],
    pricingModel: "Pay-as-you-go",
    estimatedCost: "Variable based on usage",
    authMethod: "api_key",
  },
  kimi: {
    name: "Kimi AI",
    description: "High-quality Chinese LLM with reasoning capabilities",
    models: ["Kimi v2", "Kimi Plus"],
    pricingModel: "FREE tier available",
    estimatedCost: "$0/month (free tier)",
    authMethod: "none",
  },
  qwen: {
    name: "Qwen (Alibaba)",
    description: "Advanced open-source models from Alibaba",
    models: ["Qwen Max", "Qwen Plus", "Qwen Turbo"],
    pricingModel: "FREE tier available",
    estimatedCost: "$0/month (free tier)",
    authMethod: "api_key",
  },
  deepseek: {
    name: "DeepSeek",
    description: "Efficient and cost-effective reasoning model",
    models: ["DeepSeek Chat", "DeepSeek Coder"],
    pricingModel: "FREE tier available",
    estimatedCost: "$0/month (free tier)",
    authMethod: "api_key",
  },
};

export default function AIProvidersPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [credentialStatus, setCredentialStatus] = useState<Record<string, any>>({});

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ["/api/ai-consent/all"],
    queryFn: async () => {
      const response = await fetch("/api/ai-consent/all");
      if (!response.ok) throw new Error("Failed to fetch AI consents");
      return response.json();
    },
  });

  const { data: stats = {} } = useQuery({
    queryKey: ["/api/ai-consent/stats"],
    queryFn: async () => {
      const response = await fetch("/api/ai-consent/stats");
      if (!response.ok) throw new Error("Failed to fetch usage stats");
      return response.json();
    },
  });

  // Load credential status for all providers
  useQuery({
    queryKey: ["/api/mcp/credentials/status"],
    queryFn: async () => {
      const statuses: Record<string, any> = {};
      for (const key of Object.keys(PROVIDER_INFO)) {
        try {
          const response = await fetch(`/api/mcp/credentials/status?provider=${key}`);
          if (response.ok) {
            statuses[key] = await response.json();
          }
        } catch (error) {
          console.error(`Failed to fetch status for ${key}:`, error);
        }
      }
      setCredentialStatus(statuses);
      return statuses;
    },
  });

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const success = params.get("success");
    const error = params.get("error");

    if (connected && success) {
      toast({
        title: "Connected!",
        description: `${PROVIDER_INFO[connected as keyof typeof PROVIDER_INFO]?.name} has been connected successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/credentials/status"] });
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (error) {
      toast({
        title: "Connection Failed",
        description: decodeURIComponent(error),
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const updateConsentMutation = useMutation({
    mutationFn: async ({
      provider,
      consentGiven,
    }: {
      provider: string;
      consentGiven: boolean;
    }) => {
      return apiRequest("PATCH", "/api/ai-consent/update", {
        provider,
        consentGiven,
      });
    },
    onSuccess: (_, { provider, consentGiven }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-consent/all"] });
      toast({
        title: consentGiven ? "Consent Given" : "Consent Revoked",
        description: `${PROVIDER_INFO[provider as keyof typeof PROVIDER_INFO]?.name} is now ${consentGiven ? "enabled" : "disabled"}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update consent",
        variant: "destructive",
      });
    },
  });

  const connectOAuthMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await fetch(`/api/mcp/oidc/authorize?provider=${provider}`);
      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("Could not get authorization URL");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate OAuth",
        variant: "destructive",
      });
    },
  });

  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      return apiRequest("POST", "/api/mcp/credentials/save-api-key", {
        provider,
        apiKey,
      });
    },
    onSuccess: (_, { provider }) => {
      setApiKeys({ ...apiKeys, [provider]: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/mcp/credentials/status"] });
      toast({
        title: "Success",
        description: "API key saved securely",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save API key",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const consentMap = Object.fromEntries(
    consents.map((c: AiProviderConsent) => [c.provider, c])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Provider Settings</h1>
        <p className="text-muted-foreground mt-2">
          Connect to AI providers via OAuth or manual API keys. All credentials are encrypted and stored securely.
        </p>
      </div>

      <div className="grid gap-4">
        {Object.entries(PROVIDER_INFO).map(([key, info]) => {
          const consent = consentMap[key];
          const providerStats = stats[key];
          const status = credentialStatus[key];
          const isApiKeyProvider = info.authMethod === "api_key";
          const isConnected = status?.isConfigured;

          return (
            <Card key={key} data-testid={`card-provider-${key}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{info.name}</CardTitle>
                    <CardDescription>{info.description}</CardDescription>
                  </div>
                  <Switch
                    checked={consent?.consentGiven ?? false}
                    onCheckedChange={(checked) =>
                      updateConsentMutation.mutate({
                        provider: key,
                        consentGiven: checked,
                      })
                    }
                    disabled={updateConsentMutation.isPending}
                    data-testid={`switch-consent-${key}`}
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Available Models</h4>
                    <div className="space-y-1">
                      {info.models.map((model) => (
                        <div key={model} className="text-sm text-muted-foreground">
                          • {model}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Pricing</h4>
                    <Badge variant="secondary" className="mb-2">
                      {info.pricingModel}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{info.estimatedCost}</p>
                  </div>
                </div>

                {/* Authentication Section */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Authentication</h4>
                    {isConnected && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">Connected</span>
                      </div>
                    )}
                  </div>

                  {isApiKeyProvider ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Enter API key..."
                          value={apiKeys[key] || ""}
                          onChange={(e) =>
                            setApiKeys({ ...apiKeys, [key]: e.target.value })
                          }
                          data-testid={`input-api-key-${key}`}
                        />
                        <Button
                          onClick={() =>
                            saveApiKeyMutation.mutate({
                              provider: key,
                              apiKey: apiKeys[key] || "",
                            })
                          }
                          disabled={
                            !apiKeys[key] || saveApiKeyMutation.isPending
                          }
                          data-testid={`button-save-key-${key}`}
                        >
                          {saveApiKeyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your API key is encrypted and never stored in plain text.
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={() => connectOAuthMutation.mutate(key)}
                      disabled={connectOAuthMutation.isPending}
                      className="w-full"
                      data-testid={`button-connect-oauth-${key}`}
                    >
                      {connectOAuthMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <LinkIcon className="w-4 h-4 mr-2" />
                      )}
                      {isConnected ? "Reconnect" : "Click to Connect"}
                    </Button>
                  )}
                </div>

                {/* Stats Section */}
                {consent && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <div className="flex items-center gap-2">
                        {consent.consentGiven ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-green-600">Enabled</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-yellow-600">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>

                    {providerStats && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Tokens Used:</span>
                          <span className="font-medium">
                            {(providerStats.totalTokens || 0).toLocaleString()}
                          </span>
                        </div>

                        {parseFloat(providerStats.totalCost || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Total cost: ${parseFloat(providerStats.totalCost).toFixed(4)}
                            </span>
                          </div>
                        )}

                        {consent.lastUsedAt && (
                          <div className="text-xs text-muted-foreground">
                            Last used: {new Date(consent.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Vendor-Agnostic AI:</strong> All AI provider consents and credentials are tracked for audit compliance. You control which AI providers your organization uses. Switching providers doesn't lose your data. All credentials are encrypted with AES-256-GCM.
        </p>
      </div>
    </div>
  );
}
