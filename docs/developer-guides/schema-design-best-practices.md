# Schema Design Best Practices

This guide covers best practices for designing item type schemas in Spine, ensuring security, performance, and maintainability.

## Table of Contents

1. [Schema Structure](#schema-structure)
2. [Permission Design](#permission-design)
3. [Field Types and Validation](#field-types-and-validation)
4. [Performance Considerations](#performance-considerations)
5. [Security Best Practices](#security-best-practices)
6. [Common Patterns](#common-patterns)
7. [Migration Strategies](#migration-strategies)
8. [Testing Schema Changes](#testing-schema-changes)

---

## Schema Structure

### Basic Schema Template

```json
{
  "record_permissions": {
    "member": { "create": false, "read": "all", "update": "own", "delete": "soft" },
    "operator": { "create": true, "read": "all", "update": "all", "delete": "soft" },
    "admin": { "create": true, "read": "all", "update": "all", "delete": "all" }
  },
  "fields": {
    "field_name": {
      "type": "text",
      "required": true,
      "validation": { ... }
    }
  }
}
```

### Schema Naming Conventions

- **Item Type Slugs**: Use lowercase, hyphenated names (`support-case`, `knowledge-article`)
- **Field Names**: Use snake_case (`priority`, `assigned_to`, `due_date`)
- **Permission Keys**: Use role names exactly as defined in `tenant_roles`

### Required vs Optional Fields

```json
{
  "fields": {
    "title": {
      "type": "text",
      "required": true,
      "help_text": "Brief, descriptive title"
    },
    "description": {
      "type": "textarea",
      "required": false,
      "help_text": "Detailed description"
    }
  }
}
```

---

## Permission Design

### Permission Levels

| Access Level | Description | Use Case |
|-------------|-------------|-----------|
| `false` | No access | Hidden fields |
| `"none"` | No access | Explicit denial |
| `"own"` | User's own records | Personal data |
| `"organization_only"` | Same organization | Company data |
| `"all"` | All records | Public data |
| `"soft"` | Soft delete only | Data retention |

### Role-Based Permission Matrix

```json
{
  "record_permissions": {
    "member": { 
      "create": false, 
      "read": "organization_only", 
      "update": "own", 
      "delete": "soft" 
    },
    "operator": { 
      "create": true, 
      "read": "all", 
      "update": "all", 
      "delete": "soft" 
    },
    "admin": { 
      "create": true, 
      "read": "all", 
      "update": "all", 
      "delete": "all" 
    }
  }
}
```

### Field-Level Override Pattern

```json
{
  "fields": {
    "sensitive_data": {
      "type": "text",
      "required": false,
      "permission_overrides": {
        "member": { "read": "none", "update": "none" },
        "operator": { "read": "all", "update": "all" },
        "admin": { "read": "all", "update": "all" }
      }
    }
  }
}
```

---

## Field Types and Validation

### Basic Field Types

```json
{
  "fields": {
    "simple_text": {
      "type": "text",
      "required": true,
      "placeholder": "Enter text..."
    },
    "email_field": {
      "type": "email",
      "required": true,
      "validation": { "pattern": "^[^@]+@[^@]+\\.[^@]+$" }
    },
    "number_field": {
      "type": "number",
      "required": false,
      "validation": { "min": 0, "max": 100 }
    }
  }
}
```

### Advanced Field Types

```json
{
  "fields": {
    "priority_select": {
      "type": "select",
      "required": true,
      "options": ["low", "medium", "high", "urgent"],
      "default": "medium"
    },
    "tags_array": {
      "type": "array",
      "required": false,
      "help_text": "Add tags for categorization"
    },
    "rich_content": {
      "type": "rich_text",
      "required": false,
      "help_text": "HTML content supported"
    },
    "file_upload": {
      "type": "file",
      "required": false,
      "help_text": "PDF, DOC, DOCX up to 10MB"
    }
  }
}
```

### Validation Rules

```json
{
  "fields": {
    "phone_number": {
      "type": "phone",
      "required": false,
      "validation": {
        "pattern": "^\\+?[1-9]\\d{1,14}$",
        "minLength": 10,
        "maxLength": 15
      }
    },
    "percentage": {
      "type": "number",
      "required": true,
      "validation": {
        "min": 0,
        "max": 100
      }
    },
    "url_field": {
      "type": "url",
      "required": false,
      "validation": {
        "pattern": "^https?://.+"
      }
    }
  }
}
```

---

## Performance Considerations

### Schema Size Guidelines

- **Maximum fields per schema**: 50 fields
- **Maximum options in select**: 100 options
- **Maximum array items**: 1000 items
- **Schema size**: < 10KB JSON

### Field Optimization

```json
{
  "fields": {
    // ✅ Good: Simple, indexed fields
    "status": {
      "type": "select",
      "options": ["active", "inactive", "archived"]
    },
    
    // ❌ Avoid: Too many options
    "category": {
      "type": "select",
      "options": ["option1", "option2", /* ... 200 more options */]
    },
    
    // ✅ Better: Use separate table for many categories
    "category_id": {
      "type": "text",
      "required": true
    }
  }
}
```

### Caching Strategy

```typescript
// Use schema caching for frequently accessed schemas
import { CachedItemsDAL } from '../schema-cache'

// Batch fetch multiple schemas
const schemas = await CachedItemsDAL.getItemTypeSchemas([
  'support-case', 'knowledge-article', 'task'
])
```

---

## Security Best Practices

### Data Classification

```json
{
  "fields": {
    // Public data
    "title": {
      "type": "text",
      "required": true,
      "permission_overrides": {
        "member": { "read": "all" }
      }
    },
    
    // Internal data
    "internal_notes": {
      "type": "textarea",
      "required": false,
      "permission_overrides": {
        "member": { "read": "none" },
        "operator": { "read": "all" }
      }
    },
    
    // Sensitive data
    "ssn": {
      "type": "text",
      "required": false,
      "permission_overrides": {
        "member": { "read": "none", "update": "none" },
        "operator": { "read": "none", "update": "none" },
        "admin": { "read": "all", "update": "all" }
      }
    }
  }
}
```

### Input Validation

```json
{
  "fields": {
    "user_input": {
      "type": "text",
      "required": true,
      "validation": {
        "maxLength": 1000,
        "pattern": "^[a-zA-Z0-9\\s\\-\\.,]+$"
      },
      "help_text": "Only letters, numbers, spaces, and basic punctuation"
    }
  }
}
```

### Audit Trail Fields

```json
{
  "fields": {
    "created_at": {
      "type": "datetime",
      "required": true,
      "permission_overrides": {
        "member": { "read": "all", "update": "none" },
        "operator": { "read": "all", "update": "none" },
        "admin": { "read": "all", "update": "none" }
      }
    },
    "updated_by": {
      "type": "text",
      "required": true,
      "permission_overrides": {
        "member": { "read": "own", "update": "none" },
        "operator": { "read": "all", "update": "none" },
        "admin": { "read": "all", "update": "none" }
      }
    }
  }
}
```

---

## Common Patterns

### Status Field Pattern

```json
{
  "fields": {
    "status": {
      "type": "select",
      "required": true,
      "options": ["draft", "active", "archived"],
      "default": "draft",
      "help_text": "Current status of this item"
    }
  }
}
```

### Assignment Pattern

```json
{
  "fields": {
    "assigned_to": {
      "type": "text",
      "required": false,
      "permission_overrides": {
        "member": { "read": "own", "update": "none" },
        "operator": { "read": "all", "update": "all" },
        "admin": { "read": "all", "update": "all" }
      },
      "help_text": "User ID of assigned person"
    }
  }
}
```

### Priority Pattern

```json
{
  "fields": {
    "priority": {
      "type": "select",
      "required": true,
      "options": ["low", "medium", "high", "urgent"],
      "default": "medium",
      "help_text": "Priority level for this item"
    }
  }
}
```

### Timestamp Pattern

```json
{
  "fields": {
    "due_date": {
      "type": "date",
      "required": false,
      "validation": {
        "min": "2024-01-01"
      },
      "help_text": "Due date for completion"
    },
    "completed_at": {
      "type": "datetime",
      "required": false,
      "permission_overrides": {
        "member": { "read": "all", "update": "none" },
        "operator": { "read": "all", "update": "all" },
        "admin": { "read": "all", "update": "all" }
      }
    }
  }
}
```

---

## Migration Strategies

### Adding New Fields

```sql
-- Step 1: Add field to schema
UPDATE item_type_registry 
SET schema = jsonb_set(
  schema, 
  '{fields,new_field}', 
  '{"type": "text", "required": false}'
)
WHERE slug = 'your-item-type';

-- Step 2: Migrate existing data if needed
UPDATE items 
SET metadata = jsonb_set(
  metadata, 
  '{new_field}', 
  '"default_value"'
)
WHERE item_type = 'your-item-type' 
AND metadata->>'new_field' IS NULL;
```

### Changing Field Types

```sql
-- Step 1: Validate data compatibility
SELECT id, metadata->>'old_field' as old_value
FROM items 
WHERE item_type = 'your-item-type'
AND metadata->>'old_field' IS NOT NULL
AND NOT (metadata->>'old_field' ~ '^[0-9]+$'); -- For number conversion

-- Step 2: Update schema
UPDATE item_type_registry 
SET schema = jsonb_set(
  schema, 
  '{fields,old_field,type}', 
  '"number"'
)
WHERE slug = 'your-item-type';

-- Step 3: Convert data
UPDATE items 
SET metadata = jsonb_set(
  metadata, 
  '{new_field}', 
  to_jsonb(CAST(metadata->>'old_field' AS integer))
)
WHERE item_type = 'your-item-type';
```

### Removing Fields

```sql
-- Step 1: Remove from schema
UPDATE item_type_registry 
SET schema = schema - 'fields' - 'old_field'
WHERE slug = 'your-item-type';

-- Step 2: Archive data (optional)
CREATE TABLE archived_field_data AS 
SELECT id, item_type, metadata->>'old_field' as old_field_value, updated_at
FROM items 
WHERE item_type = 'your-item-type'
AND metadata->>'old_field' IS NOT NULL;

-- Step 3: Remove from existing records
UPDATE items 
SET metadata = metadata - 'old_field'
WHERE item_type = 'your-item-type';
```

---

## Testing Schema Changes

### Unit Testing Schema Validation

```typescript
import { ItemsDAL } from '../items-dal'

describe('Support Case Schema', () => {
  test('should validate required fields', async () => {
    const schema = await ItemsDAL.getItemTypeSchema('support_case')
    expect(schema).toBeDefined()
    
    const result = ItemsDAL.validateUpdateData(
      { title: '', description: '' }, // Missing required fields
      {}, 
      schema, 
      'member'
    )
    expect(result).toBeNull() // Should fail validation
  })

  test('should enforce field permissions', async () => {
    const schema = await ItemsDAL.getItemTypeSchema('support_case')
    const access = ItemsDAL.evaluateFieldAccess(
      schema.fields.internal_notes,
      'member',
      'all',
      'read'
    )
    expect(access).toBe('none')
  })
})
```

### Integration Testing

```typescript
describe('Schema Integration', () => {
  test('should create item with schema validation', async () => {
    const schema = await ItemsDAL.getItemTypeSchema('support_case')
    const data = {
      title: 'Test Case',
      description: 'Test description',
      priority: 'high'
    }
    
    const validatedData = ItemsDAL.validateUpdateData(data, {}, schema, 'member')
    expect(validatedData).toBeTruthy()
    expect(validatedData.title).toBe('Test Case')
  })
})
```

### Load Testing

```typescript
describe('Schema Performance', () => {
  test('should handle concurrent schema lookups', async () => {
    const promises = Array(100).fill(null).map(() => 
      ItemsDAL.getItemTypeSchema('support-case')
    )
    
    const results = await Promise.all(promises)
    expect(results.every(r => r !== null)).toBe(true)
  })
})
```

---

## Troubleshooting

### Common Schema Issues

1. **Validation Failures**
   - Check field types match data
   - Verify required fields are present
   - Ensure validation rules are correct

2. **Permission Issues**
   - Verify role names match tenant roles
   - Check permission override structure
   - Test with different user roles

3. **Performance Issues**
   - Limit schema complexity
   - Use caching for frequently accessed schemas
   - Monitor schema size

### Debugging Tools

```typescript
// Schema validation debug
import { ItemsDAL } from '../items-dal'

const schema = await ItemsDAL.getItemTypeSchema('your-item-type')
console.log('Schema:', JSON.stringify(schema, null, 2))

const data = { /* your data */ }
const validated = ItemsDAL.validateUpdateData(data, {}, schema, 'member')
console.log('Validated:', validated)

// Permission debug
const access = ItemsDAL.evaluateRecordAccess(schema, 'member', 'read')
console.log('Access:', access)
```

---

## Checklist

Before deploying schema changes:

- [ ] Schema validates against JSON schema
- [ ] All required fields are properly defined
- [ ] Permission matrix is correct
- [ ] Field validation rules are appropriate
- [ ] Migration scripts are tested
- [ ] Rollback plan exists
- [ ] Performance impact assessed
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Tests written and passing

---

## Resources

- [Schema Reference](../schema-reference.md)
- [Migration Guide](../migration-guide.md)
- [Security Guidelines](../security-guidelines.md)
- [Performance Optimization](../performance-optimization.md)
