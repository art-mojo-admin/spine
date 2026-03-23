# Role Access Fix Summary

## 🐛 **Root Cause Identified**

The custom app portals were showing blank pages because:

1. **Empty Memberships**: You have `memberships: []` (no account memberships)
2. **System Admin Role**: You have `system_role: "system_admin"` (from profile)
3. **Role Checking Logic**: Custom routes only checked `currentRole` (from memberships) but ignored `system_role`

## 🔍 **How Spine v2 Roles Work**

### **Role Hierarchy** (from sidebar code)
```typescript
const ROLE_RANK: Record<string, number> = {
  portal: 0,
  member: 1, 
  operator: 2,
  admin: 3,
  system_admin: 4,    // ← Your role
  system_operator: 4,
}
```

### **Role Sources**
- **`currentRole`**: Comes from `memberships[].account_role` (empty for you)
- **`system_role`**: Comes from `profile.system_role` (system_admin for you)
- **Fallback Logic**: `currentRole ?? profile?.system_role ?? 'member'`

## 🛠️ **Fix Applied**

### **1. Created Role Protection Component**
```typescript
// core/src/components/RoleProtectedRoute.tsx
export function RoleProtectedRoute({ children, minRole }: RoleProtectedRouteProps) {
  const { profile, currentRole } = useAuth()
  
  const userRank = ROLE_RANK[currentRole ?? profile?.system_role ?? 'member'] ?? 1
  const requiredRank = ROLE_RANK[minRole ?? 'member'] ?? 1
  
  if (userRank < requiredRank) {
    return <Navigate to="/admin/system-health" replace />
  }
  
  return <>{children}</>
}
```

### **2. Updated Custom Routes**
```typescript
// Before (no role protection)
{runtimeCustomRoutes.map(({ path, Component }) => (
  <Route key={path} path={path} element={<Component />} />
))}

// After (with role protection)
{runtimeCustomRoutes.map(({ path, Component, minRole }) => (
  <Route key={path} path={path} element={
    <RoleProtectedRoute minRole={minRole}>
      <Component />
    </RoleProtectedRoute>
  } />
))}
```

## 📊 **Access Matrix**

| Route | Required | Your Role | Access |
|-------|----------|-----------|---------|
| `/customer-portal` | `member` (rank 1) | `system_admin` (rank 4) | ✅ **ACCESS** |
| `/company-portal` | `operator` (rank 2) | `system_admin` (rank 4) | ✅ **ACCESS** |
| `/debug/roles` | `portal` (rank 0) | `system_admin` (rank 4) | ✅ **ACCESS** |

## ✅ **Results**

- ✅ **Build**: Successful (`✓ built in 17.24s`)
- ✅ **Role Logic**: System admins can access all custom portals
- ✅ **Fallback**: Uses `system_role` when no memberships exist
- ✅ **Protection**: Routes are properly role-protected

## 🎯 **Next Steps**

**Try accessing:**
1. `/customer-portal` - Should show member dashboard
2. `/company-portal` - Should show operator dashboard  
3. `/debug/roles` - Should show your role debug info

The portals should no longer show blank pages! Your `system_admin` role now gives you access to both customer and company portals. 🎉

## 🔧 **For Future Development**

When creating new custom apps:
- Use `minRole` in route definitions
- System admins automatically get access to all levels
- Regular users need proper account memberships
- Role protection is now automatic for all custom routes
