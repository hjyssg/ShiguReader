SELECT strftime('%Y', mTime / 1000, 'unixepoch') AS year,
       SUM(size) / 1099511627776.0 AS total_size_tb
FROM file_table
GROUP BY year
ORDER BY year;
