# Basic Database Operations

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --user postgres --password mysecretpassword --query "CREATE database test"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, age INTEGER, email TEXT)"
```

```afterAll
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "DROP TABLE IF EXISTS users"
```

```afterAll
aux4 db postgres execute --host localhost --port 5432 --user postgres --password mysecretpassword --query "DROP database IF EXISTS test"
```

## Insert single record

```execute
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES ('John', 28, 'john@example.com') RETURNING *" | jq .
```

```expect
[
  {
    "id": 1,
    "name": "John",
    "age": 28,
    "email": "john@example.com"
  }
]
```

## Insert using parameters

```execute
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --name Peter --age 55 --email peter@nothere.com | jq .
```

```expect
[
  {
    "id": 2,
    "name": "Peter",
    "age": 55,
    "email": "peter@nothere.com"
  }
]
```

## Insert using JSON file

```file:users.json
[
  {
    "name": "Alice",
    "age": 30,
    "email": "alice@person.com"
  },
  {
    "name": "Bob",
    "age": 25,
    "email": "bob@person.com"
  }
]
```

### Only the values from the file

```execute
cat users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream | jq .
```

```expect
[
  {
    "id": 3,
    "name": "Alice",
    "age": 30,
    "email": "alice@person.com"
  },
  {
    "id": 4,
    "name": "Bob",
    "age": 25,
    "email": "bob@person.com"
  }
]
```

### Overriding one of the parameters

```execute
cat users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --email noemail@example.com --inputStream | jq .
```

```expect
[
  {
    "id": 5,
    "name": "Alice",
    "age": 30,
    "email": "noemail@example.com"
  },
  {
    "id": 6,
    "name": "Bob",
    "age": 25,
    "email": "noemail@example.com"
  }
]
```

## Stream mode

### Query all users as stream

```execute
aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT * FROM users ORDER BY id"
```

```expect
{"id":1,"name":"John","age":28,"email":"john@example.com"}
{"id":2,"name":"Peter","age":55,"email":"peter@nothere.com"}
{"id":3,"name":"Alice","age":30,"email":"alice@person.com"}
{"id":4,"name":"Bob","age":25,"email":"bob@person.com"}
{"id":5,"name":"Alice","age":30,"email":"noemail@example.com"}
{"id":6,"name":"Bob","age":25,"email":"noemail@example.com"}
```

### Stream with parameters

```execute
aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT name, email FROM users WHERE age >= :minAge ORDER BY name" --minAge 30
```

```expect
{"name":"Alice","email":"alice@person.com"}
{"name":"Alice","email":"noemail@example.com"}
{"name":"Peter","email":"peter@nothere.com"}
```

## Stream piping

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "CREATE TABLE IF NOT EXISTS user_audit (audit_id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, user_email TEXT, audit_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
```

```afterAll
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "DROP TABLE IF EXISTS user_audit"
```

### Stream users and insert into audit table

```execute
aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT id, name, email FROM users WHERE age >= 25" | aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO user_audit (user_id, user_name, user_email) VALUES (:id, :name, :email) RETURNING audit_id, user_name" --inputStream
```

```expect
{"audit_id":1,"user_name":"John"}
{"audit_id":2,"user_name":"Peter"}
{"audit_id":3,"user_name":"Alice"}
{"audit_id":4,"user_name":"Bob"}
{"audit_id":5,"user_name":"Alice"}
{"audit_id":6,"user_name":"Bob"}
```

### Verify audit records count

```execute
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT COUNT(*) as audit_count FROM user_audit" | jq .
```

```expect
[
  {
    "audit_count": "6"
  }
]
```

## Transaction Tests

### Execute with Transaction - Good Input

```file:good_transaction_users.json
[
  {
    "name": "Transaction User 1",
    "age": 35,
    "email": "txuser1@example.com"
  },
  {
    "name": "Transaction User 2",
    "age": 42,
    "email": "txuser2@example.com"
  }
]
```

#### With Transaction

```execute
cat good_transaction_users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream --tx | jq .
```

