
frontend\src\routes\_layout\explorer.tsx

的发送请求都应该重构。

--------
frontend\src\routes\_layout\read.tsx 的发送请求都应该重构。
打开的时候，
压缩文件去发送一次 解压api
如果是audio image，发送list parent
如果是folder，list当前folder
queryFn一次就好了。

你应该在传统的useeffect去实现。

-------------
explorer


  // 解压 archive 并跳转到解压目录
  const { isExtracting } = useArchiveExtract(archivePath, (cacheDir) => {
    navigate({
      to: "/explorer",
      search: { path: cacheDir, archivePath: "", page: 1, pageSize, sortField, sortOrder },
      replace: true,
    })
  })


