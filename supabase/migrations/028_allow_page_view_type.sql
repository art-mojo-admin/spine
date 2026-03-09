-- Allow "page" view_type for page builder definitions
alter table view_definitions drop constraint if exists view_definitions_view_type_check;

alter table view_definitions
  add constraint view_definitions_view_type_check
  check (view_type in ('list', 'board', 'detail', 'portal_page', 'dashboard', 'page'));
