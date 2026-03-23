import { useAuth } from '@/hooks/useAuth'

export default function DebugRolePage() {
  const { session, user, profile, memberships, currentAccountId, currentRole } = useAuth()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Role Debug Information</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Session Info</h2>
          <pre className="text-sm">
            {JSON.stringify({ session: !!session, user: user?.email }, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Profile Info</h2>
          <pre className="text-sm">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Memberships</h2>
          <pre className="text-sm">
            {JSON.stringify(memberships, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Current Context</h2>
          <pre className="text-sm">
            {JSON.stringify({ currentAccountId, currentRole }, null, 2)}
          </pre>
        </div>

        <div className="bg-yellow-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Route Access Check</h2>
          <div className="space-y-2 text-sm">
            <div>Customer Portal (requires 'member'): {currentRole === 'member' ? '✅ ACCESS' : '❌ NO ACCESS'}</div>
            <div>Company Portal (requires 'operator'): {currentRole === 'operator' ? '✅ ACCESS' : '❌ NO ACCESS'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
