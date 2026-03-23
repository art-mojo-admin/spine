import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, LifeBuoy, Users, MessageSquare } from 'lucide-react'

export default function MemberDashboardPage() {
  const cards = [
    {
      title: 'Knowledge Base',
      description: 'Browse articles and documentation',
      icon: BookOpen,
      to: '/customer-portal/knowledge',
      color: 'bg-blue-600'
    },
    {
      title: 'Support',
      description: 'Submit and track support cases',
      icon: LifeBuoy,
      to: '/customer-portal/support',
      color: 'bg-blue-600'
    },
    {
      title: 'Community',
      description: 'Join discussions and connect with others',
      icon: Users,
      to: '/customer-portal/community',
      color: 'bg-blue-600'
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Member Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to your member portal</p>
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
            to="/customer-portal/support"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <LifeBuoy className="h-4 w-4 mr-2" />
            New Support Case
          </Link>
          <Link
            to="/customer-portal/community"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            View Community
          </Link>
          <Link
            to="/customer-portal/knowledge"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Browse Articles
          </Link>
        </div>
      </div>
    </div>
  )
}
