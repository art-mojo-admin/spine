# Troubleshooting Common Issues

This guide covers common issues, their causes, and solutions for the Spine app installation system and portal schema integration.

## Table of Contents

1. [App Installation Issues](#app-installation-issues)
2. [Schema Validation Issues](#schema-validation-issues)
3. [Portal Integration Issues](#portal-integration-issues)
4. [Performance Issues](#performance-issues)
5. [Permission Issues](#permission-issues)
6. [Database Issues](#database-issues)
7. [Debugging Tools](#debugging-tools)

---

## App Installation Issues

### Issue: "Schema validation failed"

**Symptoms:**
```
❌ Validation failed:
Error: Invalid instruction file
```

**Causes:**
- Invalid YAML syntax
- Missing required fields
- Incorrect data types
- Invalid enum values

**Solutions:**

1. **Check YAML Syntax**
```bash
# Validate YAML syntax
npm run app-install validate your-app.yaml
```

2. **Verify Required Fields**
```yaml
# Ensure all required fields are present
app:
  name: "App Name"           # ✅ Required
  slug: "app-slug"           # ✅ Required  
  version: "1.0.0"           # ✅ Required
  external_app_id: "app-v1"   # ✅ Required

installation:
  pack_installation:         # ✅ Required
    external_app_id: "app-v1"
    external_app_version: "1.0.0"
```

3. **Check Data Types**
```yaml
# Incorrect
priority: "high"  # String instead of select option

# Correct
priority: "high"  # Must match options in schema
```

### Issue: "Variable not found"

**Symptoms:**
```
❌ Error: Variable TARGET_ACCOUNT_ID not found
```

**Causes:**
- Undefined variable in instruction file
- Variable not passed to CLI
- Typo in variable name

**Solutions:**

1. **Define Variables in Instruction File**
```yaml
variables:
  TARGET_ACCOUNT_ID: "your-account-id-here"
  CUSTOM_VAR: "custom-value"
```

2. **Pass Variables via CLI**
```bash
# The CLI automatically substitutes common variables
npm run app-install install app.yaml --account-id your-account-id
```

3. **Check Variable Names**
```yaml
# Use exact variable names
account_id: "${TARGET_ACCOUNT_ID}"  # ✅ Correct
account_id: "${target_account_id}"  # ❌ Case mismatch
```

### Issue: "Permission denied"

**Symptoms:**
```
❌ Error: Insufficient permissions to install apps
❌ Error: Only system admins can create tenant accounts
```

**Causes:**
- User lacks required permissions
- Account role insufficient
- System role missing

**Solutions:**

1. **Check User Permissions**
```sql
-- Check user's system role
SELECT system_role FROM persons WHERE email = 'user@example.com';

-- Check account membership and role
SELECT account_role FROM memberships 
WHERE person_id = 'person-id' AND account_id = 'account-id';
```

2. **Use Correct Account**
```bash
# Ensure you're using the right account ID
npm run app-install install app.yaml --account-id correct-account-id
```

3. **Grant Required Permissions**
```sql
-- Grant system admin role
UPDATE persons SET system_role = 'system_admin' WHERE email = 'admin@example.com';

-- Grant account admin role
UPDATE memberships SET account_role = 'admin' 
WHERE person_id = 'person-id' AND account_id = 'account-id';
```

---

## Schema Validation Issues

### Issue: "Field validation failed"

**Symptoms:**
```
❌ Error: Invalid data provided
❌ Error: Field 'title' is required
```

**Causes:**
- Missing required fields
- Invalid field values
- Type mismatches

**Solutions:**

1. **Check Required Fields**
```json
{
  "fields": {
    "title": {
      "type": "text",
      "required": true  // ✅ This field must be provided
    }
  }
}
```

2. **Validate Field Types**
```typescript
// Ensure data matches field type
const data = {
  title: "Valid title",        // ✅ String for text field
  priority: "high",           // ✅ String for select field
  count: 42                  // ✅ Number for number field
}
```

3. **Use FieldRenderer**
```typescript
// Let FieldRenderer handle validation
<FieldRenderer
  schema={fieldSchema}
  data={data[fieldKey]}
  userRole={userRole}
  editing={true}
  onChange={(value) => setData(fieldKey, value)}
/>
```

### Issue: "Permission access denied"

**Symptoms:**
```
❌ Error: Insufficient permissions to create support cases
❌ Error: Field is read-only for this role
```

**Causes:**
- Role permissions not configured
- Field-level permissions restrictive
- User role mismatch

**Solutions:**

1. **Check Role Permissions**
```json
{
  "record_permissions": {
    "member": { 
      "create": true,      // ✅ Allow creation
      "read": "all",        // ✅ Allow reading all
      "update": "own",      // ✅ Allow updating own
      "delete": "soft"      // ✅ Allow soft delete
    }
  }
}
```

2. **Verify Field Overrides**
```json
{
  "fields": {
    "sensitive_field": {
      "type": "text",
      "permission_overrides": {
        "member": { 
          "read": "all",     // ✅ Allow reading
          "update": "none"    // ❌ Prevent updating
        }
      }
    }
  }
```

3. **Check User Role**
```typescript
// Verify user role matches schema expectations
const userRole = profile?.system_role === 'system_admin' ? 'admin' : 'member'
```

---

## Portal Integration Issues

### Issue: "FormRenderer not rendering"

**Symptoms:**
- Form fields not displaying
- Empty form rendered
- Schema loading error

**Causes:**
- Schema not loaded
- Incorrect schema format
- Permission issues

**Solutions:**

1. **Check Schema Loading**
```typescript
const [schema, setSchema] = useState<ItemTypeSchema | null>(null)
const [schemaLoading, setSchemaLoading] = useState(true)

const loadSchema = async () => {
  try {
    setSchemaLoading(true)
    // Mock schema for development
    const mockSchema: ItemTypeSchema = {
      record_permissions: { /* ... */ },
      fields: { /* ... */ }
    }
    setSchema(mockSchema)
  } catch (err) {
    console.error('Failed to load schema:', err)
  } finally {
    setSchemaLoading(false)
  }
}
```

2. **Verify Schema Format**
```json
{
  "record_permissions": {
    "member": { "create": true, "read": "all", "update": "own", "delete": "soft" }
  },
  "fields": {
    "title": {
      "type": "text",
      "required": true
    }
  }
}
```

3. **Handle Loading States**
```typescript
{schemaLoading ? (
  <div className="text-center py-8">
    <div className="text-muted-foreground">Loading form schema...</div>
  </div>
) : schema ? (
  <FormRenderer /* ... */ />
) : (
  <div className="text-center py-8">
    <div className="text-muted-foreground">Failed to load form schema</div>
  </div>
)}
```

### Issue: "SelectNative component not found"

**Symptoms:**
```
Error: SelectNative is not exported
```

**Causes:**
- SelectNative not added to select component
- Import path incorrect

**Solutions:**

1. **Add SelectNative to Select Component**
```typescript
// In select.tsx
const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select className={cn(/* ... */)} ref={ref} {...props}>
        {children}
      </select>
    )
  }
)

export { SelectNative }
```

2. **Update Import**
```typescript
import { SelectNative } from '../components/ui/select'
```

---

## Performance Issues

### Issue: "Slow schema loading"

**Symptoms:**
- Forms taking >2 seconds to load
- Multiple database queries
- High memory usage

**Causes:**
- No schema caching
- Excessive database calls
- Large schema files

**Solutions:**

1. **Enable Schema Caching**
```typescript
import { CachedItemsDAL } from '../schema-cache'

// Use cached schema lookup
const schema = await CachedItemsDAL.getItemTypeSchema('support-case')
```

2. **Batch Schema Loading**
```typescript
// Load multiple schemas at once
const schemas = await CachedItemsDAL.getItemTypeSchemas([
  'support-case', 'knowledge-article', 'task'
])
```

3. **Optimize Schema Size**
```json
{
  "fields": {
    // ✅ Good: Minimal fields
    "title": { "type": "text", "required": true },
    "status": { "type": "select", "options": ["active", "inactive"] }
    
    // ❌ Avoid: Too many fields or options
    "large_field": { "type": "textarea" },
    "huge_options": { "type": "select", "options": [/* 200+ options */] }
  }
}
```

### Issue: "High memory usage"

**Symptoms:**
- Out of memory errors
- Slow performance
- Browser crashes

**Causes:**
- Large data sets
- Memory leaks
- Inefficient caching

**Solutions:**

1. **Implement Cache Cleanup**
```typescript
// Clean up expired cache entries
const cleaned = schemaCache.cleanup()
console.log(`Cleaned up ${cleaned} expired entries`)
```

2. **Limit Data Loading**
```typescript
// Paginate large datasets
const { data } = await db
  .from('items')
  .select('*')
  .range(offset, offset + limit)
```

3. **Monitor Memory Usage**
```typescript
// Get cache statistics
const stats = schemaCache.getStats()
console.log('Cache stats:', stats)
```

---

## Permission Issues

### Issue: "Role not recognized"

**Symptoms:**
```
Error: Invalid role 'custom_role'
Error: User role not found in permissions
```

**Causes:**
- Custom roles not defined
- Role name mismatch
- Missing role in tenant_roles

**Solutions:**

1. **Define Custom Roles**
```sql
INSERT INTO tenant_roles (account_id, slug, display_name, is_system)
VALUES ('account-id', 'custom_role', 'Custom Role', false);
```

2. **Check Role Names**
```sql
-- List available roles
SELECT slug, display_name FROM tenant_roles WHERE account_id = 'account-id';
```

3. **Update Schema**
```json
{
  "record_permissions": {
    "custom_role": {  // ✅ Use exact role slug
      "create": true,
      "read": "all",
      "update": "own",
      "delete": "soft"
    }
  }
}
```

### Issue: "Field permissions not working"

**Symptoms:**
- Users can see restricted fields
- Read-only fields editable
- Permission overrides ignored

**Causes:**
- Incorrect permission structure
- Missing base record access
- FieldRenderer not using permissions

**Solutions:**

1. **Check Permission Structure**
```json
{
  "fields": {
    "restricted_field": {
      "type": "text",
      "permission_overrides": {
        "member": {
          "read": "none",      // ✅ Correct structure
          "update": "none"
        }
      }
    }
  }
}
```

2. **Verify Base Record Access**
```typescript
// FieldRenderer needs base record access
const baseRecordAccess = schema.record_permissions?.[userRole]?.['read'] || 'all'

<FieldRenderer
  baseRecordAccess={baseRecordAccess}  // ✅ Pass base access
  /* ... */
/>
```

---

## Database Issues

### Issue: "Schema not found in database"

**Symptoms:**
```
Error: Support case item type not found
Error: Knowledge article item type not found
```

**Causes:**
- Item type not created
- Incorrect slug
- Database migration not run

**Solutions:**

1. **Check Item Type Exists**
```sql
-- Check if item type exists
SELECT * FROM item_type_registry WHERE slug = 'support-case';
```

2. **Create Missing Item Types**
```sql
INSERT INTO item_type_registry (slug, display_name, schema)
VALUES ('support-case', 'Support Case', '{"record_permissions": {...}, "fields": {...}}');
```

3. **Run Migrations**
```bash
# Run pending migrations
npm run migrate
```

### Issue: "Foreign key constraint violation"

**Symptoms:**
```
Error: insert or update on table violates foreign key constraint
Error: key is not present in table
```

**Causes:**
- Missing referenced records
- Incorrect foreign key values
- Database consistency issues

**Solutions:**

1. **Check Referenced Records**
```sql
-- Check if referenced record exists
SELECT * FROM accounts WHERE id = 'referenced-account-id';
SELECT * FROM item_type_registry WHERE id = 'referenced-item-type-id';
```

2. **Fix Data Consistency**
```sql
-- Update or remove orphaned records
UPDATE items 
SET account_id = 'valid-account-id' 
WHERE account_id = 'invalid-account-id';
```

3. **Use Proper References**
```typescript
// Ensure foreign keys exist before creating records
const accountExists = await checkAccountExists(accountId)
if (!accountExists) {
  throw new Error('Account not found')
}
```

---

## Debugging Tools

### 1. Schema Validation Debug

```typescript
// Debug schema validation
import { ItemsDAL } from '../items-dal'

async function debugSchema(itemType: string, data: any, userRole: string) {
  console.log('=== Schema Debug ===')
  console.log('Item Type:', itemType)
  console.log('User Role:', userRole)
  console.log('Input Data:', JSON.stringify(data, null, 2))
  
  const schema = await ItemsDAL.getItemTypeSchema(itemType)
  console.log('Schema:', JSON.stringify(schema, null, 2))
  
  if (!schema) {
    console.error('Schema not found!')
    return
  }
  
  // Test record access
  const canCreate = ItemsDAL.evaluateRecordAccess(schema, userRole, 'create')
  console.log('Can Create:', canCreate)
  
  // Test field access
  if (schema.fields) {
    Object.entries(schema.fields).forEach(([fieldKey, fieldSchema]) => {
      const readAccess = ItemsDAL.evaluateFieldAccess(fieldSchema, userRole, 'all', 'read')
      const updateAccess = ItemsDAL.evaluateFieldAccess(fieldSchema, userRole, 'all', 'update')
      console.log(`${fieldKey}: read=${readAccess}, update=${updateAccess}`)
    })
  }
  
  // Test validation
  const validated = ItemsDAL.validateUpdateData(data, {}, schema, userRole)
  console.log('Validated Data:', JSON.stringify(validated, null, 2))
}
```

### 2. Installation Debug

```typescript
// Debug app installation
async function debugInstallation(instructionFile: string, options: any) {
  console.log('=== Installation Debug ===')
  console.log('Instruction File:', instructionFile)
  console.log('Options:', JSON.stringify(options, null, 2))
  
  // Parse instruction file
  const content = readFileSync(instructionFile, 'utf8')
  const instructions = yaml.load(content)
  console.log('Instructions:', JSON.stringify(instructions, null, 2))
  
  // Validate against schema
  const schema = JSON.parse(readFileSync('docs/app-installation/schema.json', 'utf8'))
  const validate = new Ajv().compile(schema)
  const isValid = validate(instructions)
  
  console.log('Schema Valid:', isValid)
  if (!isValid) {
    console.log('Validation Errors:', JSON.stringify(validate.errors, null, 2))
  }
  
  // Test variable substitution
  const context = {
    TARGET_ACCOUNT_ID: options.accountId,
    PACK_INSTALLATION_ID: 'test-pack-id'
  }
  
  const substituted = substituteVariables(instructions, context)
  console.log('Substituted Instructions:', JSON.stringify(substituted, null, 2))
}
```

### 3. Performance Debug

```typescript
// Debug performance issues
async function debugPerformance() {
  console.log('=== Performance Debug ===')
  
  // Test schema cache performance
  const start = performance.now()
  const schema = await CachedItemsDAL.getItemTypeSchema('support-case')
  const cachedTime = performance.now() - start
  console.log('Cached Schema Lookup:', cachedTime.toFixed(2), 'ms')
  
  // Test batch lookup
  const batchStart = performance.now()
  const schemas = await CachedItemsDAL.getItemTypeSchemas(['support-case', 'knowledge-article', 'task'])
  const batchTime = performance.now() - batchStart
  console.log('Batch Schema Lookup:', batchTime.toFixed(2), 'ms')
  
  // Check cache stats
  const stats = schemaCache.getStats()
  console.log('Cache Stats:', stats)
}
```

### 4. Permission Debug

```typescript
// Debug permission issues
async function debugPermissions(accountId: string, personId: string) {
  console.log('=== Permission Debug ===')
  console.log('Account ID:', accountId)
  console.log('Person ID:', personId)
  
  // Get user info
  const { data: person } = await db
    .from('persons')
    .select('*')
    .eq('id', personId)
    .single()
  
  const { data: membership } = await db
    .from('memberships')
    .select('*')
    .eq('person_id', personId)
    .eq('account_id', accountId)
    .single()
  
  console.log('Person:', person)
  console.log('Membership:', membership)
  
  // Get available roles
  const { data: roles } = await db
    .from('tenant_roles')
    .select('*')
    .eq('account_id', accountId)
  
  console.log('Available Roles:', roles)
  
  // Test schema permissions
  const schema = await ItemsDAL.getItemTypeSchema('support-case')
  if (schema) {
    const userRole = membership?.account_role || 'member'
    const permissions = {
      canCreate: ItemsDAL.evaluateRecordAccess(schema, userRole, 'create'),
      canRead: ItemsDAL.evaluateRecordAccess(schema, userRole, 'read'),
      canUpdate: ItemsDAL.evaluateRecordAccess(schema, userRole, 'update'),
      canDelete: ItemsDAL.evaluateRecordAccess(schema, userRole, 'delete')
    }
    console.log('Permissions:', permissions)
  }
}
```

---

## Quick Reference

### Common Error Messages

| Error | Cause | Solution |
|-------|--------|----------|
| `Schema validation failed` | Invalid YAML or missing fields | Check syntax and required fields |
| `Variable not found` | Undefined variable | Define variables or pass via CLI |
| `Permission denied` | Insufficient permissions | Check user roles and permissions |
| `Item type not found` | Missing item type | Create item type or check slug |
| `Field validation failed` | Invalid field data | Check field types and validation rules |

### Debug Commands

```bash
# Validate instruction file
npm run app-install validate app.yaml

# Test installation (dry run)
npm run app-install install app.yaml --account-id test --dry-run

# Check database schema
npm run db:inspect item_type_registry

# Run load test
npm run load-test --concurrent 10 --total 100

# Debug permissions
npm run debug:permissions account-id person-id
```

### Environment Variables

```bash
# Enable debug mode
DEBUG=true npm run app-install install app.yaml

# Set dry run globally
DRY_RUN=true npm run app-install install app.yaml

# Increase log verbosity
LOG_LEVEL=debug npm run app-install install app.yaml
```

---

## Getting Help

If you're still experiencing issues:

1. **Check the logs** - Look for detailed error messages
2. **Run debug tools** - Use the debugging functions above
3. **Check the documentation** - Review relevant guides
4. **Search issues** - Check for similar problems
5. **Ask for help** - Contact support with detailed information

### What to Include in Support Requests

- Error messages (full stack trace)
- Steps to reproduce
- Environment information
- Relevant configuration files
- Debug output (if available)

---

## Resources

- [App Installation Guide](../app-installation/README.md)
- [Schema Design Guide](./schema-design-best-practices.md)
- [API Documentation](../api-reference.md)
- [Migration Guide](../migration-guide.md)