```expect
[
  {
    "id": 7,
    "name": "Transaction User 1",
    "age": 35,
    "email": "txuser1@example.com"
  },
  {
    "id": 8,
    "name": "Transaction User 2",
    "age": 42,
    "email": "txuser2@example.com"
  }
]
```

#### Without Transaction

```execute
cat good_transaction_users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream | jq .
```

```expect
[
  {
    "id": 9,
    "name": "Transaction User 1",
    "age": 35,
    "email": "txuser1@example.com"
  },
  {
    "id": 10,
    "name": "Transaction User 2",
    "age": 42,
    "email": "txuser2@example.com"
  }
]
```

### Execute with Transaction - Bad Input (Rollback Test)

```file:bad_transaction_users.json
[
  {
    "name": "Good Record 1",
    "age": 25,
    "email": "good1@example.com"
  },
  {
    "name": "Good Record 2",
    "age": 30,
    "email": "good2@example.com"
  },
  {
    "name": "Bad Record",
    "email": "bad@example.com"
  }
]
```

#### With Transaction (should rollback all)

```execute
cat bad_transaction_users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream --tx | jq .
```

```expect
[
  {
    "id": 11,
    "name": "Good Record 1",
    "age": 25,
    "email": "good1@example.com"
  },
  {
    "id": 12,
    "name": "Good Record 2",
    "age": 30,
    "email": "good2@example.com"
  },
  {
    "id": 13,
    "name": "Bad Record",
    "age": null,
    "email": "bad@example.com"
  }
]
```

#### Without Transaction (should insert good records before failing)

```execute
cat bad_transaction_users.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream | jq .
```

```expect
[
  {
    "id": 14,
    "name": "Good Record 1",
    "age": 25,
    "email": "good1@example.com"
  },
  {
    "id": 15,
    "name": "Good Record 2",
    "age": 30,
    "email": "good2@example.com"
  },
  {
    "id": 16,
    "name": "Bad Record",
    "age": null,
    "email": "bad@example.com"
  }
]
```

### Stream with Transaction - Good Input

```file:good_transaction_users.json
[
  {
    "name": "Transaction User 1",
    "age": 35,
    "email": "txuser1@example.com"
  },
  {
    "name": "Transaction User 2",
    "age": 42,
    "email": "txuser2@example.com"
  }
]
```

```file:bad_transaction_users.json
[
  {
    "name": "Good Record 1",
    "age": 25,
    "email": "good1@example.com"
  },
  {
    "name": "Good Record 2",
    "age": 30,
    "email": "good2@example.com"
  },
  {
    "name": "Bad Record",
    "email": "bad@example.com"
  }
]
```

#### With Transaction

```execute
cat good_transaction_users.json | aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream --tx
```

```expect
{"id":17,"name":"Transaction User 1","age":35,"email":"txuser1@example.com"}
{"id":18,"name":"Transaction User 2","age":42,"email":"txuser2@example.com"}
```

#### Without Transaction

```execute
cat good_transaction_users.json | aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream
```

```expect
{"id":19,"name":"Transaction User 1","age":35,"email":"txuser1@example.com"}
{"id":20,"name":"Transaction User 2","age":42,"email":"txuser2@example.com"}
```

### Stream with Transaction - Bad Input (Rollback Test)

```file:bad_transaction_users.json
[
  {
    "name": "Good Record 1",
    "age": 25,
    "email": "good1@example.com"
  },
  {
    "name": "Good Record 2",
    "age": 30,
    "email": "good2@example.com"
  },
  {
    "name": "Bad Record",
    "email": "bad@example.com"
  }
]
```

#### With Transaction (should rollback all)

```execute
cat bad_transaction_users.json | aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream --tx
```

```expect
{"id":21,"name":"Good Record 1","age":25,"email":"good1@example.com"}
{"id":22,"name":"Good Record 2","age":30,"email":"good2@example.com"}
{"id":23,"name":"Bad Record","age":null,"email":"bad@example.com"}
```

#### Without Transaction (should stream good records before failing)

```execute
cat bad_transaction_users.json | aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream
```

```expect
{"id":24,"name":"Good Record 1","age":25,"email":"good1@example.com"}
{"id":25,"name":"Good Record 2","age":30,"email":"good2@example.com"}
{"id":26,"name":"Bad Record","age":null,"email":"bad@example.com"}
```

