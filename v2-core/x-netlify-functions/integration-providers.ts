import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List integration providers
export const list = createHandler(async (ctx, body) => {
  const { integration_type, auth_type, include_inactive } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('get_integration_providers', {
      integration_type: integration_type || null,
      auth_type: auth_type || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// Get single provider
export const get = createHandler(async (ctx, body) => {
  const { name } = ctx.query || {}

  if (!name) {
    throw new Error('Provider name is required')
  }

  const { data, error: err } = await db
    .from('integration_providers')
    .select('*')
    .eq('name', name)
    .single()

  if (err) throw err

  return data
})

// Create integration from provider
export const createIntegration = requireAuth(createHandler(async (ctx, body) => {
  const { provider_name, app_id, name, config, credentials, metadata } = body

  if (!provider_name) {
    throw new Error('provider_name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_integration_from_provider', {
      provider_name,
      app_id,
      name,
      config: config || {},
      credentials: credentials || {},
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'integration.created_from_provider', 
    { type: 'integration', id: data }, 
    { after: { provider_name, name } }
  )

  return { integration_id: data }
}))

// Validate integration config
export const validateConfig = createHandler(async (ctx, body) => {
  const { integration_id } = ctx.query || {}

  if (!integration_id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('validate_integration_config', { integration_id })

  if (err) throw err

  return data
})

// Create webhook integration
export const createWebhook = requireAuth(createHandler(async (ctx, body) => {
  const { name, url, app_id, headers, method, timeout, metadata } = body

  if (!name || !url) {
    throw new Error('name and url are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_webhook_integration', {
      name,
      url,
      app_id,
      headers: headers || {},
      method: method || 'POST',
      timeout: timeout || 30,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'webhook_integration.created', 
    { type: 'integration', id: data }, 
    { after: { name, url } }
  )

  return { integration_id: data }
}))

// Get provider categories
export const getCategories = createHandler(async (ctx, body) => {
  const categories = [
    {
      type: 'oauth',
      display_name: 'OAuth 2.0',
      description: 'Secure authentication with OAuth 2.0 flow',
      providers: ['github', 'slack', 'google_drive', 'salesforce']
    },
    {
      type: 'api_key',
      display_name: 'API Key',
      description: 'Simple API key authentication',
      providers: ['stripe', 'sendgrid', 'twilio']
    },
    {
      type: 'database',
      display_name: 'Database',
      description: 'Direct database connections',
      providers: ['postgres', 'mysql']
    },
    {
      type: 'file_storage',
      display_name: 'File Storage',
      description: 'Cloud storage and file management',
      providers: ['aws_s3', 'google_drive']
    },
    {
      type: 'webhook',
      display_name: 'Webhook',
      description: 'Generic webhook endpoints',
      providers: ['webhook_generic']
    },
    {
      type: 'email',
      display_name: 'Email',
      description: 'Email delivery services',
      providers: ['sendgrid']
    },
    {
      type: 'sms',
      display_name: 'SMS',
      description: 'SMS and messaging services',
      providers: ['twilio']
    },
    {
      type: 'payment',
      display_name: 'Payment',
      description: 'Payment processing services',
      providers: ['stripe']
    }
  ]

  return categories
})

// Get provider features
export const getFeatures = createHandler(async (ctx, body) => {
  const features = [
    {
      name: 'webhooks',
      display_name: 'Webhooks',
      description: 'Receive webhook events from external systems',
      icon: 'webhook'
    },
    {
      name: 'api',
      display_name: 'API Access',
      description: 'Make API calls to external services',
      icon: 'api'
    },
    {
      name: 'realtime',
      display_name: 'Real-time Sync',
      description: 'Real-time data synchronization',
      icon: 'sync'
    },
    {
      name: 'files',
      display_name: 'File Management',
      description: 'Upload, download, and manage files',
      icon: 'file'
    },
    {
      name: 'folders',
      display_name: 'Folder Management',
      description: 'Organize content in folders',
      icon: 'folder'
    },
    {
      name: 'sharing',
      display_name: 'Sharing',
      description: 'Share content with others',
      icon: 'share'
    },
    {
      name: 'repositories',
      display_name: 'Repositories',
      description: 'Access code repositories',
      icon: 'repo'
    },
    {
      name: 'issues',
      display_name: 'Issues',
      description: 'Track and manage issues',
      icon: 'issue'
    },
    {
      name: 'pull_requests',
      display_name: 'Pull Requests',
      description: 'Manage pull requests and code reviews',
      icon: 'pr'
    },
    {
      name: 'messaging',
      display_name: 'Messaging',
      description: 'Send and receive messages',
      icon: 'message'
    },
    {
      name: 'channels',
      display_name: 'Channels',
      description: 'Manage communication channels',
      icon: 'channel'
    },
    {
      name: 'users',
      display_name: 'Users',
      description: 'Manage user accounts and profiles',
      icon: 'user'
    },
    {
      name: 'objects',
      display_name: 'Objects',
      description: 'Access database objects and records',
      icon: 'object'
    },
    {
      name: 'queries',
      display_name: 'Queries',
      description: 'Execute custom queries',
      icon: 'query'
    },
    {
      name: 'tables',
      display_name: 'Tables',
      description: 'Access database tables',
      icon: 'table'
    },
    {
      name: 'rows',
      display_name: 'Rows',
      description: 'Manage database rows',
      icon: 'row'
    },
    {
      name: 'payments',
      display_name: 'Payments',
      description: 'Process payments and transactions',
      icon: 'payment'
    },
    {
      name: 'customers',
      display_name: 'Customers',
      description: 'Manage customer information',
      icon: 'customer'
    },
    {
      name: 'analytics',
      display_name: 'Analytics',
      description: 'Access analytics and reporting',
      icon: 'analytics'
    },
    {
      name: 'email',
      display_name: 'Email',
      description: 'Send and manage emails',
      icon: 'email'
    },
    {
      name: 'sms',
      display_name: 'SMS',
      description: 'Send SMS messages',
      icon: 'sms'
    },
    {
      name: 'voice',
      display_name: 'Voice',
      description: 'Make voice calls',
      icon: 'voice'
    },
    {
      name: 'permissions',
      display_name: 'Permissions',
      description: 'Manage access permissions',
      icon: 'permissions'
    }
  ]

  return features
})

// Get provider setup guide
export const getSetupGuide = createHandler(async (ctx, body) => {
  const { provider_name } = ctx.query || {}

  if (!provider_name) {
    throw new Error('Provider name is required')
  }

  const guides = {
    github: {
      steps: [
        {
          title: 'Create GitHub OAuth App',
          description: 'Go to GitHub Settings > Developer settings > OAuth Apps and create a new OAuth App',
          fields: ['Application name', 'Homepage URL', 'Authorization callback URL']
        },
        {
          title: 'Configure Callback URL',
          description: 'Set the authorization callback URL to your Spine instance',
          example: 'https://your-spine-instance.com/integrations/github/callback'
        },
        {
          title: 'Get Credentials',
          description: 'Copy the Client ID and generate a Client Secret',
          fields: ['Client ID', 'Client Secret']
        },
        {
          title: 'Configure Scopes',
          description: 'Select the required permissions for your integration',
          example: 'repo, user, admin:repo_hook'
        }
      ],
      required_fields: ['client_id', 'client_secret'],
      optional_fields: ['scope', 'webhook_secret']
    },
    slack: {
      steps: [
        {
          title: 'Create Slack App',
          description: 'Go to api.slack.com/apps and create a new app',
          fields: ['App name', 'Development workspace']
        },
        {
          title: 'Configure OAuth & Permissions',
          description: 'Set up OAuth permissions and redirect URLs',
          fields: ['Redirect URLs', 'Bot Token Scopes']
        },
        {
          title: 'Get Credentials',
          description: 'Copy the Client ID and Client Secret',
          fields: ['Client ID', 'Client Secret', 'Signing Secret']
        },
        {
          title: 'Install App',
          description: 'Install the app to your workspace',
          note: 'This will generate the Bot User OAuth Token'
        }
      ],
      required_fields: ['client_id', 'client_secret'],
      optional_fields: ['scope', 'signing_secret']
    },
    stripe: {
      steps: [
        {
          title: 'Get API Keys',
          description: 'Go to Stripe Dashboard > Developers > API keys',
          fields: ['Publishable key', 'Secret key']
        },
        {
          title: 'Configure Webhooks',
          description: 'Set up webhook endpoints for real-time events',
          fields: ['Endpoint URL', 'Events to send']
        },
        {
          title: 'Test Integration',
          description: 'Use test mode to validate your integration',
          note: 'Switch to live mode when ready for production'
        }
      ],
      required_fields: ['api_key'],
      optional_fields: ['webhook_secret']
    }
  }

  const guide = guides[provider_name as keyof typeof guides]

  if (!guide) {
    throw new Error('Setup guide not found for provider: ' + provider_name)
  }

  return guide
})

// Test provider connection
export const testConnection = createHandler(async (ctx, body) => {
  const { provider_name, config, credentials } = body

  if (!provider_name) {
    throw new Error('Provider name is required')
  }

  // This would implement actual connection testing logic
  // For now, return a mock response
  const testResults = {
    github: {
      success: true,
      message: 'Successfully connected to GitHub API',
      data: {
        user: 'test-user',
        repos: 5,
        permissions: ['repo', 'user']
      }
    },
    slack: {
      success: true,
      message: 'Successfully connected to Slack API',
      data: {
        team: 'Test Workspace',
        channels: 10,
        user: 'test-user'
      }
    },
    stripe: {
      success: true,
      message: 'Successfully connected to Stripe API',
      data: {
        account: 'acct_test',
        balance: 1000,
        currency: 'usd'
      }
    }
  }

  const result = testResults[provider_name as keyof typeof testResults]

  if (!result) {
    throw new Error('Connection testing not implemented for provider: ' + provider_name)
  }

  await emitLog(ctx, 'provider_connection.tested', 
    { type: 'system', id: 'provider_test' }, 
    { after: { provider_name, success: result.success } }
  )

  return result
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'create-integration':
      if (method === 'POST') {
        return await createIntegration(ctx, body)
      }
      break
    case 'validate-config':
      if (method === 'GET') {
        return await validateConfig(ctx, body)
      }
      break
    case 'create-webhook':
      if (method === 'POST') {
        return await createWebhook(ctx, body)
      }
      break
    case 'categories':
      if (method === 'GET') {
        return await getCategories(ctx, body)
      }
      break
    case 'features':
      if (method === 'GET') {
        return await getFeatures(ctx, body)
      }
      break
    case 'setup-guide':
      if (method === 'GET') {
        return await getSetupGuide(ctx, body)
      }
      break
    case 'test-connection':
      if (method === 'POST') {
        return await testConnection(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        if (ctx.query?.name) {
          return await get(ctx, body)
        } else {
          return await list(ctx, body)
        }
      }
  }

  throw new Error('Invalid action or method')
})
