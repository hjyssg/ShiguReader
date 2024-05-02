

-- 一个filepath，一小时访问超过1次。保留一次就好了。注意是这个time是ms
DELETE FROM history_table
WHERE ROWID NOT IN (
  SELECT MIN(ROWID)
  -- , filePath
  FROM history_table
  GROUP BY filePath, CAST(time / 3600000 AS INTEGER)
);


DELETE FROM lsdir_history_table
WHERE ROWID NOT IN (
  SELECT MIN(ROWID)
  -- , filePath
  FROM lsdir_history_table
  GROUP BY filePath, CAST(time / 3600000 AS INTEGER)
);
