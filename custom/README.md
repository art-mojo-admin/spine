# Spine Custom App - Knowledge, Support & Community

This custom application provides a unified knowledge, support, and community platform built entirely on Spine Core primitives.

## Architecture

- **Zero Core Modifications**: All functionality built in the `custom/` layer
- **Item-Centric**: Uses Spine's items, threads, messages, and workflows
- **AI-Powered**: OpenAI GPT-4 for intelligent support responses
- **Self-Service**: All users authenticate, no anonymous access

## Features

### Knowledge Base
- Multi-type articles (docs, FAQ, troubleshooting, etc.)
- Visibility-based access control (member/operator/admin)
- Semantic search with embeddings
- Version control and publishing workflow

### Support System
- AI-first support with confidence scoring
- Automatic escalation when confidence is low
- Thread-based conversations
- Knowledge improvement loop from resolved cases

### Community
- Questions, discussions, and announcements
- Moderation workflow
- Link to knowledge articles
- Support case correlation

### Analytics
- AI resolution rate tracking
- Knowledge gap identification
- Community engagement metrics
- Support performance insights

## Data Model

### Item Types
- `knowledge_article` - Documentation and help content
- `support_case` - Customer support tickets
- `community_post` - Community discussions and questions

### Workflows
- Knowledge Lifecycle (Draft → Review → Published → Archived)
- Support Case Lifecycle (Open → AI Attempt → Escalated → In Progress → Resolved)
- Community Moderation (Active → Reported → Under Review → Action Taken)

### Link Types
- `references` - Cases referencing knowledge articles
- `resulted_in` - Cases resulting in knowledge articles
- `discusses` - Posts discussing knowledge articles
- `prompted_by` - Cases prompted by community posts

## API Endpoints

### Knowledge
- `GET /custom/knowledge` - List/search articles
- `GET /custom/knowledge?mode=detail&item_id={id}` - Get article
- `POST /custom/knowledge` - Create article
- `PATCH /custom/knowledge/{id}` - Update article
- `DELETE /custom/knowledge/{id}` - Delete article

### Support
- `GET /custom/support` - List cases
- `GET /custom/support?mode=detail&item_id={id}` - Get case
- `POST /custom/support` - Create case
- `PATCH /custom/support/{id}` - Update case

### AI Support
- `POST /custom/ai-support` - Process AI support request
- `GET /custom/ai-support?case_id={id}` - Get AI support history

### Knowledge Improvement
- `POST /custom/kb-improvement` - Create/update knowledge from case
- `GET /custom/kb-improvement?case_id={id}` - Get improvement suggestions

### Community
- `GET /custom/community` - List posts
- `GET /custom/community?mode=detail&item_id={id}` - Get post
- `POST /custom/community` - Create post
- `PATCH /custom/community/{id}` - Update post
- `DELETE /custom/community/{id}` - Delete post

### Analytics
- `GET /custom/app-analytics?report=escalation-reasons` - Escalation reasons
- `GET /custom/app-analytics?report=kb-gaps` - Knowledge gaps
- `GET /custom/app-analytics?report=ai-resolution-rate` - AI resolution rate
- `GET /custom/app-analytics?report=top-unanswered` - Top unanswered questions
- `GET /custom/app-analytics?report=knowledge-creation` - Knowledge creation trends
- `GET /custom/app-analytics?report=community-support-correlation` - Community-support correlation

## UI Routes

### Member Routes (authenticated)
- `/member/knowledge` - Knowledge base browser
- `/member/knowledge/:articleId` - Article detail
- `/member/support` - Support case management
- `/member/support/cases/:caseId` - Case detail
- `/member/community` - Community forum
- `/member/community/:postId` - Post detail

### Operator Routes (operator+)
- `/operator/queue` - Support queue management
- `/operator/cases/:caseId` - Case workspace
- `/operator/knowledge` - Knowledge management
- `/operator/knowledge/:articleId` - Knowledge editor
- `/operator/knowledge/new` - New knowledge article
- `/operator/community` - Community moderation
- `/operator/analytics` - Analytics dashboard

## Deployment

1. Apply schema migration: `044_custom_app_seed.sql`
2. Deploy custom functions to Netlify
3. Configure OpenAI API key in environment
4. Set up semantic search embeddings
5. Test authentication flows

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - OpenAI API key for AI support
- `API_URL` - API base URL for development

### Permissions
- All routes require authentication
- Member routes require `member` role or higher
- Operator routes require `operator` role or higher
- Admin routes require `admin` role or higher

## Development

The custom app is organized as:

```
custom/
├── functions/           # Backend API functions
│   ├── knowledge.ts
│   ├── support.ts
│   ├── ai-support.ts
│   ├── kb-improvement.ts
│   ├── community.ts
│   └── app-analytics.ts
├── src/
│   ├── member/         # Member UI pages
│   ├── operator/       # Operator UI pages
│   ├── lib/           # Shared utilities
│   └── routes.ts      # Route definitions
└── manifest/           # Integration with core
    ├── routes.ts
    └── navSections.ts
```

## Security

- All API endpoints require valid Spine session
- No anonymous access points
- Role-based access control enforced
- Input validation and sanitization
- Audit logging for all actions
