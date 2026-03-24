# Agentic IDE Integration Patterns

This guide provides comprehensive patterns and examples for integrating agentic IDEs with the Spine app installation system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Integration Patterns](#integration-patterns)
3. [Error Handling](#error-handling)
4. [Advanced Workflows](#advanced-workflows)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)
7. [Example Implementations](#example-implementations)

---

## Quick Start

### Basic Integration

```typescript
import { validateInstructionFile, executeInstallation } from './app-install-cli'

async function installApp(instructionFile: string, accountId: string) {
  // Step 1: Validate instruction file
  const isValid = await validateInstructionFile(instructionFile)
  if (!isValid) {
    throw new Error('Invalid instruction file')
  }

  // Step 2: Execute installation
  const result = await executeInstallation(instructionFile, {
    accountId,
    dryRun: false
  })

  return result
}
```

### Installation with Variables

```typescript
const options = {
  accountId: 'target-account-id',
  variables: {
    TARGET_ACCOUNT_ID: 'target-account-id',
    CUSTOM_VAR: 'custom-value'
  },
  dryRun: false
}

const result = await executeInstallation('app.yaml', options)
```

---

## Integration Patterns

### Pattern 1: Sequential Installation

Install apps in a specific order with dependency management.

```typescript
class SequentialInstaller {
  private installedApps = new Map<string, any>()
  
  async installApps(appConfigs: Array<{ file: string; dependencies?: string[] }>) {
    const sortedApps = this.topologicalSort(appConfigs)
    
    for (const app of sortedApps) {
      console.log(`Installing ${app.file}...`)
      
      const result = await this.installSingleApp(app.file)
      this.installedApps.set(app.file, result)
      
      console.log(`✅ ${app.file} installed successfully`)
    }
    
    return this.installedApps
  }
  
  private async installSingleApp(file: string) {
    const isValid = await validateInstructionFile(file)
    if (!isValid) {
      throw new Error(`Invalid instruction file: ${file}`)
    }
    
    return await executeInstallation(file, {
      accountId: process.env.TARGET_ACCOUNT_ID,
      dryRun: false
    })
  }
  
  private topologicalSort(apps: Array<{ file: string; dependencies?: string[] }>) {
    // Implement topological sort based on dependencies
    // This is a simplified example
    return apps.sort((a, b) => {
      if (!a.dependencies) return -1
      if (!b.dependencies) return 1
      return a.dependencies.length - b.dependencies.length
    })
  }
}
```

### Pattern 2: Parallel Installation

Install multiple apps concurrently when dependencies allow.

```typescript
class ParallelInstaller {
  async installAppsParallel(appConfigs: Array<{ file: string; concurrencyGroup?: string }>) {
    // Group apps by concurrency group
    const groups = this.groupByConcurrency(appConfigs)
    
    for (const [groupName, apps] of groups) {
      console.log(`Installing group ${groupName} with ${apps.length} apps...`)
      
      const promises = apps.map(app => this.installSingleApp(app.file))
      const results = await Promise.allSettled(promises)
      
      // Handle results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ ${apps[index].file} installed`)
        } else {
          console.error(`❌ ${apps[index].file} failed:`, result.reason)
        }
      })
    }
  }
  
  private groupByConcurrency(apps: Array<{ file: string; concurrencyGroup?: string }>) {
    const groups = new Map<string, Array<{ file: string }>>()
    
    apps.forEach(app => {
      const group = app.concurrencyGroup || 'default'
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(app)
    })
    
    return groups
  }
}
```

### Pattern 3: Conditional Installation

Install apps based on conditions and environment.

```typescript
class ConditionalInstaller {
  async installWithConditions(appConfigs: Array<{
    file: string
    condition?: () => Promise<boolean>
    environment?: string[]
  }>) {
    const results = []
    
    for (const config of appConfigs) {
      // Check environment condition
      if (config.environment && !config.environment.includes(process.env.NODE_ENV)) {
        console.log(`⏭️  Skipping ${config.file} (environment mismatch)`)
        continue
      }
      
      // Check custom condition
      if (config.condition) {
        const shouldInstall = await config.condition()
        if (!shouldInstall) {
          console.log(`⏭️  Skipping ${config.file} (condition not met)`)
          continue
        }
      }
      
      console.log(`🔧 Installing ${config.file}...`)
      const result = await this.installSingleApp(config.file)
      results.push(result)
    }
    
    return results
  }
  
