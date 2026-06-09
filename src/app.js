const express = require("express");
const path = require("path");
const webRoutes = require("./routes/web.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/", webRoutes);

module.exports = app;
