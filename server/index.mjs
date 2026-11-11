import app from "./app.mjs";

const rawPort = Number(process.env.PORT || 3001);
const PORT = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65_536 ? rawPort : 3001;

app.listen(PORT, () => {
  console.log(`veyl server listening on :${PORT}`);
});