  private async installSingleApp(file: string) {
    return await executeInstallation(file, {
      accountId: process.env.TARGET_ACCOUNT_ID,
      dryRun: process.env.DRY_RUN === 'true'
    })
  }
}
```

### Pattern 4: Rollback Installation

Install with automatic rollback on failure.

```typescript
class RollbackInstaller {
  private installationSteps: Array<{ step: string; rollback?: () => Promise<void> }> = []
  
  async installWithRollback(instructionFile: string) {
    try {
      const result = await this.executeWithTracking(instructionFile)
      return result
    } catch (error) {
      console.error('Installation failed, rolling back...')
      await this.rollback()
      throw error
    }
  }
  
  private async executeWithTracking(instructionFile: string) {
    // Parse instruction file to track steps
    const instructions = this.parseInstructions(instructionFile)
    
    // Track each step for potential rollback
    for (const step of instructions.steps) {
      this.installationSteps.push({
        step: step.name,
        rollback: step.rollback
      })
      
      await this.executeStep(step)
    }
  }
  
  private async rollback() {
    // Execute rollbacks in reverse order
    for (let i = this.installationSteps.length - 1; i >= 0; i--) {
      const step = this.installationSteps[i]
      if (step.rollback) {
        try {
          await step.rollback()
          console.log(`✅ Rolled back: ${step.step}`)
        } catch (error) {
          console.error(`❌ Rollback failed for ${step.step}:`, error)
        }
      }
    }
  }
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
class RobustInstaller {
  async installWithErrorHandling(instructionFile: string, options: any) {
    try {
      // Pre-installation checks
      await this.preInstallationChecks(instructionFile, options)
      
      // Execute installation
      const result = await executeInstallation(instructionFile, options)
      
      // Post-installation verification
      await this.postInstallationVerification(result)
      
      return result
    } catch (error) {
      const errorInfo = this.analyzeError(error)
      await this.handleError(errorInfo)
      throw error
    }
  }
  
  private async preInstallationChecks(file: string, options: any) {
    // Validate file exists
    if (!existsSync(file)) {
      throw new Error(`Instruction file not found: ${file}`)
    }
    
    // Validate account exists
    const account = await this.getAccount(options.accountId)
    if (!account) {
      throw new Error(`Account not found: ${options.accountId}`)
    }
    
    // Check permissions
    const hasPermission = await this.checkInstallPermission(options.accountId)
    if (!hasPermission) {
      throw new Error('Insufficient permissions for installation')
    }
  }
  
  private analyzeError(error: any) {
    return {
      type: this.getErrorType(error),
      message: error.message,
      recoverable: this.isRecoverableError(error),
      suggestions: this.getErrorSuggestions(error)
    }
  }
  