## Error Handling Tests

### Test invalid SQL query error

```execute
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT * FROM nonexistent_table"
```

```error
[{"item":{},"query":"SELECT * FROM nonexistent_table","error":"relation \"nonexistent_table\" does not exist"}]
```

### Test stream error with invalid query

```execute
aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT invalid_column FROM users"
```

```error
{"item":{},"query":"SELECT invalid_column FROM users","error":"column \"invalid_column\" does not exist"}
```

### Test batch execute with missing parameters

```file:invalid_batch.json
[
  {
    "name": "Valid User",
    "age": 30,
    "email": "valid@example.com"
  },
  {
    "invalid_field": "bad data"
  }
]
```

```execute
cat invalid_batch.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (name, age, email) VALUES (:name, :age, :email) RETURNING *" --inputStream | jq .
```

```expect
[
  {
    "id": 27,
    "name": "Valid User",
    "age": 30,
    "email": "valid@example.com"
  },
  {
    "id": 28,
    "name": null,
    "age": null,
    "email": null
  }
]
```

### Test batch execute error with constraint violation

```file:duplicate_user.json
[
  {
    "id": 1,
    "name": "Duplicate User",
    "age": 25,
    "email": "duplicate@example.com"
  }
]
```

```execute
cat duplicate_user.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (id, name, age, email) VALUES (:id, :name, :age, :email)" --inputStream
```

```error
[{"item":{"id":1,"name":"Duplicate User","age":25,"email":"duplicate@example.com"},"query":"INSERT INTO users (id, name, age, email) VALUES (:id, :name, :age, :email)","error":"duplicate key value violates unique constraint \"users_pkey\""}]
```

## Ignore Errors Tests

### Test execute with --ignore flag - single error

```execute
aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT * FROM nonexistent_table" --ignore
```

```expect

```

```error
[{"item":{},"query":"SELECT * FROM nonexistent_table","error":"relation \"nonexistent_table\" does not exist"}]
```

### Test batch execute with --ignore flag - mixed success and errors

```file:mixed_batch.json
[
  {
    "id": 1000,
    "name": "Good User",
    "age": 30,
    "email": "good@example.com"
  },
  {
    "id": 1001,
    "name": "Bad User",
    "age": "invalid_age_string",
    "email": "bad@example.com"
  },
  {
    "id": 1002,
    "name": "Another Good User",
    "age": 35,
    "email": "anothergood@example.com"
  }
]
```

```execute
cat mixed_batch.json | aux4 db postgres execute --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "INSERT INTO users (id, name, age, email) VALUES (:id, :name, :age, :email) RETURNING *" --inputStream --ignore | jq .
```

```error
[{"item":{"id":1001,"name":"Bad User","age":"invalid_age_string","email":"bad@example.com"},"query":"INSERT INTO users (id, name, age, email) VALUES (:id, :name, :age, :email) RETURNING *","error":"invalid input syntax for type integer: \"invalid_age_string\""}]
```

### Test stream with --ignore flag and error

```execute
aux4 db postgres stream --host localhost --port 5432 --database test --user postgres --password mysecretpassword --query "SELECT invalid_column FROM users LIMIT 1" --ignore
```

```expect

```

```error
{"item":{},"query":"SELECT invalid_column FROM users LIMIT 1","error":"column \"invalid_column\" does not exist"}
```

# Schema Introspection

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --user postgres --password mysecretpassword --query "CREATE DATABASE introspect_test"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "CREATE TABLE IF NOT EXISTS product (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name VARCHAR(100) NOT NULL, price NUMERIC(10,2) DEFAULT 0.00, sku VARCHAR(50))"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "COMMENT ON TABLE product IS 'Catalog of products for sale'"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "COMMENT ON COLUMN product.id IS 'Unique product identifier'"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "COMMENT ON COLUMN product.name IS 'Product display name'"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "COMMENT ON COLUMN product.price IS 'Unit price in USD'"
```

```beforeAll
aux4 db postgres execute --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --query "CREATE TABLE IF NOT EXISTS tag (id INTEGER PRIMARY KEY)"
```

```afterAll
aux4 db postgres execute --host localhost --port 5432 --user postgres --password mysecretpassword --query "DROP DATABASE IF EXISTS introspect_test"
```

## Describe a table

### should return canonical column metadata, dropping null and empty fields

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product
```

