# SQL_INJECTION Security Report

## Status: PASS

## Findings

### Query Pattern

The entire codebase uses the **Supabase client library** exclusively for database access. This library uses parameterized queries under the hood — user input is never concatenated into SQL strings.

```typescript
// Example from profile/addresses/[id]:
await locals.supabase
  .from('addresses')
  .update(updates)
  .eq('id', params.id)       // ← Parameterized, not concatenated
  .eq('user_id', locals.user.id)
```

All `.from()`, `.select()`, `.insert()`, `.update()`, `.delete()`, `.eq()`, `.ilike()`, `.in()` etc. are parameterized by the PostgREST client. User input never touches a raw SQL string.

### RPC Calls

Four RPC calls found:

| RPC Function | Arguments | Concatenation? |
|---|---|---|
| `get_duplicate_cards_count()` | None | N/A |
| `sync_cards_bulk(cards_json)` | JSON blob | No — passed as typed parameter |
| `replace_order(order_id, items_json)` | UUID + JSON | No — parameterized |
| `create_order_with_items(user_id, address_id, items)` | UUIDs + JSON | No — parameterized |

The Supabase `rpc()` method always parameterizes its arguments — they are passed as PostgREST query parameters, not interpolated into the function call SQL.

### Server-Side SQL Functions

The PostgreSQL functions (`create_order_with_items`, `replace_order`, `sync_cards_bulk`) were reviewed in migrations. They use `$1`, `$2` parameter references and do not dynamically construct SQL from input.

### No Raw SQL in Application Code

Zero uses of:
- Template literal SQL (`` `SELECT * FROM users WHERE id='${id}'` ``)
- `pg` query concatenation
- `supabase.sql()` raw queries with user input
- `EXECUTE` with dynamic SQL

### `ilike` Search

```typescript
await supabase.from('cards').select(...).ilike('card_name', primaryName)
```

The `ilike` call is parameterized by the Supabase client. `primaryName` cannot escape the LIKE expression — it's passed as a bound parameter, not concatenated into the query string. At worst, a user could send `%` characters to perform wildcard matching (which is the intended behavior of card search).

## What's at Risk

Nothing — all database access uses parameterized queries.

## What's Already Secure

- 100% Supabase client library usage (parameterized by default)
- RPC calls use typed parameters, not string concatenation
- No `pg` driver or raw SQL template literals
- PostgreSQL functions use `$N` parameter binding

## Recommendations

1. No action required.
2. Maintain the "no raw SQL" policy as a code review requirement.
