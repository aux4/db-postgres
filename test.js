const args = process.argv.slice(2);

const sql = args[0];
const params = args.slice(1);

const sqlParams = {};

params.forEach(param => {
  const [key, value] = param.split("=");
  sqlParams[key] = value;
});

const Database = require("./index");
const db = new Database({
  host: "localhost",
  user: "postgres",
  password: "mysecretpassword",
  database: "risksolutionsdb"
});

(async () => {
  await db.open();
  // const stream = await db.stream(sql, sqlParams);
  //
  // stream.on("data", row => {
  //   console.log(JSON.stringify(row, null, 2));
  // });
  //
  // stream.on("error", err => {
  //   console.error(err.message);
  // });
  //
  // stream.on("close", async () => {
  //   await db.close();
  // });

  const { data } = await db.execute(sql, sqlParams);
  console.log(JSON.stringify(data, null, 2));
  await db.close();
})();
