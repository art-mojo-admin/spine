# Spine App Installation System

This directory contains the instruction files and tools for automated app installation in Spine, designed for use by agentic IDEs and automation systems.

## Overview

The app installation system provides:
- **Structured instruction format** (YAML + JSON schema validation)
- **CLI tool** for validation and execution
- **Templates** for common app types
- **Examples** showing complete installation workflows

## Quick Start

### 1. Validate an Installation File
```bash
npm run app-install validate docs/app-installation/examples/support-app.yaml
```

### 2. Generate a New App Template
```bash
npm run app-install template app -o my-new-app.yaml
```

### 3. Execute an Installation (Dry Run)
```bash
npm run app-install install docs/app-installation/examples/support-app.yaml --account-id your-account-id --dry-run
```

### 4. Execute an Installation (Live)
```bash
npm run app-install install docs/app-installation/examples/support-app.yaml --account-id your-account-id
```

## File Structure

```
docs/app-installation/
├── schema.json              # JSON schema for validation
├── templates/
│   ├── app-install.yaml     # App installation template
│   └── migration.yaml       # Migration instruction template
├── examples/
│   ├── support-app.yaml     # Complete support app example
│   └── crm-app.yaml         # Complete CRM app example
└── README.md               # This file
```

## Instruction Format

### App Installation Instructions

```yaml
app:
  name: "App Name"
  slug: "app-slug"
  version: "1.0.0"
  external_app_id: "app-v1"

installation:
  pack_installation:
    account_id: "${TARGET_ACCOUNT_ID}"
    external_app_id: "app-v1"
    external_app_version: "1.0.0"
    install_mode: "full"
    
  app_creation:
    - slug: "app-slug"
      name: "App Name"
      installed_pack_id: "${PACK_INSTALLATION_ID}"
      min_role: "member"
      nav_items:
        - key: "dashboard"
          to: "/app-slug"
          label: "Dashboard"
          icon: "layout-dashboard"
          
  migrations:
    - file: "migrations/001_app_setup.sql"
      description: "Create app item types and views"
      
  verification:
    - check: "app_definition_exists"
      slug: "app-slug"
```

### Migration Instructions

```yaml
migration:
  id: "001_migration_id"
  description: "Migration description"
  
  steps:
    - type: "sql"
      file: "sql/create_tables.sql"
      description: "Create required tables"
      
    - type: "registry_update"
      registry: "item_type_registry"
      operation: "insert"
      data:
        slug: "custom_item"
        schema:
          record_permissions:
            member: { create: true, read: "all", update: "own" }
          fields:
            title:
              type: "text"
              required: true
```

## Variable Substitution

Instructions support variable substitution using `${VARIABLE_NAME}` syntax:

### Built-in Variables
- `${TARGET_ACCOUNT_ID}` - Account where app is being installed
- `${PACK_INSTALLATION_ID}` - ID of created pack installation (available after pack installation step)

### Custom Variables
Define custom variables in the instruction file:

```yaml
variables:
  TARGET_ACCOUNT_ID: "your-account-id-here"
  CUSTOM_VAR: "custom-value"
```

## CLI Commands

### validate
Validate an instruction file against the JSON schema:
```bash
npm run app-install validate <file>
```

### install
Execute app installation from instruction file:
```bash
npm run app-install install <file> [options]
```

Options:
- `-a, --account-id <id>` - Target account ID
- `-d, --dry-run` - Simulate installation without making changes

### template
Generate a new instruction template:
```bash
npm run app-install template <type> [options]
```

Types:
- `app` - App installation template
- `migration` - Migration instruction template

Options:
- `-o, --output <path>` - Output file path (optional, prints to stdout)

## Schema Validation

All instruction files are validated against `schema.json` before execution. The schema enforces:

- Required fields and structure
- Valid enum values
- Proper data types
- Nested object constraints

## Installation Steps

The installation process follows these steps:

1. **Validation** - Check instruction file against schema
2. **Pack Installation** - Create `installed_packs` record
3. **App Creation** - Create `app_definitions` with navigation
4. **Migrations** - Run SQL migrations and registry updates
5. **Verification** - Confirm all components were created

## Error Handling

The CLI provides detailed error messages for:
- Schema validation failures
- Missing required fields
- Invalid enum values
- Database connection errors
- Permission issues

## Best Practices

1. **Always validate** before installing
2. **Use dry-run** to test installations
3. **Include verification steps** for reliability
4. **Use descriptive names** for migrations and checks
5. **Version your apps** properly
6. **Test migrations** with rollback scripts

## Integration with Agentic IDE

The instruction format is designed to be machine-readable and can be easily integrated with agentic IDEs:

1. **Parse YAML** instruction files
2. **Validate against JSON schema**
3. **Execute steps in order**
4. **Handle variable substitution**
5. **Report progress and errors**

Example integration pattern:
```typescript
import { validateInstructionFile, executeInstallation } from './app-install-cli'

// Validate
const isValid = await validateInstructionFile('app.yaml')
if (!isValid) {
  throw new Error('Invalid instruction file')
}

// Execute
await executeInstallation('app.yaml', { 
  accountId: 'target-account-id',
  dryRun: false 
})
```

## Troubleshooting

### Common Issues

1. **Schema validation failed**
   - Check file syntax (YAML indentation)
   - Verify all required fields are present
   - Use `validate` command to see specific errors

2. **Variable not found**
   - Ensure all `${VARIABLE}` references are defined
   - Check for typos in variable names
   - Add missing variables to `variables` section

3. **Permission denied**
   - Verify account ID is correct
   - Check user has installation permissions
   - Ensure account is in proper state

### Debug Mode

Use dry-run mode to debug installations:
```bash
npm run app-install install app.yaml --account-id test-id --dry-run
```

This shows what would happen without making changes.
