REM need run "npm run build" before this bat

start node src/server/index.js --production 
start node src/server/_sub_server.js
@REM start nginx