```expect:json
[
  {
    "name": "id",
    "type": "integer",
    "nullable": false,
    "key": "PRI",
    "comment": "Unique product identifier"
  },
  {
    "name": "name",
    "type": "character varying",
    "nullable": false,
    "comment": "Product display name"
  },
  {
    "name": "price",
    "type": "numeric",
    "nullable": true,
    "default": "0.00",
    "comment": "Unit price in USD"
  },
  {
    "name": "sku",
    "type": "character varying",
    "nullable": true
  }
]
```

### should keep only present keys per row (null/empty dropped, in definition order)

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product | jq -c 'map(keys_unsorted)'
```

```expect
[["name","type","nullable","key","comment"],["name","type","nullable","comment"],["name","type","nullable","default","comment"],["name","type","nullable"]]
```

### should reduce a plain column to just name, type, nullable

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product | jq -c '.[3]'
```

```expect
{"name":"sku","type":"character varying","nullable":true}
```

### should never emit a null or empty-string value

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product | jq -c '[.[] | to_entries[] | .value] | map(select(. == null or . == "")) | length'
```

```expect
0
```

### should emit nullable as a real JSON boolean (not "YES"/"NO", not 1/0)

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product | jq -c 'map(.nullable | type)'
```

```expect
["boolean","boolean","boolean","boolean"]
```

### should honor an explicit --schema filter

```execute
aux4 db postgres describe --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --schema public --table product | jq -c '.[0]'
```

```expect
{"name":"id","type":"integer","nullable":false,"key":"PRI","comment":"Unique product identifier"}
```

## Describe a table with the desc alias

### should behave the same as describe

```execute
aux4 db postgres desc --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword --table product
```

```expect:json
[
  {
    "name": "id",
    "type": "integer",
    "nullable": false,
    "key": "PRI",
    "comment": "Unique product identifier"
  },
  {
    "name": "name",
    "type": "character varying",
    "nullable": false,
    "comment": "Product display name"
  },
  {
    "name": "price",
    "type": "numeric",
    "nullable": true,
    "default": "0.00",
    "comment": "Unit price in USD"
  },
  {
    "name": "sku",
    "type": "character varying",
    "nullable": true
  }
]
```

## List tables

### should list base tables qualified by database and schema, with comments when present

```execute
aux4 db postgres list tables --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword
```

```expect:json
[
  {
    "name": "product",
    "database": "introspect_test",
    "schema": "public",
    "comment": "Catalog of products for sale"
  },
  {
    "name": "tag",
    "database": "introspect_test",
    "schema": "public"
  }
]
```

### should keep only present keys per row (empty comment dropped)

```execute
aux4 db postgres list tables --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword | jq -c 'map(keys_unsorted)'
```

```expect
[["name","database","schema","comment"],["name","database","schema"]]
```

### should never emit a null or empty-string value

```execute
aux4 db postgres list tables --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword | jq -c '[.[] | to_entries[] | .value] | map(select(. == null or . == "")) | length'
```

```expect
0
```

## List databases

### should include a user database in the server listing

```execute
aux4 db postgres list databases --host localhost --port 5432 --user postgres --password mysecretpassword | jq -c 'map(.name) | index("introspect_test") != null'
```

```expect
true
```

### should return one canonical {name} object per database

```execute
aux4 db postgres list databases --host localhost --port 5432 --user postgres --password mysecretpassword | jq -c '[.[] | keys] | unique'
```

```expect
[["name"]]
```

## List schemas

### should include the public schema in the current database

```execute
aux4 db postgres list schemas --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword | jq -c 'map(.name) | index("public") != null'
```

```expect
true
```

### should return one canonical {name} object per schema

```execute
aux4 db postgres list schemas --host localhost --port 5432 --database introspect_test --user postgres --password mysecretpassword | jq -c '[.[] | keys] | unique'
```

```expect
[["name"]]
```