  private async handleError(errorInfo: any) {
    console.error('Installation error:', errorInfo)
    
    // Log error for monitoring
    await this.logError(errorInfo)
    
    // Send notification if critical
    if (errorInfo.type === 'critical') {
      await this.sendErrorNotification(errorInfo)
    }
    
    // Attempt recovery if possible
    if (errorInfo.recoverable) {
      await this.attemptRecovery(errorInfo)
    }
  }
}
```

### Retry Pattern

```typescript
class RetryInstaller {
  async installWithRetry(instructionFile: string, options: any, maxRetries = 3) {
    let lastError: any
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`)
        return await executeInstallation(instructionFile, options)
      } catch (error) {
        lastError = error
        
        if (attempt === maxRetries) {
          console.error(`Failed after ${maxRetries} attempts`)
          break
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.error('Non-retryable error, giving up')
          throw error
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`Retrying in ${delay}ms...`)
        await this.sleep(delay)
      }
    }
    
    throw lastError
  }
  
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED'
    ]
    
    return retryableErrors.some(code => error.code === code)
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

---

## Advanced Workflows

### Workflow 1: Environment-Specific Installation

```typescript
class EnvironmentInstaller {
  async installForEnvironment(instructionFile: string, environment: string) {
    const config = this.getEnvironmentConfig(environment)
    
    // Load environment-specific variables
    const variables = await this.loadEnvironmentVariables(environment)
    
    // Modify instructions for environment
    const modifiedInstructions = await this.modifyInstructionsForEnvironment(
      instructionFile,
      environment,
      variables
    )
    
    // Execute with environment-specific options
    return await executeInstallation(modifiedInstructions, {
      accountId: config.accountId,
      variables,
      dryRun: config.dryRun
    })
  }
  
  private getEnvironmentConfig(environment: string) {
    const configs = {
      development: {
        accountId: process.env.DEV_ACCOUNT_ID,
        dryRun: true
      },
      staging: {
        accountId: process.env.STAGING_ACCOUNT_ID,
        dryRun: false
      },
      production: {
        accountId: process.env.PROD_ACCOUNT_ID,
        dryRun: false
      }
    }
    
    return configs[environment] || configs.development
  }
}
```

### Workflow 2: Template-Based Installation

```typescript
class TemplateInstaller {
  async installFromTemplate(templateName: string, customizations: any) {
    // Load template
    const template = await this.loadTemplate(templateName)
    
    // Apply customizations
    const customizedInstructions = this.applyCustomizations(template, customizations)
    
    // Validate customized instructions
    const isValid = await validateInstructionFile(customizedInstructions)
    if (!isValid) {
      throw new Error('Customized instructions are invalid')
    }
    
    // Execute installation
    return await executeInstallation(customizedInstructions, {
      accountId: customizations.accountId,
      variables: customizations.variables
    })
  }
  
  private applyCustomizations(template: any, customizations: any) {
    const result = { ...template }
    
    // Customize app name and slug
    if (customizations.appName) {
      result.app.name = customizations.appName
      result.app.slug = this.slugify(customizations.appName)
    }
    
    // Customize navigation items
    if (customizations.navigation) {
      result.installation.app_creation[0].nav_items = customizations.navigation
    }
    
    // Add custom migrations
    if (customizations.migrations) {
      result.installation.migrations.push(...customizations.migrations)
    }
    
    return result
  }
  
  private slugify(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
  }
}
```

### Workflow 3: Batch Installation

```typescript
class BatchInstaller {
  async installBatch(batchConfig: {
    apps: Array<{ file: string; priority?: number }>
    concurrency: number
    failurePolicy: 'stop' | 'continue' | 'retry'
  }) {
    // Sort by priority
    const sortedApps = batchConfig.apps.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    
    const results = []
    const errors = []
    
    // Process in batches
    for (let i = 0; i < sortedApps.length; i += batchConfig.concurrency) {
      const batch = sortedApps.slice(i, i + batchConfig.concurrency)
      
      const batchResults = await this.processBatch(batch, batchConfig.failurePolicy)
      
      results.push(...batchResults.successful)
      errors.push(...batchResults.failed)
      
      // Stop on first error if policy is 'stop'
      if (batchConfig.failurePolicy === 'stop' && batchResults.failed.length > 0) {
        console.log('Stopping due to errors')
        break
      }
    }
    
    return { results, errors }
  }
  
  private async processBatch(apps: Array<{ file: string }>, failurePolicy: string) {
    const promises = apps.map(app => this.installApp(app.file))
    const results = await Promise.allSettled(promises)
    
    const successful = []
    const failed = []
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push({
          file: apps[index].file,
          result: result.value
        })
      } else {
        failed.push({
          file: apps[index].file,
          error: result.reason
        })
        
        if (failurePolicy === 'retry') {
          // Implement retry logic here
        }
      }
    })
    
    return { successful, failed }
  }
}
```

---

## Best Practices

### 1. Validation Before Execution

```typescript
async function safeInstall(instructionFile: string, options: any) {
  // Always validate first
  const validation = await validateInstructionFile(instructionFile)
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
  }
  
  // Check dependencies
  await checkDependencies(instructionFile)
  
  // Verify permissions
  await verifyPermissions(options.accountId)
  
  // Then execute
  return await executeInstallation(instructionFile, options)
}
```

### 2. Progress Reporting

```typescript
class ProgressInstaller {
  async installWithProgress(instructionFile: string, options: any) {
    const progress = {
      total: 0,
      completed: 0,
      currentStep: '',
      errors: []
    }
    
    const progressCallback = (step: string, completed: number, total: number) => {
      progress.currentStep = step
      progress.completed = completed
      progress.total = total
      
      console.log(`Progress: ${completed}/${total} - ${step}`)
    }
    
    return await executeInstallation(instructionFile, {
      ...options,
      onProgress: progressCallback
    })
  }
}
```

### 3. Resource Cleanup

```typescript
class ResourceAwareInstaller {
  async installWithCleanup(instructionFile: string, options: any) {
    const resources = new Set<string>()
    
    try {
      const result = await executeInstallation(instructionFile, {
        ...options,
        onResourceCreated: (resourceId: string) => {
          resources.add(resourceId)
        }
      })
      
      return result
    } catch (error) {
      // Clean up created resources on failure
      await this.cleanupResources(resources)
      throw error
    }
  }
  
