# 如何用命令行查看 GitHub Actions 报错

TOKEN 存在 `.env` 或直接替换命令里的 `$TOKEN`。

```bash
TOKEN=github_pat_xxxxx
REPO=hjyssg/ShiguReader
```

## 1. 查看最近几次 run 的状态

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/actions/runs?per_page=10&branch=nodejs-backend" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const r=JSON.parse(d).workflow_runs;
      r.forEach(x=>console.log(x.name,'|',x.status,'|',x.conclusion,'|',x.id))
    })"
```

输出示例：
```
Test Backend (Node) | completed | success | 12345678
pre-commit          | completed | failure | 12345679
```

## 2. 查看某次 run 里哪个 job/step 失败了

把上一步拿到的 run id 填进去：

```bash
RUN_ID=12345679

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/jobs" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const jobs=JSON.parse(d).jobs;
      jobs.forEach(j=>{
        console.log('JOB:',j.name,j.conclusion,j.id);
        j.steps.forEach(s=>s.conclusion==='failure'&&console.log('  FAIL:',s.name))
      })
    })"
```

## 3. 下载某个 job 的完整日志

把上一步拿到的 job id 填进去：

```bash
JOB_ID=64397032051

curl -s -L -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/actions/jobs/$JOB_ID/logs" \
  -o /tmp/job_log.txt

# 看最后 80 行（通常包含报错）
tail -80 /tmp/job_log.txt

# 搜索关键词
grep -i "error\|fail" /tmp/job_log.txt | tail -30
```

## 现有 Workflows

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `test-backend.yml` | push/PR | 后端 Node.js 单元测试 |
| `pre-commit.yml` | PR | 前端 biome lint 检查 |
| `release.yml` | push tag `v*` | 打包 Windows 发布包 |
