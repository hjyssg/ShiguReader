
-- 每分钟内访问超过一次，同记录那一分钟的最后一次的timestamp
WITH min_history AS 
(SELECT  filePath, MAX(time) as mtime, COUNT(time) as count, time_str FROM 
	(SELECT *, strftime('%Y-%m-%d %H:%M', datetime(time/1000, 'unixepoch')) AS time_str FROM history_table)
GROUP BY fileName, time_str HAVING count > 1) 


-- SELECT *, strftime('%Y-%m-%d %H:%M', datetime(time/1000, 'unixepoch')) AS time_str FROM history_table 
-- WHERE (filePath, time_str) IN (SELECT filePath, time_str FROM min_history) 
-- AND (filePath, time) NOT IN (SELECT filePath, mtime FROM min_history) 
-- ORDER BY time


DELETE FROM history_table 
WHERE (filePath,  strftime('%Y-%m-%d %H:%M', datetime(time/1000, 'unixepoch'))) IN (SELECT filePath, time_str FROM min_history) 
AND (filePath, time) NOT IN (SELECT filePath, mtime FROM min_history) 


CREATE OR REPLACE VIEW min_history AS SELECT *, strftime('%Y-%m-%d %H:%M', datetime(time/1000, 'unixepoch')) AS time_str FROM history_table;