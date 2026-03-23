# Customer Portal - Post Install

## Required Steps
1. Rebuild the frontend: `npm run build`
2. Deploy functions: `npm run deploy:functions`

## Optional Configuration
- Set `CUSTOMER_PORTAL_KB_ENABLED=true` in your env for knowledge base
- Set `CUSTOMER_PORTAL_COMMUNITY_ENABLED=true` in your env for community forums

## Database
No migrations required. Uses core Spine tables.

## Enable in Admin
Go to Admin → Marketplace → Customer Portal → Enable

## Features
- Knowledge Base with full-text search
- Support ticket submission and tracking
- Community forums with moderation
- User dashboard with quick actions
- Profile management
- Notification preferences

## Support
Documentation: https://docs.spine.dev/customer-portal
Support: https://support.spine.dev
