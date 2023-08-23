const { Transform } = require("stream");
const { recursive } = require("merge");
const { Pool } = require("pg");
const QueryStream = require("pg-query-stream");

class Database {
  constructor({ host = "localhost", port = 5432, user = "postgres", password, database = "template1", ...options }) {
    const defaultConfig = {
      host: host,
      port: port,
      user: user,
      password: password,
      database: database
    };

    this.config = recursive(defaultConfig, options);
  }

  async open() {
    this.pool = new Pool(this.config);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async execute(sql, params = {}) {
    const sqlRequest = createRequest(sql, params);

    const connection = await this.pool.connect();
    const response = await connection.query(sqlRequest.query, sqlRequest.params);
    const data = response.rows;
    await connection.release();

    return { data };
  }

  async stream(sql, params = {}) {
    const sqlRequest = createRequest(sql, params);

    const connection = await this.pool.connect();

    const query = new QueryStream(sqlRequest.query, sqlRequest.params);
    const responseStream = connection.query(query);

    const transform = new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        callback(null, row);
      }
    });

    responseStream.on("row", row => {
      transform.emit("data", row);
    });

    responseStream.on("error", err => {
      transform.emit("error", err);
    });

    responseStream.on("end", async () => {
      transform.end();
      await connection.release();
    });

    return responseStream.pipe(transform);
  }
}

function createRequest(sql, params) {
  const VARIABLE_REGEX = /[^:]\B:(?<param>\w+)\b/g;

  let query = sql;
  const arrayParams = [];
  const arrayParamNames = [];

  const regex = new RegExp(VARIABLE_REGEX);

  let match;
  while ((match = regex.exec(sql))) {
    const key = match.groups.param;
    const value = params[key];

    let paramIndex = arrayParamNames.indexOf(key);
    if (paramIndex === -1) {
      paramIndex = arrayParamNames.length;
      arrayParamNames.push(key);
      arrayParams.push(value);
    }

    query = query.replace(`:${key}`, `$${paramIndex + 1}`);
  }

  return { query: query, params: arrayParams };
}

module.exports = Database;
