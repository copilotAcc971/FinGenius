import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected');
  }
  return accessToken;
}

async function getUncachableOutlookClient() {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export interface SendInvoiceEmailParams {
  to: string;
  subject: string;
  body: string;
  invoiceNumber: string;
  pdfAttachment?: {
    filename: string;
    content: Buffer;
  };
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<void> {
  const client = await getUncachableOutlookClient();
  
  const message: any = {
    subject: params.subject,
    body: {
      contentType: 'HTML',
      content: params.body
    },
    toRecipients: [
      {
        emailAddress: {
          address: params.to
        }
      }
    ]
  };

  // Add PDF attachment if provided
  if (params.pdfAttachment) {
    message.attachments = [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: params.pdfAttachment.filename,
        contentType: 'application/pdf',
        contentBytes: params.pdfAttachment.content.toString('base64')
      }
    ];
  }

  await client.api('/me/sendMail').post({
    message,
    saveToSentItems: true
  });
}
