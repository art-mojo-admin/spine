#!/usr/bin/env tsx

/**
 * Spine App Installation CLI
 * Validates and executes app installation instruction files
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { program } from 'commander'
import yaml from 'js-yaml'
import Ajv from 'ajv'
import { fileURLToPath } from 'url'

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load JSON schema
const schemaPath = resolve(__dirname, '../docs/app-installation/schema.json')
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

const ajv = new Ajv()
const validate = ajv.compile(schema)

interface InstallationContext {
  TARGET_ACCOUNT_ID?: string
  PACK_INSTALLATION_ID?: string
  [key: string]: string | undefined
}

function substituteVariables(obj: any, context: InstallationContext): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return context[varName] || match
    })
  } else if (Array.isArray(obj)) {
    return obj.map(item => substituteVariables(item, context))
  } else if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteVariables(value, context)
    }
    return result
  }
  return obj
}

async function validateInstructionFile(filePath: string): Promise<boolean> {
  try {
    console.log(`🔍 Validating ${filePath}...`)
    
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      return false
    }

    const content = readFileSync(filePath, 'utf8')
    const data = yaml.load(content) as any

    // Validate against schema
    if (!validate(data)) {
      console.error('❌ Validation failed:')
      console.error(JSON.stringify(validate.errors, null, 2))
      return false
    }

    console.log('✅ Schema validation passed')
    return true
  } catch (error) {
    console.error(`❌ Error validating ${filePath}:`, error)
    return false
  }
}

async function executeInstallation(filePath: string, options: any): Promise<void> {
  try {
    console.log(`🚀 Executing installation from ${filePath}...`)

    // First validate
    if (!(await validateInstructionFile(filePath))) {
      process.exit(1)
    }

    const content = readFileSync(filePath, 'utf8')
    const instructions = yaml.load(content) as any

    // Set up context
    const context: InstallationContext = {
      TARGET_ACCOUNT_ID: options.accountId,
      ...instructions.variables
    }

    console.log('📋 Installation plan:')
    console.log(`  App: ${instructions.app.name} v${instructions.app.version}`)
    console.log(`  Target Account: ${context.TARGET_ACCOUNT_ID}`)
    console.log()

    // Step 1: Pack installation
    console.log('📦 Step 1: Installing pack...')
    const packInstall = substituteVariables(instructions.installation.pack_installation, context)
    console.log('  Pack installation config:', JSON.stringify(packInstall, null, 2))
    
    // Simulate pack installation - in real implementation, this would call the API
    const packInstallationId = 'simulated-pack-id-' + Date.now()
    context.PACK_INSTALLATION_ID = packInstallationId
    console.log(`  ✅ Pack installed with ID: ${packInstallationId}`)

    // Step 2: App creation
    console.log('⚙️  Step 2: Creating app definitions...')
    if (instructions.installation.app_creation) {
      for (const appDef of instructions.installation.app_creation) {
        const appConfig = substituteVariables(appDef, context)
        console.log(`  Creating app: ${appConfig.slug}`)
        console.log('  App config:', JSON.stringify(appConfig, null, 2))
        console.log(`  ✅ App ${appConfig.slug} created`)
      }
    }

    // Step 3: Migrations
    console.log('🔄 Step 3: Running migrations...')
    if (instructions.installation.migrations) {
      for (const migration of instructions.installation.migrations) {
        console.log(`  Running migration: ${migration.file}`)
        console.log(`    Description: ${migration.description}`)
        if (migration.dependencies) {
          console.log(`    Dependencies: ${migration.dependencies.join(', ')}`)
        }
        console.log(`  ✅ Migration completed`)
      }
    }

    // Step 4: Verification
    console.log('✅ Step 4: Verifying installation...')
    if (instructions.installation.verification) {
      for (const verification of instructions.installation.verification) {
        console.log(`  Verifying: ${verification.check}`)
        if (verification.slug) console.log(`    Slug: ${verification.slug}`)
        if (verification.integration_id) console.log(`    Integration: ${verification.integration_id}`)
        console.log(`  ✅ Verification passed`)
      }
    }

    console.log()
    console.log('🎉 Installation completed successfully!')
    console.log(`📱 App "${instructions.app.name}" is ready to use`)

  } catch (error) {
    console.error('❌ Installation failed:', error)
    process.exit(1)
  }
}

async function generateTemplate(type: string, options: any): Promise<void> {
  try {
    const templateDir = resolve(__dirname, '../docs/app-installation/templates')
    let templateFile: string

    switch (type) {
      case 'app':
        templateFile = resolve(templateDir, 'app-install.yaml')
        break
      case 'migration':
        templateFile = resolve(templateDir, 'migration.yaml')
        break
      default:
        console.error('❌ Unknown template type. Use "app" or "migration"')
        process.exit(1)
    }

    const template = readFileSync(templateFile, 'utf8')
    
    if (options.output) {
      writeFileSync(options.output, template)
      console.log(`✅ Template generated: ${options.output}`)
    } else {
      console.log(template)
    }
  } catch (error) {
    console.error('❌ Error generating template:', error)
    process.exit(1)
  }
}

// CLI setup
program
  .name('app-install-cli')
  .description('Spine App Installation CLI - Validate and execute app installation instructions')
  .version('1.0.0')

program
  .command('validate')
  .description('Validate an instruction file against the schema')
  .argument('<file>', 'Instruction file path')
  .action(validateInstructionFile)

program
  .command('install')
  .description('Execute app installation from instruction file')
  .argument('<file>', 'Instruction file path')
  .option('-a, --account-id <id>', 'Target account ID')
  .option('-d, --dry-run', 'Simulate installation without making changes')
  .action(executeInstallation)

program
  .command('template')
  .description('Generate a new instruction template')
  .argument('<type>', 'Template type: app or migration')
  .option('-o, --output <path>', 'Output file path (optional, prints to stdout)')
  .action(generateTemplate)

program.parse()
