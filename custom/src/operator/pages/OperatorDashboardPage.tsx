import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, LifeBuoy, Users, BarChart3, UserCheck, FileText } from 'lucide-react'

export default function OperatorDashboardPage() {
  const cards = [
    {
      title: 'Support Queue',
      description: 'Manage and respond to support cases',
      icon: LifeBuoy,
      to: '/operator/queue',
      color: 'bg-blue-600'
    },
    {
      title: 'Knowledge Management',
      description: 'Create and edit knowledge articles',
      icon: BookOpen,
      to: '/operator/knowledge',
      color: 'bg-blue-600'
    },
    {
      title: 'Community Moderation',
      description: 'Moderate community discussions',
      icon: Users,
      to: '/operator/community',
      color: 'bg-blue-600'
    },
    {
      title: 'Analytics',
      description: 'View system metrics and reports',
      icon: BarChart3,
      to: '/operator/analytics',
      color: 'bg-blue-600'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: UserCheck,
      to: '/operator/users',
      color: 'bg-blue-600'
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Operator Dashboard</h1>
        <p className="mt-2 text-gray-600">System management and operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.to}
            className="group relative bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${card.color} rounded-md p-3`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/operator/queue"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <LifeBuoy className="h-4 w-4 mr-2" />
            View Support Queue
          </Link>
          <Link
            to="/operator/knowledge/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            New Article
          </Link>
          <Link
            to="/operator/analytics"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            View Analytics
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="ml-2 text-gray-600">New support case #1234 opened</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="ml-2 text-gray-600">Knowledge article "Getting Started" updated</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="ml-2 text-gray-600">New community post requires moderation</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Support Queue</span>
              <span className="text-sm font-medium text-blue-600">8 active cases</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Knowledge Base</span>
              <span className="text-sm font-medium text-blue-600">142 articles</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Community Posts</span>
              <span className="text-sm font-medium text-blue-600">3 pending review</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