  private async cleanupResources(resources: Set<string>) {
    for (const resourceId of resources) {
      try {
        await this.deleteResource(resourceId)
      } catch (error) {
        console.error(`Failed to cleanup resource ${resourceId}:`, error)
      }
    }
  }
}
```

---

## Troubleshooting

### Common Issues and Solutions

1. **Validation Failures**
   ```typescript
   // Check schema validation
   const validation = await validateInstructionFile(file)
   console.log('Validation errors:', validation.errors)
   ```

2. **Permission Errors**
   ```typescript
   // Verify account permissions
   const permissions = await checkAccountPermissions(accountId)
   console.log('Available permissions:', permissions)
   ```

3. **Dependency Issues**
   ```typescript
   // Check dependency availability
   const dependencies = await checkDependencies(instructionFile)
   console.log('Missing dependencies:', dependencies.missing)
   ```

4. **Resource Limits**
   ```typescript
   // Check resource usage
   const usage = await getResourceUsage(accountId)
   console.log('Current usage:', usage)
   ```

### Debug Mode

```typescript
class DebugInstaller {
  async installWithDebug(instructionFile: string, options: any) {
    const debugOptions = {
      ...options,
      debug: true,
      verbose: true,
      dryRun: true // Always dry run in debug mode
    }
    
    console.log('Debug mode enabled')
    console.log('Instruction file:', instructionFile)
    console.log('Options:', debugOptions)
    
    const result = await executeInstallation(instructionFile, debugOptions)
    
    console.log('Installation result:', result)
    return result
  }
}
```

---

## Example Implementations

### GitHub Actions Integration

```yaml
# .github/workflows/install-app.yml
name: Install Spine App

on:
  push:
    paths:
      - 'apps/**'

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Validate app instructions
        run: npm run app-install validate apps/${{ github.event.repository.name }}.yaml
        
      - name: Install app (dry run)
        run: npm run app-install install apps/${{ github.event.repository.name }}.yaml --account-id ${{ secrets.TEST_ACCOUNT_ID }} --dry-run
        
      - name: Install app (production)
        if: github.ref == 'refs/heads/main'
        run: npm run app-install install apps/${{ github.event.repository.name }}.yaml --account-id ${{ secrets.PROD_ACCOUNT_ID }}
        env:
          DRY_RUN: false
```

### VS Code Extension

```typescript
// VS Code extension for Spine app development
import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('spine.installApp', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showErrorMessage('No file open')
      return
    }
    
    const filePath = editor.document.fileName
    if (!filePath.endsWith('.yaml')) {
      vscode.window.showErrorMessage('Please open a YAML instruction file')
      return
    }
    
    try {
      // Validate first
      const isValid = await validateInstructionFile(filePath)
      if (!isValid) {
        vscode.window.showErrorMessage('Invalid instruction file')
        return
      }
      
      // Get account ID
      const accountId = await vscode.window.showInputBox({
        prompt: 'Enter account ID',
        placeHolder: 'your-account-id'
      })
      
      if (!accountId) {
        return
      }
      
      // Install with progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Spine App',
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Validating...' })
        
        const result = await executeInstallation(filePath, {
          accountId,
          onProgress: (step, completed, total) => {
            const percentage = (completed / total) * 100
            progress.report({
              increment: percentage / 100,
              message: step
            })
          }
        })
        
        progress.report({ increment: 100, message: 'Complete!' })
        vscode.window.showInformationMessage('App installed successfully!')
      })
      
    } catch (error) {
      vscode.window.showErrorMessage(`Installation failed: ${error.message}`)
    }
  })
  
  context.subscriptions.push(disposable)
}
```

### CLI Tool

```typescript
#!/usr/bin/env node

import { Command } from 'commander'
import { validateInstructionFile, executeInstallation } from './app-install-cli'

const program = new Command()

program
  .name('spine-installer')
  .description('CLI tool for installing Spine apps')
  .version('1.0.0')

program
  .command('install <file>')
  .description('Install a Spine app')
  .option('-a, --account <id>', 'Target account ID')
  .option('-d, --dry-run', 'Dry run mode')
  .option('-e, --env <environment>', 'Target environment')
  .action(async (file, options) => {
    try {
      console.log(`Installing ${file}...`)
      
      const result = await executeInstallation(file, {
        accountId: options.account,
        dryRun: options.dryRun,
        environment: options.env
      })
      
      console.log('✅ Installation completed successfully!')
      console.log('Result:', result)
    } catch (error) {
      console.error('❌ Installation failed:', error.message)
      process.exit(1)
    }
  })

program.parse()
```

---

## Resources

- [App Installation CLI Reference](../app-installation/README.md)
- [Schema Design Guide](./schema-design-best-practices.md)
- [Migration Guide](../migration-guide.md)
- [API Documentation](../api-reference.md)
